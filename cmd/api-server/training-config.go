package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v2"
)

// TrainingConfig represents training configuration structure
type TrainingConfig struct {
	BaseModels      []ConfigOption   `yaml:"base_models" json:"baseModels"`
	TrainingTypes   []ConfigOption   `yaml:"training_types" json:"trainingTypes"`
	TrainingMethods []TrainingMethod `yaml:"training_methods" json:"trainingMethods"`
	DPODatasets     []DatasetOption  `yaml:"dpo_datasets" json:"dpoDatasets"`
	CommonImages    []ConfigOption   `yaml:"common_images" json:"commonImages"`
}

// ConfigOption represents a basic configuration option
type ConfigOption struct {
	Label       string `yaml:"label" json:"label"`
	Value       string `yaml:"value" json:"value"`
	Description string `yaml:"description" json:"description"`
	Path        string `yaml:"path,omitempty" json:"path,omitempty"`
}

// TrainingMethod represents a training method with compatibility info
type TrainingMethod struct {
	Label           string   `yaml:"label" json:"label"`
	Value           string   `yaml:"value" json:"value"`
	Description     string   `yaml:"description" json:"description"`
	CompatibleTypes []string `yaml:"compatible_types" json:"compatibleTypes"`
}

// DatasetOption represents a dataset configuration option
type DatasetOption struct {
	Label       string `yaml:"label" json:"label"`
	Value       string `yaml:"value" json:"value"`
	Path        string `yaml:"path" json:"path"`
	Description string `yaml:"description" json:"description"`
	Format      string `yaml:"format" json:"format"`
}

var trainingConfig *TrainingConfig

// loadTrainingConfig loads training configuration from YAML file
func loadTrainingConfig() error {
	configPath := filepath.Join("configs", "training-config.yaml")
	
	// Check if file exists
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		log.Printf("Training config file not found at %s, using defaults", configPath)
		trainingConfig = getDefaultTrainingConfig()
		return nil
	}

	// Read YAML file
	data, err := ioutil.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("failed to read config file: %v", err)
	}

	// Parse YAML
	var config TrainingConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("failed to parse config file: %v", err)
	}

	trainingConfig = &config
	log.Printf("Training configuration loaded successfully from %s", configPath)
	return nil
}

// getDefaultTrainingConfig returns default configuration if file doesn't exist
func getDefaultTrainingConfig() *TrainingConfig {
	return &TrainingConfig{
		BaseModels: []ConfigOption{
			{Label: "Qwen3-8B", Value: "qwen3-8b", Description: "通义千问3代8B参数模型", Path: "/mnt/cfs-turbo/cfs/Qwen3-8B"},
		},
		TrainingTypes: []ConfigOption{
			{Label: "强化学习", Value: "reinforcement_learning", Description: "基于奖励信号的强化学习训练"},
		},
		TrainingMethods: []TrainingMethod{
			{Label: "RLHF_PPO", Value: "RLHF_PPO", Description: "基于人类反馈的强化学习近端策略优化", CompatibleTypes: []string{"reinforcement_learning"}},
		},
		DPODatasets: []DatasetOption{
			{Label: "AIME 2024", Value: "aime-2024", Path: "/mnt/cfs-turbo/cfs/rl/aime-2024.parquet", Description: "AIME 2024数学竞赛数据集", Format: "parquet"},
		},
		CommonImages: []ConfigOption{
			{Label: "Ray 2.7 + PyTorch", Value: "rayproject/ray-ml:2.7.0-py310-gpu", Description: "Ray 2.7.0 with PyTorch and GPU support"},
		},
	}
}

// handleGetTrainingConfig handles GET /api/training-config
func handleGetTrainingConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		respondJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{
			"error": "Method not allowed",
		})
		return
	}

	// Ensure config is loaded
	if trainingConfig == nil {
		if err := loadTrainingConfig(); err != nil {
			log.Printf("Failed to load training config: %v", err)
			respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
				"error": fmt.Sprintf("Failed to load training configuration: %v", err),
			})
			return
		}
	}

	respondJSON(w, http.StatusOK, trainingConfig)
}

// handleReloadTrainingConfig handles POST /api/training-config/reload
func handleReloadTrainingConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
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

	// Reload configuration
	if err := loadTrainingConfig(); err != nil {
		log.Printf("Failed to reload training config: %v", err)
		respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error": fmt.Sprintf("Failed to reload training configuration: %v", err),
		})
		return
	}

	log.Println("Training configuration reloaded successfully")
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Training configuration reloaded successfully",
		"config":  trainingConfig,
	})
}