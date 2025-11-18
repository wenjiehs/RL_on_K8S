package main

import (
"log"
"gorm.io/driver/sqlite"
"gorm.io/gorm"
)

var db *gorm.DB

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
