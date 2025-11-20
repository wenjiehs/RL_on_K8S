package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// handleListTrainingJobs handles listing training jobs
func handleListTrainingJobsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Content-Type", "application/json")

	jobs, err := GetTrainingJobs()
	if err != nil {
		log.Printf("Failed to get training jobs: %v", err)
		http.Error(w, "Failed to get training jobs", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"jobs":    jobs,
	})
}

// handleGetTrainingJob handles getting a specific training job
func handleGetTrainingJobHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Content-Type", "application/json")

	jobID := r.URL.Query().Get("id")
	if jobID == "" {
		http.Error(w, "Job ID is required", http.StatusBadRequest)
		return
	}

	job, err := GetTrainingJob(jobID)
	if err != nil {
		log.Printf("Failed to get training job: %v", err)
		http.Error(w, "Training job not found", http.StatusNotFound)
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"job":    job,
	})
}

// handleStartTrainingJob handles starting a training job
func handleStartTrainingJobHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Content-Type", "application/json")

	jobID := r.URL.Query().Get("id")
	if jobID == "" {
		http.Error(w, "Job ID is required", http.StatusBadRequest)
		return
	}

	// Update job status to running
	if err := UpdateTrainingJobStatus(jobID, "running"); err != nil {
		log.Printf("Failed to update training job status: %v", err)
		http.Error(w, "Failed to start training job", http.StatusInternalServerError)
		return
	}

	log.Printf("Training job started: %s", jobID)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Training job started successfully",
	})
}

// handlePauseTrainingJob handles pausing a training job
func handlePauseTrainingJobHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Content-Type", "application/json")

	jobID := r.URL.Query().Get("id")
	if jobID == "" {
		http.Error(w, "Job ID is required", http.StatusBadRequest)
		return
	}

	// Update job status to paused
	if err := UpdateTrainingJobStatus(jobID, "paused"); err != nil {
		log.Printf("Failed to update training job status: %v", err)
		http.Error(w, "Failed to pause training job", http.StatusInternalServerError)
		return
	}

	log.Printf("Training job paused: %s", jobID)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Training job paused successfully",
	})
}

// handleStopTrainingJob handles stopping a training job
func handleStopTrainingJobHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Content-Type", "application/json")

	jobID := r.URL.Query().Get("id")
	if jobID == "" {
		http.Error(w, "Job ID is required", http.StatusBadRequest)
		return
	}

	// Update job status to stopped
	if err := UpdateTrainingJobStatus(jobID, "stopped"); err != nil {
		log.Printf("Failed to update training job status: %v", err)
		http.Error(w, "Failed to stop training job", http.StatusInternalServerError)
		return
	}

	log.Printf("Training job stopped: %s", jobID)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Training job stopped successfully",
	})
}

// handleResumeTrainingJob handles resuming a training job
func handleResumeTrainingJobHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Content-Type", "application/json")

	jobID := r.URL.Query().Get("id")
	if jobID == "" {
		http.Error(w, "Job ID is required", http.StatusBadRequest)
		return
	}

	// Update job status to running
	if err := UpdateTrainingJobStatus(jobID, "running"); err != nil {
		log.Printf("Failed to update training job status: %v", err)
		http.Error(w, "Failed to resume training job", http.StatusInternalServerError)
		return
	}

	log.Printf("Training job resumed: %s", jobID)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Training job resumed successfully",
	})
}

// handleDeleteTrainingJob handles deleting a training job
func handleDeleteTrainingJobHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Content-Type", "application/json")

	jobID := r.URL.Query().Get("id")
	if jobID == "" {
		http.Error(w, "Job ID is required", http.StatusBadRequest)
		return
	}

	// Delete from database
	if err := DeleteTrainingJob(jobID); err != nil {
		log.Printf("Failed to delete training job: %v", err)
		http.Error(w, "Failed to delete training job", http.StatusInternalServerError)
		return
	}

	log.Printf("Training job deleted: %s", jobID)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Training job deleted successfully",
	})
}

// handleGetTrainingJobMetrics handles getting training job metrics
func handleGetTrainingJobMetricsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Content-Type", "application/json")

	jobID := r.URL.Query().Get("id")
	if jobID == "" {
		http.Error(w, "Job ID is required", http.StatusBadRequest)
		return
	}

	// Get job from database
	job, err := GetTrainingJob(jobID)
	if err != nil {
		log.Printf("Failed to get training job: %v", err)
		http.Error(w, "Training job not found", http.StatusNotFound)
		return
	}

	// Get Kubernetes job metrics
	metrics, err := getKubernetesJobMetrics(jobID)
	if err != nil {
		log.Printf("Failed to get job metrics: %v", err)
		http.Error(w, "Failed to get job metrics", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"job":     job,
		"metrics":  metrics,
	})
}

// Helper functions for Kubernetes job management

func getKubernetesJobMetrics(jobID string) (map[string]interface{}, error) {
	if currentClientset == nil {
		return nil, fmt.Errorf("Kubernetes client not initialized")
	}

	// Get job
	job, err := GetTrainingJob(jobID)
	if err != nil {
		return nil, fmt.Errorf("failed to get job: %w", err)
	}

	// Get associated pods
	pods, err := currentClientset.CoreV1().Pods("default").List(context.Background(), metav1.ListOptions{
		LabelSelector: fmt.Sprintf("job-id=%s", jobID),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get pods: %w", err)
	}

	// Calculate metrics
	var totalCPU, totalMemory, totalGPU int64
	var completedPods, runningPods, failedPods int

	for _, pod := range pods.Items {
		if pod.Status.Phase == corev1.PodSucceeded {
			completedPods++
		} else if pod.Status.Phase == corev1.PodRunning {
			runningPods++
		} else if pod.Status.Phase == corev1.PodFailed {
			failedPods++
		}
	}

	// Sum resources from all pods
	for _, pod := range pods.Items {
		for _, container := range pod.Spec.Containers {
			if cpu, ok := container.Resources.Requests[corev1.ResourceCPU]; ok {
				totalCPU += cpu.MilliValue()
			}
			if memory, ok := container.Resources.Requests[corev1.ResourceMemory]; ok {
				totalMemory += memory.Value()
			}
			if gpu, ok := container.Resources.Requests[corev1.ResourceName("nvidia.com/gpu")]; ok {
				totalGPU += gpu.Value()
			}
		}
	}

	metrics := map[string]interface{}{
		"jobStatus":      job.Status,
		"startTime":      job.CreatedAt,
		"completionTime": job.UpdatedAt,
		"pods": map[string]interface{}{
			"total":     len(pods.Items),
			"completed": completedPods,
			"running":   runningPods,
			"failed":    failedPods,
		},
		"resources": map[string]interface{}{
			"cpu":    fmt.Sprintf("%dm", totalCPU/1000),
			"memory": fmt.Sprintf("%dMi", totalMemory/1024/1024),
			"gpu":    totalGPU,
		},
		"duration": func() string {
			if job.CreatedAt.IsZero() {
				return "N/A"
			}
			return time.Since(job.CreatedAt).String()
		}(),
	}

	return metrics, nil
}