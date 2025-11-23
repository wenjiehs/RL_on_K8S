package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/mux"
)

// TrainingJobListResponse represents the response for listing training jobs
type TrainingJobListResponse struct {
	Jobs  []TrainingJobResponse `json:"jobs"`
	Total int64                 `json:"total"`
}

// TrainingJobResponse represents a training job in API response
type TrainingJobResponse struct {
	ID              string    `json:"id"`
	Name            string    `json:"experimentName"` // 前端使用 experimentName
	Description     string    `json:"description,omitempty"`
	BaseModel       string    `json:"baseModel"`
	TrainingType    string    `json:"trainingType"`
	TrainingMethod  string    `json:"trainingMethod"`
	Status          string    `json:"status"`
	
	// 环境配置
	EnvironmentMode string `json:"environmentMode"`
	Namespace       string `json:"namespace"`
	CreateNamespace string `json:"createNamespace,omitempty"`
	EnvironmentID   string `json:"environmentId"`
	
	// 资源配置
	CPU             int    `json:"cpu"`
	Memory          int    `json:"memory"`
	GPU             int    `json:"gpu"`
	Image           string `json:"image"`
	EnableRDMA      bool   `json:"enableRDMA"`
	DebugMode       bool   `json:"debugMode"`
	OutputDirectory string `json:"outputDirectory"`
	
	// 数据集
	DPODataset      string   `json:"dpoDataset"`
	DataPath        string   `json:"dataPath"` // 兼容前端字段
	StartupScript   string   `json:"startupScript,omitempty"`
	DependencyFiles []string `json:"dependencyFiles,omitempty"`
	
	// 算法类型（兼容前端）
	AlgorithmType string `json:"algorithmType"`
	
	// 时间信息
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// handleListTrainingJobs handles listing all training jobs
func handleListTrainingJobs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// 获取查询参数
	query := r.URL.Query()
	status := query.Get("status")
	environmentMode := query.Get("environmentMode")
	namespace := query.Get("namespace")

	// 构建查询
	db := GetDB()
	if db == nil {
		respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error": "Database not initialized",
		})
		return
	}

	var jobs []TrainingJobDB
	dbQuery := db.Model(&TrainingJobDB{})

	// 应用筛选条件
	if status != "" {
		dbQuery = dbQuery.Where("status = ?", status)
	}
	if environmentMode != "" {
		dbQuery = dbQuery.Where("environment_mode = ?", environmentMode)
	}
	if namespace != "" {
		dbQuery = dbQuery.Where("namespace = ? OR create_namespace = ?", namespace, namespace)
	}

	// 按创建时间倒序排列
	dbQuery = dbQuery.Order("created_at DESC")

	// 执行查询
	if err := dbQuery.Find(&jobs).Error; err != nil {
		log.Printf("Failed to query training jobs: %v", err)
		respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to query training jobs",
		})
		return
	}

	// 转换为响应格式
	var jobResponses []TrainingJobResponse
	for _, job := range jobs {
		// 解析 dependency files
		var dependencyFiles []string
		if job.DependencyFiles != "" && job.DependencyFiles != "[]" {
			json.Unmarshal([]byte(job.DependencyFiles), &dependencyFiles)
		}

		jobResponse := TrainingJobResponse{
			ID:              job.ID,
			Name:            job.Name,
			Description:     job.Description,
			BaseModel:       job.BaseModel,
			TrainingType:    job.TrainingType,
			TrainingMethod:  job.TrainingMethod,
			Status:          job.Status,
			EnvironmentMode: job.EnvironmentMode,
			Namespace:       job.Namespace,
			CreateNamespace: job.CreateNamespace,
			EnvironmentID:   job.EnvironmentID,
			CPU:             job.CPU,
			Memory:          job.Memory,
			GPU:             job.GPU,
			Image:           job.Image,
			EnableRDMA:      job.EnableRDMA,
			DebugMode:       job.DebugMode,
			OutputDirectory: job.OutputDirectory,
			DPODataset:      job.DPODataset,
			DataPath:        job.DPODataset, // 兼容前端
			StartupScript:   job.StartupScript,
			DependencyFiles: dependencyFiles,
			AlgorithmType:   job.TrainingMethod, // 使用 trainingMethod 作为 algorithmType
			CreatedAt:       job.CreatedAt,
			UpdatedAt:       job.UpdatedAt,
		}
		jobResponses = append(jobResponses, jobResponse)
	}

	// 返回结果
	respondJSON(w, http.StatusOK, TrainingJobListResponse{
		Jobs:  jobResponses,
		Total: int64(len(jobResponses)),
	})
}

// handleGetTrainingJob handles getting a single training job
func handleGetTrainingJob(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// 从 query 参数中获取 job ID
	jobID := r.URL.Query().Get("id")
	if jobID == "" {
		// 如果没有 query 参数，尝试从 URL 路径中获取
		vars := mux.Vars(r)
		jobID = vars["id"]
		if jobID == "" {
			// 如果使用标准库 mux，从 URL 中提取
			parts := strings.Split(r.URL.Path, "/")
			if len(parts) > 0 {
				jobID = parts[len(parts)-1]
			}
		}
	}

	if jobID == "" {
		respondJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": "Job ID is required",
		})
		return
	}

	db := GetDB()
	if db == nil {
		respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error": "Database not initialized",
		})
		return
	}

	var job TrainingJobDB
	if err := db.Where("id = ?", jobID).First(&job).Error; err != nil {
		log.Printf("Failed to find training job %s: %v", jobID, err)
		respondJSON(w, http.StatusNotFound, map[string]interface{}{
			"error": "Training job not found",
		})
		return
	}

	// 解析 dependency files
	var dependencyFiles []string
	if job.DependencyFiles != "" && job.DependencyFiles != "[]" {
		json.Unmarshal([]byte(job.DependencyFiles), &dependencyFiles)
	}

	jobResponse := TrainingJobResponse{
		ID:              job.ID,
		Name:            job.Name,
		Description:     job.Description,
		BaseModel:       job.BaseModel,
		TrainingType:    job.TrainingType,
		TrainingMethod:  job.TrainingMethod,
		Status:          job.Status,
		EnvironmentMode: job.EnvironmentMode,
		Namespace:       job.Namespace,
		CreateNamespace: job.CreateNamespace,
		EnvironmentID:   job.EnvironmentID,
		CPU:             job.CPU,
		Memory:          job.Memory,
		GPU:             job.GPU,
		Image:           job.Image,
		EnableRDMA:      job.EnableRDMA,
		DebugMode:       job.DebugMode,
		OutputDirectory: job.OutputDirectory,
		DPODataset:      job.DPODataset,
		DataPath:        job.DPODataset,
		StartupScript:   job.StartupScript,
		DependencyFiles: dependencyFiles,
		AlgorithmType:   job.TrainingMethod,
		CreatedAt:       job.CreatedAt,
		UpdatedAt:       job.UpdatedAt,
	}

	respondJSON(w, http.StatusOK, jobResponse)
}

// handleDeleteTrainingJob handles deleting a training job
func handleDeleteTrainingJob(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// 从 URL 路径中获取 job ID
	vars := mux.Vars(r)
	jobID := vars["id"]
	if jobID == "" {
		parts := strings.Split(r.URL.Path, "/")
		if len(parts) > 0 {
			jobID = parts[len(parts)-1]
		}
	}

	if jobID == "" {
		respondJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": "Job ID is required",
		})
		return
	}

	db := GetDB()
	if db == nil {
		respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error": "Database not initialized",
		})
		return
	}

	// 检查任务是否存在
	var job TrainingJobDB
	if err := db.Where("id = ?", jobID).First(&job).Error; err != nil {
		log.Printf("Failed to find training job %s: %v", jobID, err)
		respondJSON(w, http.StatusNotFound, map[string]interface{}{
			"error": "Training job not found",
		})
		return
	}

	// 删除任务
	if err := db.Delete(&job).Error; err != nil {
		log.Printf("Failed to delete training job %s: %v", jobID, err)
		respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to delete training job",
		})
		return
	}

	log.Printf("Training job deleted successfully: %s", jobID)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Training job %s deleted successfully", jobID),
	})
}