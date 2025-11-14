/*
Copyright 2025.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	// Import Ray API
	rayv1 "github.com/ray-project/kuberay/ray-operator/apis/ray/v1"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"

	rlv1alpha1 "github.com/rl-console/operator/api/v1alpha1"
	corev1 "k8s.io/api/core/v1"
)

// RLTrainingJobReconciler reconciles a RLTrainingJob object
type RLTrainingJobReconciler struct {
	client.Client
	Scheme *runtime.Scheme
}

//+kubebuilder:rbac:groups=rl.console.my.domain,resources=rltrainingjobs,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=rl.console.my.domain,resources=rltrainingjobs/status,verbs=get;update;patch
//+kubebuilder:rbac:groups=rl.console.my.domain,resources=rltrainingjobs/finalizers,verbs=update
//+kubebuilder:rbac:groups=ray.io,resources=rayjobs,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=rl.console.my.domain,resources=rlenvironments,verbs=get;list;watch

func (r *RLTrainingJobReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := log.FromContext(ctx)

	// Fetch the RLTrainingJob instance
	rlTrainingJob := &rlv1alpha1.RLTrainingJob{}
	if err := r.Get(ctx, req.NamespacedName, rlTrainingJob); err != nil {
		if errors.IsNotFound(err) {
			log.Info("RLTrainingJob resource not found. Ignoring since object must be deleted.")
			return ctrl.Result{}, nil
		}
		log.Error(err, "Failed to get RLTrainingJob")
		return ctrl.Result{}, err
	}

	// Only handle 'Ray' framework for now
	if rlTrainingJob.Spec.Framework != "Ray" {
		log.Info("Framework is not Ray, skipping reconciliation.", "Framework", rlTrainingJob.Spec.Framework)
		return ctrl.Result{}, nil
	}

	// Fetch the associated RLEnvironment
	rlEnv := &rlv1alpha1.RLEnvironment{}
	envName := types.NamespacedName{Name: rlTrainingJob.Spec.EnvironmentRef, Namespace: req.Namespace}
	if err := r.Get(ctx, envName, rlEnv); err != nil {
		log.Error(err, "Failed to get associated RLEnvironment", "RLEnvironment", envName)
		// Update status and requeue
		rlTrainingJob.Status.Status = "Error: RLEnvironment not found"
		_ = r.Status().Update(ctx, rlTrainingJob)
		return ctrl.Result{}, err
	}

	// Check if the RayJob already exists, if not create a new one
	found := &rayv1.RayJob{}
	err := r.Get(ctx, types.NamespacedName{Name: rlTrainingJob.Name, Namespace: rlTrainingJob.Namespace}, found)
	if err != nil && errors.IsNotFound(err) {
		// Define a new RayJob
		rayJob := r.rayJobForRLTrainingJob(rlTrainingJob, rlEnv)
		log.Info("Creating a new RayJob", "RayJob.Namespace", rayJob.Namespace, "RayJob.Name", rayJob.Name)
		err = r.Create(ctx, rayJob)
		if err != nil {
			log.Error(err, "Failed to create new RayJob", "RayJob.Namespace", rayJob.Namespace, "RayJob.Name", rayJob.Name)
			return ctrl.Result{}, err
		}
		// RayJob created successfully - update status and requeue
		rlTrainingJob.Status.Status = "Creating"
		if err := r.Status().Update(ctx, rlTrainingJob); err != nil {
			log.Error(err, "Failed to update RLTrainingJob status")
			return ctrl.Result{}, err
		}
		return ctrl.Result{Requeue: true}, nil
	} else if err != nil {
		log.Error(err, "Failed to get RayJob")
		return ctrl.Result{}, err
	}

	// Update status from RayJob and handle alerts
	newStatus := string(found.Status.JobStatus)
	if rlTrainingJob.Status.Status != newStatus {
		rlTrainingJob.Status.Status = newStatus
		if err := r.Status().Update(ctx, rlTrainingJob); err != nil {
			log.Error(err, "Failed to update RLTrainingJob status")
			return ctrl.Result{}, err
		}

		// If the job has failed, send an alert
		if newStatus == string(rayv1.JobStatusFailed) && rlTrainingJob.Spec.AlertingSpec != nil && rlTrainingJob.Spec.AlertingSpec.Webhook != nil {
			if err := r.sendWebhookAlert(ctx, rlTrainingJob); err != nil {
				log.Error(err, "Failed to send webhook alert")
				// Don't block reconciliation for alert failure
			}
		}
	}

	return ctrl.Result{}, nil
}

func (r *RLTrainingJobReconciler) rayJobForRLTrainingJob(job *rlv1alpha1.RLTrainingJob, env *rlv1alpha1.RLEnvironment) *rayv1.RayJob {
	// A simple python script to run. In a real scenario, this would come from the job spec or a configmap.
	entrypoint := fmt.Sprintf("python -c \"import ray; ray.init(); print('Hello from Ray in environment %s!')\"", env.Name)

	// Use the image from the environment
	image := env.Spec.Image
	if image == "" {
		image = "rayproject/ray:2.9.0" // Fallback image
	}

	// Use replicas from the environment
	workerReplicas := env.Spec.Replicas
	if workerReplicas == nil {
		one := int32(1)
		workerReplicas = &one
	}
	
	minWorkerReplicas := workerReplicas
	maxWorkerReplicas := workerReplicas
	if env.Spec.HPASpec != nil {
		if env.Spec.HPASpec.MinReplicas != nil {
			minWorkerReplicas = env.Spec.HPASpec.MinReplicas
		}
		maxWorkerReplicas = &env.Spec.HPASpec.MaxReplicas
	}

	// Prepare environment variables
	envVars := []corev1.EnvVar{}
	if job.Spec.CheckpointSpec != nil {
		envVars = append(envVars, corev1.EnvVar{
			Name:  "CHECKPOINT_PATH",
			Value: job.Spec.CheckpointSpec.Path,
		})
		envVars = append(envVars, corev1.EnvVar{
			Name:  "CHECKPOINT_INTERVAL_SECONDS",
			Value: fmt.Sprintf("%d", job.Spec.CheckpointSpec.IntervalSeconds),
		})
	}


	rayJob := &rayv1.RayJob{
		ObjectMeta: metav1.ObjectMeta{
			Name:      job.Name,
			Namespace: job.Namespace,
		},
		Spec: rayv1.RayJobSpec{
			Entrypoint: entrypoint,
			RayClusterSpec: &rayv1.RayClusterSpec{
				HeadGroupSpec: rayv1.HeadGroupSpec{
					RayStartParams: map[string]string{
						"dashboard-host": "0.0.0.0",
					},
					Template: corev1.PodTemplateSpec{
						Spec: corev1.PodSpec{
							Containers: []corev1.Container{
								{
									Name:  "ray-head",
									Image: image,
									Env:   envVars,
									Ports: []corev1.ContainerPort{
										{ContainerPort: 6379, Name: "gcs-server"},
										{ContainerPort: 8265, Name: "dashboard"},
										{ContainerPort: 10001, Name: "client"},
									},
								},
							},
						},
					},
				},
				WorkerGroupSpecs: []rayv1.WorkerGroupSpec{
					{
						Replicas:       workerReplicas,
						MinReplicas:    minWorkerReplicas,
						MaxReplicas:    maxWorkerReplicas,
						GroupName:      "small-group",
						RayStartParams: map[string]string{},
						Template: corev1.PodTemplateSpec{
							Spec: corev1.PodSpec{
								Containers: []corev1.Container{
									{
										Name:  "ray-worker",
										Image: image,
										Env:   envVars,
									},
								},
							},
						},
					},
				},
			},
		},
	}
	// Set RLTrainingJob instance as the owner and controller
	ctrl.SetControllerReference(job, rayJob, r.Scheme)
	return rayJob
}

func (r *RLTrainingJobReconciler) sendWebhookAlert(ctx context.Context, job *rlv1alpha1.RLTrainingJob) error {
	log := log.FromContext(ctx)
	webhookURL := job.Spec.AlertingSpec.Webhook.URL

	alertData := map[string]string{
		"jobName":   job.Name,
		"namespace": job.Namespace,
		"status":    "Failed",
		"message":   fmt.Sprintf("Training job %s in namespace %s has failed.", job.Name, job.Namespace),
	}
	jsonData, err := json.Marshal(alertData)
	if err != nil {
		return fmt.Errorf("failed to marshal alert data: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", webhookURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create webhook request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send webhook request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		log.Info("Successfully sent webhook alert", "url", webhookURL)
	} else {
		return fmt.Errorf("webhook returned non-success status code: %d", resp.StatusCode)
	}

	return nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *RLTrainingJobReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&rlv1alpha1.RLTrainingJob{}).
		Owns(&rayv1.RayJob{}).
		Complete(r)
}