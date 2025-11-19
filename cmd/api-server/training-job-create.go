package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// TrainingJobRequest represents the request to create a training job
type TrainingJobRequest struct {
	// 基础信息
	JobName        string `json:"jobName"`
	JobDescription string `json:"jobDescription,omitempty"`
	BaseModel      string `json:"baseModel"`
	TrainingType   string `json:"trainingType"`
	TrainingMethod string `json:"trainingMethod"`

	// 环境信息
	EnvironmentID    string `json:"environmentId"`
	CPU             int    `json:"cpu"`
	Memory          int    `json:"memory"`
	GPU             int    `json:"gpu"`
	Image           string `json:"image"`
	EnableRDMA      bool   `json:"enableRDMA"`
	DebugMode       bool   `json:"debugMode"`
	OutputDirectory string `json:"outputDirectory"`

	// 数据集配置
	DPODataset string `json:"dpoDataset"`

	// 训练配置
	StartupScript   string  `json:"startupScript,omitempty"`
	DependencyFiles []string `json:"dependencyFiles,omitempty"`
}

// handleCreateTrainingJob handles training job creation
func handleCreateTrainingJobHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Content-Type", "application/json")

	var req TrainingJobRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.JobName == "" {
		http.Error(w, "Job name is required", http.StatusBadRequest)
		return
	}
	if req.BaseModel == "" {
		http.Error(w, "Base model is required", http.StatusBadRequest)
		return
	}
	if req.TrainingType == "" {
		http.Error(w, "Training type is required", http.StatusBadRequest)
		return
	}
	if req.TrainingMethod == "" {
		http.Error(w, "Training method is required", http.StatusBadRequest)
		return
	}
	if req.EnvironmentID == "" {
		http.Error(w, "Environment ID is required", http.StatusBadRequest)
		return
	}
	if req.DPODataset == "" {
		http.Error(w, "DPO dataset is required", http.StatusBadRequest)
		return
	}

	// Generate job ID
	jobID := fmt.Sprintf("job-%d", time.Now().Unix())

	// Convert dependency files slice to JSON string for database storage
	dependencyFilesJSON := "[]"
	if len(req.DependencyFiles) > 0 {
		if files, err := json.Marshal(req.DependencyFiles); err == nil {
			dependencyFilesJSON = string(files)
		}
	}
	
	// Convert to DB model for saving directly
	trainingJobDB := TrainingJobDB{
		ID:              jobID,
		Name:            req.JobName,
		Description:      req.JobDescription,
		BaseModel:       req.BaseModel,
		TrainingType:    req.TrainingType,
		TrainingMethod:  req.TrainingMethod,
		Status:          "pending",
		EnvironmentID:   req.EnvironmentID,
		CPU:             req.CPU,
		Memory:          req.Memory,
		GPU:             req.GPU,
		Image:           req.Image,
		EnableRDMA:      req.EnableRDMA,
		DebugMode:       req.DebugMode,
		OutputDirectory: req.OutputDirectory,
		DPODataset:     req.DPODataset,
		StartupScript:   req.StartupScript,
		DependencyFiles: dependencyFilesJSON,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	// Save to database using GORM
	if err := GetDB().Create(&trainingJobDB).Error; err != nil {
		log.Printf("Failed to save training job: %v", err)
		http.Error(w, "Failed to save training job", http.StatusInternalServerError)
		return
	}

	// Create Kubernetes Job
	if err := createKubernetesJob(jobID, &req); err != nil {
		log.Printf("Failed to create Kubernetes job: %v", err)
		http.Error(w, fmt.Sprintf("Failed to create training job: %v", err), http.StatusInternalServerError)
		return
	}

	log.Printf("Training job created successfully: %s", jobID)
	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"jobId":  jobID,
		"message": "Training job created successfully",
	})
}

// createKubernetesJob creates a Kubernetes Job for training
func createKubernetesJob(jobID string, req *TrainingJobRequest) error {
	if currentClientset == nil {
		return fmt.Errorf("Kubernetes client not initialized")
	}

	// Generate output directory if not provided
	outputDir := req.OutputDirectory
	if outputDir == "" {
		outputDir = fmt.Sprintf("/mnt/cfs/%s/checkpoint", jobID)
	}

	// Create resource requirements
	resources := corev1.ResourceRequirements{
		Requests: corev1.ResourceList{
			corev1.ResourceCPU:    resource.MustParse(fmt.Sprintf("%d", req.CPU)),
			corev1.ResourceMemory: resource.MustParse(fmt.Sprintf("%dGi", req.Memory)),
		},
	}
	if req.GPU > 0 {
		resources.Requests[corev1.ResourceName("nvidia.com/gpu")] = resource.MustParse(fmt.Sprintf("%d", req.GPU))
	}

	// Create volume mounts
	volumeMounts := []corev1.VolumeMount{
		{
			Name:      "cfs-storage",
			MountPath: "/mnt/cfs",
		},
		{
			Name:      "output-volume",
			MountPath: "/output",
		},
	}

	// Create volumes
	volumes := []corev1.Volume{
		{
			Name: "cfs-storage",
			VolumeSource: corev1.VolumeSource{
				PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
					ClaimName: "rl-cfs-turbo-pv",
				},
			},
		},
		{
			Name: "output-volume",
			VolumeSource: corev1.VolumeSource{
				EmptyDir: &corev1.EmptyDirVolumeSource{},
			},
		},
	}

	// Create container with training script
	container := corev1.Container{
		Name:  "training-container",
		Image: req.Image,
		Command: []string{"/bin/sh", "-c"},
		Args: []string{
			fmt.Sprintf(`
# Set up environment
export JOB_ID=%s
export BASE_MODEL=%s
export TRAINING_TYPE=%s
export TRAINING_METHOD=%s
export DPO_DATASET=%s
export OUTPUT_DIR=%s
export ENABLE_RDMA=%t
export DEBUG_MODE=%t

# Create output directory
mkdir -p $OUTPUT_DIR

# Download DPO dataset if specified
if [ "$DPO_DATASET" != "" ]; then
    echo "Setting up DPO dataset: $DPO_DATASET"
    # Dataset setup logic here
fi

# Run training
echo "Starting training with base model: $BASE_MODEL"
echo "Training method: $TRAINING_METHOD"
echo "Output directory: $OUTPUT_DIR"

# Placeholder for actual training command
# python train.py --base-model $BASE_MODEL --method $TRAINING_METHOD --dataset $DPO_DATASET --output $OUTPUT_DIR

echo "Training completed successfully"
`, jobID, req.BaseModel, req.TrainingType, req.TrainingMethod, req.DPODataset, outputDir, req.EnableRDMA, req.DebugMode),
		},
		VolumeMounts: volumeMounts,
		Resources:   resources,
		Env: []corev1.EnvVar{
			{Name: "JOB_ID", Value: jobID},
			{Name: "BASE_MODEL", Value: req.BaseModel},
			{Name: "TRAINING_TYPE", Value: req.TrainingType},
			{Name: "TRAINING_METHOD", Value: req.TrainingMethod},
			{Name: "DPO_DATASET", Value: req.DPODataset},
			{Name: "OUTPUT_DIR", Value: outputDir},
			{Name: "ENABLE_RDMA", Value: fmt.Sprintf("%t", req.EnableRDMA)},
			{Name: "DEBUG_MODE", Value: fmt.Sprintf("%t", req.DebugMode)},
		},
	}

	// Add RDMA support if enabled
	if req.EnableRDMA {
		container.SecurityContext = &corev1.SecurityContext{
			Capabilities: &corev1.Capabilities{
				Add: []corev1.Capability{"IPC_LOCK"},
			},
		}
	}

	// Create job spec
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      jobID,
			Namespace: "default",
			Labels: map[string]string{
				"app":          "training-job",
				"job-id":       jobID,
				"base-model":    req.BaseModel,
				"training-type": req.TrainingType,
				"training-method": req.TrainingMethod,
			},
		},
		Spec: batchv1.JobSpec{
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{
						"app":          "training-job",
						"job-id":       jobID,
						"base-model":    req.BaseModel,
						"training-type": req.TrainingType,
						"training-method": req.TrainingMethod,
					},
				},
				Spec: corev1.PodSpec{
					RestartPolicy: corev1.RestartPolicyNever,
					Containers:   []corev1.Container{container},
					Volumes:      volumes,
					NodeSelector: map[string]string{
						// Add GPU node selector if GPU is requested
						"accelerator": "nvidia-tesla-v100",
					},
				},
			},
			BackoffLimit: int32Ptr(3),
		},
	}

	// Create the job
	_, err := currentClientset.BatchV1().Jobs("default").Create(context.Background(), job, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("failed to create training job: %w", err)
	}

	return nil
}

// Helper function
func int32Ptr(i int32) *int32 {
	return &i
}