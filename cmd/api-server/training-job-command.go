package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
)

// TrainingCommandConfig represents the configuration for generating training command
type TrainingCommandConfig struct {
	// 数据配置
	TrainFiles        string
	ValFiles          string
	TrainBatchSize    int
	MaxPromptLength   int
	MaxResponseLength int

	// 模型配置
	ModelPath string

	// 训练配置
	ActorLR           string
	CriticLR          string
	PPOMiniBatchSize  int
	PPOMicroBatchSize int

	// Rollout配置
	RolloutName    string
	TensorParallel int
	GPUMemoryUtil  float64

	// 算法配置
	KLCoef float64

	// Trainer配置
	Logger          string
	ValBeforeTrain  bool
	DefaultLocalDir string
	GPUsPerNode     int
	NNodes          int
	SaveFreq        int
	TestFreq        int
	TotalEpochs     int

	// 分布式配置
	Backend string

	// 日志文件
	LogFile string
}

// PreviewCommandRequest represents request to preview training command
type PreviewCommandRequest struct {
	JobID string `json:"jobId"`
}

// PreviewCommandResponse represents response with generated command
type PreviewCommandResponse struct {
	Success bool   `json:"success"`
	Command string `json:"command"`
	JobID   string `json:"jobId"`
	JobName string `json:"jobName"`
}

// handlePreviewTrainingCommand handles previewing the training command
func handlePreviewTrainingCommand(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		respondJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{
			"error": "Method not allowed",
		})
		return
	}

	// 解析请求
	var req PreviewCommandRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": fmt.Sprintf("Invalid request body: %v", err),
		})
		return
	}

	if req.JobID == "" {
		respondJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": "Job ID is required",
		})
		return
	}

	// 从数据库获取训练任务
	db := GetDB()
	if db == nil {
		respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error": "Database not initialized",
		})
		return
	}

	var job TrainingJobDB
	if err := db.Where("id = ?", req.JobID).First(&job).Error; err != nil {
		log.Printf("Failed to find training job %s: %v", req.JobID, err)
		respondJSON(w, http.StatusNotFound, map[string]interface{}{
			"error": "Training job not found",
		})
		return
	}

	// 生成训练命令
	command := generateTrainingCommand(&job)

	log.Printf("Generated training command preview for job %s", req.JobID)
	respondJSON(w, http.StatusOK, PreviewCommandResponse{
		Success: true,
		Command: command,
		JobID:   job.ID,
		JobName: job.Name,
	})
}

// generateTrainingCommand generates the VERL training command based on job configuration
// getDatasetPath 根据数据集value查找对应的路径
func getDatasetPath(datasetValue string) string {
	if trainingConfig == nil {
		log.Printf("Warning: training config not loaded, using dataset value as path: %s", datasetValue)
		return datasetValue
	}
	
	for _, dataset := range trainingConfig.DPODatasets {
		if dataset.Value == datasetValue {
			log.Printf("Found dataset path for %s: %s", datasetValue, dataset.Path)
			return dataset.Path
		}
	}
	
	log.Printf("Warning: dataset %s not found in config, using value as path", datasetValue)
	return datasetValue
}

// getModelPath 根据模型value查找对应的路径
func getModelPath(modelValue string) string {
	if trainingConfig == nil {
		log.Printf("Warning: training config not loaded, using model value as path: %s", modelValue)
		return modelValue
	}
	
	for _, model := range trainingConfig.BaseModels {
		if model.Value == modelValue {
			log.Printf("Found model path for %s: %s", modelValue, model.Path)
			return model.Path
		}
	}
	
	log.Printf("Warning: model %s not found in config, using value as path", modelValue)
	return modelValue
}

func generateTrainingCommand(job *TrainingJobDB) string {
	// 从配置中查找数据集路径
	datasetPath := getDatasetPath(job.DPODataset)
	
	// 从配置中查找模型路径
	modelPath := getModelPath(job.BaseModel)
	
	// 统一使用 jobName 作为输出目录的标识符
	outputDir := job.OutputDirectory
	if outputDir == "" {
		log.Printf("Warning: output directory not set for job %s, using job name: %s", job.ID, job.Name)
		outputDir = fmt.Sprintf("/mnt/cfs-turbo/cfs/%s/checkpoint", job.Name)
	}
	
	log.Printf("Generating training command for job %s:", job.ID)
	log.Printf("  - Job Name: %s", job.Name)
	log.Printf("  - Dataset: %s -> %s", job.DPODataset, datasetPath)
	log.Printf("  - Model: %s -> %s", job.BaseModel, modelPath)
	log.Printf("  - Output: %s", outputDir)
	log.Printf("  - Log file: %s/training.log", outputDir)

	// 基础配置
	config := TrainingCommandConfig{
		// 数据配置 - 使用从配置文件查找的路径
		TrainFiles:        datasetPath,
		ValFiles:          datasetPath,
		TrainBatchSize:    256,
		MaxPromptLength:   512,
		MaxResponseLength: 256,

		// 模型配置 - 使用从配置文件查找的路径
		ModelPath: modelPath,

		// 训练配置
		ActorLR:           "1e-6",
		CriticLR:          "1e-5",
		PPOMiniBatchSize:  64,
		PPOMicroBatchSize: 4,

		// Rollout配置
		RolloutName:    "vllm",
		TensorParallel: 1,
		GPUMemoryUtil:  0.3,

		// 算法配置
		KLCoef: 0.001,

		// Trainer配置
		Logger:          "[console]",
		ValBeforeTrain:  false,
		DefaultLocalDir: outputDir,
		GPUsPerNode:     job.GPU,
		NNodes:          2, // 默认2个节点
		SaveFreq:        1,
		TestFreq:        10,
		TotalEpochs:     8,

		// 分布式配置
		Backend: "nccl",

		// 日志文件
		LogFile: "verl_demo.log",
	}

	// 构建命令
	var cmd strings.Builder

	// 设置环境变量和基础命令
	cmd.WriteString("PYTHONUNBUFFERED=1 python3 -m verl.trainer.main_ppo \\\n")

	// 数据配置
	cmd.WriteString(fmt.Sprintf("    data.train_files=%s \\\n", config.TrainFiles))
	cmd.WriteString(fmt.Sprintf("    data.val_files=%s \\\n", config.ValFiles))
	cmd.WriteString(fmt.Sprintf("    data.train_batch_size=%d \\\n", config.TrainBatchSize))
	cmd.WriteString(fmt.Sprintf("    data.max_prompt_length=%d \\\n", config.MaxPromptLength))
	cmd.WriteString(fmt.Sprintf("    data.max_response_length=%d \\\n", config.MaxResponseLength))

	// Actor/Rollout/Ref配置
	cmd.WriteString(fmt.Sprintf("    actor_rollout_ref.model.path=%s \\\n", config.ModelPath))
	cmd.WriteString(fmt.Sprintf("    actor_rollout_ref.actor.optim.lr=%s \\\n", config.ActorLR))
	cmd.WriteString(fmt.Sprintf("    actor_rollout_ref.actor.ppo_mini_batch_size=%d \\\n", config.PPOMiniBatchSize))
	cmd.WriteString(fmt.Sprintf("    actor_rollout_ref.actor.ppo_micro_batch_size_per_gpu=%d \\\n", config.PPOMicroBatchSize))
	cmd.WriteString(fmt.Sprintf("    actor_rollout_ref.rollout.name=%s \\\n", config.RolloutName))
	cmd.WriteString("    actor_rollout_ref.rollout.log_prob_micro_batch_size_per_gpu=8 \\\n")
	cmd.WriteString(fmt.Sprintf("    actor_rollout_ref.rollout.tensor_model_parallel_size=%d \\\n", config.TensorParallel))
	cmd.WriteString(fmt.Sprintf("    actor_rollout_ref.rollout.gpu_memory_utilization=%.1f \\\n", config.GPUMemoryUtil))
	cmd.WriteString("    actor_rollout_ref.ref.log_prob_micro_batch_size_per_gpu=4 \\\n")

	// Critic配置
	cmd.WriteString(fmt.Sprintf("    critic.optim.lr=%s \\\n", config.CriticLR))
	cmd.WriteString(fmt.Sprintf("    critic.model.path=%s \\\n", config.ModelPath))
	cmd.WriteString(fmt.Sprintf("    critic.ppo_micro_batch_size_per_gpu=%d \\\n", config.PPOMicroBatchSize))

	// 算法配置
	cmd.WriteString(fmt.Sprintf("    algorithm.kl_ctrl.kl_coef=%.3f \\\n", config.KLCoef))

	// Trainer配置
	cmd.WriteString(fmt.Sprintf("    trainer.logger='%s' \\\n", config.Logger))
	cmd.WriteString(fmt.Sprintf("    trainer.val_before_train=%t \\\n", config.ValBeforeTrain))
	cmd.WriteString(fmt.Sprintf("    trainer.default_local_dir=%s \\\n", config.DefaultLocalDir))
	cmd.WriteString(fmt.Sprintf("    trainer.n_gpus_per_node=%d \\\n", config.GPUsPerNode))
	cmd.WriteString(fmt.Sprintf("    trainer.nnodes=%d \\\n", config.NNodes))
	cmd.WriteString(fmt.Sprintf("    trainer.save_freq=%d \\\n", config.SaveFreq))
	cmd.WriteString(fmt.Sprintf("    trainer.test_freq=%d \\\n", config.TestFreq))
	cmd.WriteString(fmt.Sprintf("    trainer.total_epochs=%d \\\n", config.TotalEpochs))

	// 分布式配置
	cmd.WriteString(fmt.Sprintf("    +distributed.backend=%s \\\n", config.Backend))

	// 日志重定向 - 输出到文件（与输出目录一致）
	logFile := fmt.Sprintf("%s/training.log", outputDir)
	cmd.WriteString(fmt.Sprintf("    2>&1 | tee %s", logFile))

	return cmd.String()
}