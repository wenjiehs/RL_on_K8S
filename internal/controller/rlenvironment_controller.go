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
	"context"
	"reflect"

	appsv1 "k8s.io/api/apps/v1"
	autoscalingv2 "k8s.io/api/autoscaling/v2"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"

	rlv1alpha1 "github.com/rl-console/operator/api/v1alpha1"
)

// RLEnvironmentReconciler reconciles a RLEnvironment object
type RLEnvironmentReconciler struct {
	client.Client
	Scheme *runtime.Scheme
}

//+kubebuilder:rbac:groups=rl.console.my.domain,resources=rlenvironments,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=rl.console.my.domain,resources=rlenvironments/status,verbs=get;update;patch
//+kubebuilder:rbac:groups=rl.console.my.domain,resources=rlenvironments/finalizers,verbs=update
//+kubebuilder:rbac:groups=apps,resources=deployments,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=core,resources=pods,verbs=get;list;watch
//+kubebuilder:rbac:groups=autoscaling,resources=horizontalpodautoscalers,verbs=get;list;watch;create;update;patch;delete

func (r *RLEnvironmentReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := log.FromContext(ctx)

	// Fetch the RLEnvironment instance
	rlEnv := &rlv1alpha1.RLEnvironment{}
	err := r.Get(ctx, req.NamespacedName, rlEnv)
	if err != nil {
		if errors.IsNotFound(err) {
			log.Info("RLEnvironment resource not found. Ignoring since object must be deleted")
			return ctrl.Result{}, nil
		}
		log.Error(err, "Failed to get RLEnvironment")
		return ctrl.Result{}, err
	}

	// Check if the deployment already exists, if not create a new one
	found := &appsv1.Deployment{}
	err = r.Get(ctx, types.NamespacedName{Name: rlEnv.Name, Namespace: rlEnv.Namespace}, found)
	if err != nil && errors.IsNotFound(err) {
		// Define a new deployment
		dep := r.deploymentForRLEnvironment(rlEnv)
		log.Info("Creating a new Deployment", "Deployment.Namespace", dep.Namespace, "Deployment.Name", dep.Name)
		err = r.Create(ctx, dep)
		if err != nil {
			log.Error(err, "Failed to create new Deployment", "Deployment.Namespace", dep.Namespace, "Deployment.Name", dep.Name)
			return ctrl.Result{}, err
		}
		// Deployment created successfully - return and requeue
		return ctrl.Result{Requeue: true}, nil
	} else if err != nil {
		log.Error(err, "Failed to get Deployment")
		return ctrl.Result{}, err
	}

	// Ensure the deployment size is the same as the spec, if HPA is not enabled
	if rlEnv.Spec.HPASpec == nil {
		size := rlEnv.Spec.Replicas
		if *found.Spec.Replicas != *size {
			found.Spec.Replicas = size
			err = r.Update(ctx, found)
			if err != nil {
				log.Error(err, "Failed to update Deployment", "Deployment.Namespace", found.Namespace, "Deployment.Name", found.Name)
				return ctrl.Result{}, err
			}
			// Spec updated - return and requeue
			return ctrl.Result{Requeue: true}, nil
		}
	}

	// Handle HPA
	if rlEnv.Spec.HPASpec != nil {
		hpa := &autoscalingv2.HorizontalPodAutoscaler{}
		err = r.Get(ctx, types.NamespacedName{Name: rlEnv.Name, Namespace: rlEnv.Namespace}, hpa)
		if err != nil && errors.IsNotFound(err) {
			// Create a new HPA
			hpa = r.hpaForRLEnvironment(rlEnv)
			log.Info("Creating a new HPA", "HPA.Namespace", hpa.Namespace, "HPA.Name", hpa.Name)
			err = r.Create(ctx, hpa)
			if err != nil {
				log.Error(err, "Failed to create new HPA", "HPA.Namespace", hpa.Namespace, "HPA.Name", hpa.Name)
				return ctrl.Result{}, err
			}
			return ctrl.Result{Requeue: true}, nil
		} else if err != nil {
			log.Error(err, "Failed to get HPA")
			return ctrl.Result{}, err
		}
	}

	// Update the RLEnvironment status
	podList := &corev1.PodList{}
	listOpts := []client.ListOption{
		client.InNamespace(rlEnv.Namespace),
		client.MatchingLabels(labelsForRLEnvironment(rlEnv.Name)),
	}
	if err = r.List(ctx, podList, listOpts...); err != nil {
		log.Error(err, "Failed to list pods", "RLEnvironment.Namespace", rlEnv.Namespace, "RLEnvironment.Name", rlEnv.Name)
		return ctrl.Result{}, err
	}
	podNames := getPodNames(podList.Items)
	readyReplicas := found.Status.ReadyReplicas

	// Compare the new status with the old one and update if needed
	if !reflect.DeepEqual(podNames, rlEnv.Status.PodNames) || readyReplicas != rlEnv.Status.ReadyReplicas {
		rlEnv.Status.PodNames = podNames
		rlEnv.Status.ReadyReplicas = readyReplicas
		err := r.Status().Update(ctx, rlEnv)
		if err != nil {
			log.Error(err, "Failed to update RLEnvironment status")
			return ctrl.Result{}, err
		}
	}

	return ctrl.Result{}, nil
}

// deploymentForRLEnvironment returns a RLEnvironment Deployment object
func (r *RLEnvironmentReconciler) deploymentForRLEnvironment(m *rlv1alpha1.RLEnvironment) *appsv1.Deployment {
	ls := labelsForRLEnvironment(m.Name)
	replicas := m.Spec.Replicas

	dep := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      m.Name,
			Namespace: m.Namespace,
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: replicas,
			Selector: &metav1.LabelSelector{
				MatchLabels: ls,
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: ls,
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{
						{
							Image: m.Spec.Image,
							Name:  "rl-environment",
						},
						{
							Image:   "busybox",
							Name:    "data-collector",
							Command: []string{"/bin/sh", "-c", "while true; do echo 'Simulating data collection...' >> /data/log.txt; sleep 10; done"},
							VolumeMounts: []corev1.VolumeMount{
								{
									Name:      "data-volume",
									MountPath: "/data",
								},
							},
						},
					},
					Volumes: []corev1.Volume{
						{
							Name: "data-volume",
							VolumeSource: corev1.VolumeSource{
								EmptyDir: &corev1.EmptyDirVolumeSource{},
							},
						},
					},
				},
			},
		},
	}
	// Set RLEnvironment instance as the owner and controller
	ctrl.SetControllerReference(m, dep, r.Scheme)
	return dep
}

// hpaForRLEnvironment returns a RLEnvironment HPA object
func (r *RLEnvironmentReconciler) hpaForRLEnvironment(m *rlv1alpha1.RLEnvironment) *autoscalingv2.HorizontalPodAutoscaler {
	hpaSpec := m.Spec.HPASpec
	targetCPUUtilization := hpaSpec.TargetCPUUtilizationPercentage

	hpa := &autoscalingv2.HorizontalPodAutoscaler{
		ObjectMeta: metav1.ObjectMeta{
			Name:      m.Name,
			Namespace: m.Namespace,
		},
		Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
			ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{
				APIVersion: "apps/v1",
				Kind:       "Deployment",
				Name:       m.Name,
			},
			MinReplicas: hpaSpec.MinReplicas,
			MaxReplicas: hpaSpec.MaxReplicas,
			Metrics: []autoscalingv2.MetricSpec{
				{
					Type: autoscalingv2.ResourceMetricSourceType,
					Resource: &autoscalingv2.ResourceMetricSource{
						Name: corev1.ResourceCPU,
						Target: autoscalingv2.MetricTarget{
							Type:               autoscalingv2.UtilizationMetricType,
							AverageUtilization: targetCPUUtilization,
						},
					},
				},
			},
		},
	}

	// Set RLEnvironment instance as the owner and controller
	ctrl.SetControllerReference(m, hpa, r.Scheme)
	return hpa
}

// getPodNames returns the pod names of the array of pods.
func getPodNames(pods []corev1.Pod) []string {
	var podNames []string
	for _, pod := range pods {
		podNames = append(podNames, pod.Name)
	}
	return podNames
}

// labelsForRLEnvironment returns the labels for selecting the resources
// belonging to the given RLEnvironment CR name.
func labelsForRLEnvironment(name string) map[string]string {
	return map[string]string{"app": "rlenvironment", "rlenvironment_cr": name}
}

// SetupWithManager sets up the controller with the Manager.
func (r *RLEnvironmentReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&rlv1alpha1.RLEnvironment{}).
		Owns(&appsv1.Deployment{}).
		Owns(&autoscalingv2.HorizontalPodAutoscaler{}).
		Complete(r)
}