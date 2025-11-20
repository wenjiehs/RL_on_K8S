package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

// TrainingJobRequest represents request to create a training job
type TrainingJobRequest struct {
	// 基础信息
	JobName        string `json:"jobName"`
	JobDescription string `json:"jobDescription,omitempty"`
	BaseModel      string `json:"baseModel"`
	TrainingType   string `json:"trainingType"`
	TrainingMethod string `json:"trainingMethod"`

	// 环境配置方式
	EnvironmentMode string `json:"environmentMode"` // select-existing | create-new
	
	// 选择已有环境
	Namespace     string `json:"namespace"`     // 选择已有环境时的命名空间
	EnvironmentID string `json:"environmentId"`
	
	// 自动创建环境
	CreateNamespace string `json:"createNamespace"` // 自动创建环境时的命名空间
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
	if err := validateTrainingJobRequest(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Generate job ID
	jobID := fmt.Sprintf("job-%d", time.Now().Unix())

	// Save to database
	if err := saveTrainingJobToDB(jobID, &req); err != nil {
		log.Printf("Failed to save training job: %v", err)
		http.Error(w, "Failed to save training job to database", http.StatusInternalServerError)
		return
	}

	log.Printf("Training job created successfully: %s", jobID)
	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"jobId":   jobID,
		"message": "Training job created successfully",
	})
}

// validateTrainingJobRequest validates training job request
func validateTrainingJobRequest(req *TrainingJobRequest) error {
	// 基础信息验证
	if req.JobName == "" {
		return fmt.Errorf("Job name is required")
	}
	if req.BaseModel == "" {
		return fmt.Errorf("Base model is required")
	}
	if req.TrainingType == "" {
		return fmt.Errorf("Training type is required")
	}
	if req.TrainingMethod == "" {
		return fmt.Errorf("Training method is required")
	}
	
	// 环境配置方式验证
	if req.EnvironmentMode == "" {
		return fmt.Errorf("Environment mode is required")
	}
	
	// 根据环境配置方式验证不同字段
	if req.EnvironmentMode == "select-existing" {
		if req.Namespace == "" {
			return fmt.Errorf("Namespace is required when selecting existing environment")
		}
		if req.EnvironmentID == "" {
			return fmt.Errorf("Environment ID is required when selecting existing environment")
		}
	} else if req.EnvironmentMode == "create-new" {
		if req.CreateNamespace == "" {
			return fmt.Errorf("Create namespace is required when creating new environment")
		}
		if req.CPU <= 0 {
			return fmt.Errorf("CPU must be greater than 0")
		}
		if req.Memory <= 0 {
			return fmt.Errorf("Memory must be greater than 0")
		}
		if req.Image == "" {
			return fmt.Errorf("Image is required when creating new environment")
		}
	} else {
		return fmt.Errorf("Invalid environment mode: %s", req.EnvironmentMode)
	}
	
	// 数据集验证
	if req.DPODataset == "" {
		return fmt.Errorf("DPO dataset is required")
	}
	
	return nil
}

// saveTrainingJobToDB saves training job to database
func saveTrainingJobToDB(jobID string, req *TrainingJobRequest) error {
	// Convert dependency files slice to JSON string for database storage
	dependencyFilesJSON := "[]"
	if len(req.DependencyFiles) > 0 {
		if files, err := json.Marshal(req.DependencyFiles); err == nil {
			dependencyFilesJSON = string(files)
		}
	}
	
	// Convert to DB model
	trainingJobDB := TrainingJobDB{
		ID:              jobID,
		Name:            req.JobName,
		Description:      req.JobDescription,
		BaseModel:       req.BaseModel,
		TrainingType:    req.TrainingType,
		TrainingMethod:  req.TrainingMethod,
		Status:          "pending",
		
		// 环境配置
		EnvironmentMode: req.EnvironmentMode,
		Namespace:       req.Namespace,
		CreateNamespace: req.CreateNamespace,
		EnvironmentID:   req.EnvironmentID,
		
		// 资源配置
		CPU:             req.CPU,
		Memory:          req.Memory,
		GPU:             req.GPU,
		Image:           req.Image,
		EnableRDMA:      req.EnableRDMA,
		DebugMode:       req.DebugMode,
		OutputDirectory: req.OutputDirectory,
		
		// 数据集和脚本
		DPODataset:     req.DPODataset,
		StartupScript:   req.StartupScript,
		DependencyFiles: dependencyFilesJSON,
		
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	// Save to database using GORM
	if err := GetDB().Create(&trainingJobDB).Error; err != nil {
		return fmt.Errorf("failed to save training job to database: %v", err)
	}

	log.Printf("Training job saved to database successfully: %s", jobID)
	return nil
}