package main

import (
	"net/http"
)

// handleDeleteFile 处理删除文件
func handleDeleteFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "File deleted successfully",
		"status": "success",
	})
}

// handleStorageStatus 处理存储状态
func handleStorageStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"status": "connected",
		"capacity": "10TB",
		"used": "1TB",
		"available": "9TB",
	})
}

// handleStorageConfig 处理存储配置
func handleStorageConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"cfs_host": "10.32.5.135",
		"cfs_path": "/cfs/rl-data",
		"fsid": "83d8ea56",
	})
}

// handleInitializeStorage 处理初始化存储
func handleInitializeStorage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Storage initialized successfully",
		"status": "success",
	})
}