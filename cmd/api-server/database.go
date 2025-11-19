package main

import (
	"log"
	"time"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var db *gorm.DB

// TrainingJob represents a training job (for API responses)
type TrainingJob struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Description      string    `json:"description,omitempty"`
	BaseModel       string    `json:"baseModel"`
	TrainingType    string    `json:"trainingType"`
	TrainingMethod  string    `json:"trainingMethod"`
	Status          string    `json:"status"`
	EnvironmentID   string    `json:"environmentId"`
	CPU             int       `json:"cpu"`
	Memory          int       `json:"memory"`
	GPU             int       `json:"gpu"`
	Image           string    `json:"image"`
	EnableRDMA      bool      `json:"enableRDMA"`
	DebugMode       bool      `json:"debugMode"`
	OutputDirectory string    `json:"outputDirectory"`
	DPODataset     string    `json:"dpoDataset"`
	StartupScript   string    `json:"startupScript,omitempty"`
	DependencyFiles []string  `json:"dependencyFiles,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// TrainingJobDB represents a training job in the database (for GORM)
type TrainingJobDB struct {
	ID              string    `gorm:"primaryKey;column:id"`
	Name            string    `gorm:"column:name"`
	Description      string    `gorm:"column:description"`
	BaseModel       string    `gorm:"column:base_model"`
	TrainingType    string    `gorm:"column:training_type"`
	TrainingMethod  string    `gorm:"column:training_method"`
	Status          string    `gorm:"column:status"`
	EnvironmentID   string    `gorm:"column:environment_id"`
	CPU             int       `gorm:"column:cpu"`
	Memory          int       `gorm:"column:memory"`
	GPU             int       `gorm:"column:gpu"`
	Image           string    `gorm:"column:image"`
	EnableRDMA      bool      `gorm:"column:enable_rdma"`
	DebugMode       bool      `gorm:"column:debug_mode"`
	OutputDirectory string    `gorm:"column:output_directory"`
	DPODataset     string    `gorm:"column:dpo_dataset"`
	StartupScript   string    `gorm:"column:startup_script"`
	DependencyFiles string    `gorm:"column:dependency_files"`
	CreatedAt       time.Time `gorm:"column:created_at"`
	UpdatedAt       time.Time `gorm:"column:updated_at"`
}

// TableName specifies table name for GORM
func (TrainingJobDB) TableName() string {
	return "training_jobs"
}

func InitDatabase() error {
	database, err := gorm.Open(sqlite.Open("training.db"), &gorm.Config{})
	if err != nil {
		log.Printf("Failed to connect to database: %v", err)
		return err
	}

	db = database
	log.Printf("Database connected successfully (SQLite)")
	return nil
}

func CloseDatabase() {
	sqlDB, _ := db.DB()
	if sqlDB != nil {
		sqlDB.Close()
	}
}

func GetDB() *gorm.DB {
	return db
}

// AutoMigrate runs database auto migration
func AutoMigrate() error {
	if db == nil {
		return nil
	}

	// Auto migrate all models
	if err := db.AutoMigrate(
		&Environment{},
		&TrainingJobDB{},
	); err != nil {
		log.Printf("Failed to auto migrate database: %v", err)
		return err
	}

	log.Println("Database auto migration completed successfully")
	return nil
}