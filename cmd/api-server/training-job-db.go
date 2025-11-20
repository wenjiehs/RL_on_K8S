package main

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"
)



// InitTrainingJobDB initializes the training job database
func InitTrainingJobDB() error {
	// Use GORM auto migration instead of raw SQL
	if err := GetDB().AutoMigrate(&TrainingJobDB{}); err != nil {
		return fmt.Errorf("failed to create training_jobs table: %w", err)
	}

	log.Println("Training jobs database initialized successfully")
	return nil
}

// SaveTrainingJob saves a training job to the database
func SaveTrainingJob(job TrainingJob) error {
	// Convert dependency files slice to JSON string
	dependencyFilesJSON := "[]"
	if len(job.DependencyFiles) > 0 {
		if files, err := json.Marshal(job.DependencyFiles); err == nil {
			dependencyFilesJSON = string(files)
		}
	}

	// Create database record
	dbJob := TrainingJobDB{
		ID:              job.ID,
		Name:            job.Name,
		Description:      job.Description,
		BaseModel:       job.BaseModel,
		TrainingType:    job.TrainingType,
		TrainingMethod:  job.TrainingMethod,
		Status:          job.Status,
		EnvironmentID:   job.EnvironmentID,
		CPU:             job.CPU,
		Memory:          job.Memory,
		GPU:             job.GPU,
		Image:           job.Image,
		EnableRDMA:      job.EnableRDMA,
		DebugMode:       job.DebugMode,
		OutputDirectory: job.OutputDirectory,
		DPODataset:     job.DPODataset,
		StartupScript:   job.StartupScript,
		DependencyFiles: dependencyFilesJSON,
		CreatedAt:       job.CreatedAt,
		UpdatedAt:       job.UpdatedAt,
	}

	if err := GetDB().Create(&dbJob).Error; err != nil {
		return fmt.Errorf("failed to save training job: %w", err)
	}

	log.Printf("Training job saved to database: %s", job.ID)
	return nil
}

// GetTrainingJobs retrieves all training jobs from the database
func GetTrainingJobs() ([]TrainingJob, error) {
	var dbJobs []TrainingJobDB
	
	// Get all jobs using GORM
	if err := GetDB().Find(&dbJobs).Error; err != nil {
		return nil, fmt.Errorf("failed to get training jobs: %w", err)
	}

	// Convert to TrainingJob format
	var jobs []TrainingJob
	for _, dbJob := range dbJobs {
		// Convert JSON string back to slice
		var dependencyFiles []string
		if dbJob.DependencyFiles != "" && dbJob.DependencyFiles != "[]" {
			if err := json.Unmarshal([]byte(dbJob.DependencyFiles), &dependencyFiles); err != nil {
				log.Printf("Failed to unmarshal dependency files: %v", err)
			}
		}

		job := TrainingJob{
			ID:              dbJob.ID,
			Name:            dbJob.Name,
			Description:      dbJob.Description,
			BaseModel:       dbJob.BaseModel,
			TrainingType:    dbJob.TrainingType,
			TrainingMethod:  dbJob.TrainingMethod,
			Status:          dbJob.Status,
			EnvironmentID:   dbJob.EnvironmentID,
			CPU:             dbJob.CPU,
			Memory:          dbJob.Memory,
			GPU:             dbJob.GPU,
			Image:           dbJob.Image,
			EnableRDMA:      dbJob.EnableRDMA,
			DebugMode:       dbJob.DebugMode,
			OutputDirectory: dbJob.OutputDirectory,
			DPODataset:     dbJob.DPODataset,
			StartupScript:   dbJob.StartupScript,
			DependencyFiles: dependencyFiles,
			CreatedAt:       dbJob.CreatedAt,
			UpdatedAt:       dbJob.UpdatedAt,
		}
		jobs = append(jobs, job)
	}

	return jobs, nil
}

// GetTrainingJob retrieves a specific training job from the database
func GetTrainingJob(jobID string) (TrainingJob, error) {
	var dbJob TrainingJobDB

	// Find job using GORM
	if err := GetDB().Where("id = ?", jobID).First(&dbJob).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return TrainingJob{}, fmt.Errorf("training job not found: %s", jobID)
		}
		return TrainingJob{}, fmt.Errorf("failed to get training job: %w", err)
	}

	// Convert JSON string back to slice
	var dependencyFiles []string
	if dbJob.DependencyFiles != "" && dbJob.DependencyFiles != "[]" {
		if err := json.Unmarshal([]byte(dbJob.DependencyFiles), &dependencyFiles); err != nil {
			log.Printf("Failed to unmarshal dependency files: %v", err)
		}
	}

	trainingJob := TrainingJob{
		ID:              dbJob.ID,
		Name:            dbJob.Name,
		Description:      dbJob.Description,
		BaseModel:       dbJob.BaseModel,
		TrainingType:    dbJob.TrainingType,
		TrainingMethod:  dbJob.TrainingMethod,
		Status:          dbJob.Status,
		EnvironmentID:   dbJob.EnvironmentID,
		CPU:             dbJob.CPU,
		Memory:          dbJob.Memory,
		GPU:             dbJob.GPU,
		Image:           dbJob.Image,
		EnableRDMA:      dbJob.EnableRDMA,
		DebugMode:       dbJob.DebugMode,
		OutputDirectory: dbJob.OutputDirectory,
		DPODataset:     dbJob.DPODataset,
		StartupScript:   dbJob.StartupScript,
		DependencyFiles: dependencyFiles,
		CreatedAt:       dbJob.CreatedAt,
		UpdatedAt:       dbJob.UpdatedAt,
	}

	return trainingJob, nil
}

// UpdateTrainingJobStatus updates the status of a training job
func UpdateTrainingJobStatus(jobID string, status string) error {
	result := GetDB().Model(&TrainingJobDB{}).Where("id = ?", jobID).Updates(map[string]interface{}{
		"status":     status,
		"updated_at": time.Now(),
	})
	
	if result.Error != nil {
		return fmt.Errorf("failed to update training job status: %w", result.Error)
	}
	
	if result.RowsAffected == 0 {
		return fmt.Errorf("training job not found: %s", jobID)
	}

	log.Printf("Training job status updated: %s -> %s", jobID, status)
	return nil
}

// DeleteTrainingJob deletes a training job from the database
func DeleteTrainingJob(jobID string) error {
	result := GetDB().Where("id = ?", jobID).Delete(&TrainingJobDB{})
	
	if result.Error != nil {
		return fmt.Errorf("failed to delete training job: %w", result.Error)
	}
	
	if result.RowsAffected == 0 {
		return fmt.Errorf("training job not found: %s", jobID)
	}

	log.Printf("Training job deleted: %s", jobID)
	return nil
}

// GetTrainingJobDB retrieves a specific training job from database (returns DB struct)
func GetTrainingJobDB(jobID string) (*TrainingJobDB, error) {
	var dbJob TrainingJobDB

	// Find job using GORM
	if err := GetDB().Where("id = ?", jobID).First(&dbJob).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("training job not found: %s", jobID)
		}
		return nil, fmt.Errorf("failed to get training job: %w", err)
	}

	return &dbJob, nil
}