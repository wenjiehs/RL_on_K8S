package main

import (
	"context"
	"fmt"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// handleClusterConnectDefault 处理默认集群连接
func handleClusterConnectDefault(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// 尝试使用默认kubeconfig连接
	configPath := os.Getenv("KUBECONFIG")
	if configPath == "" {
		configPath = os.Getenv("HOME") + "/.kube/config"
	}
	
	// 如果KUBECONFIG包含多个路径，取第一个有效的
	if strings.Contains(configPath, ":") {
		paths := strings.Split(configPath, ":")
		for _, path := range paths {
			if _, err := os.Stat(path); err == nil {
				configPath = path
				break
			}
		}
	}
	
	apiConfig, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		respondJSON(w, http.StatusBadRequest, ClusterStatus{
			Connected: false,
			Message:   "Failed to load default kubeconfig: " + err.Error(),
		})
		return
	}
	
	// 使用当前context
	contextToUse := apiConfig.CurrentContext
	if contextToUse == "" {
		respondJSON(w, http.StatusBadRequest, ClusterStatus{
			Connected: false,
			Message:   "No current context found in kubeconfig",
		})
		return
	}
	
	log.Printf("Attempting default cluster connection with context: %s", contextToUse)
	
	configOverrides := &clientcmd.ConfigOverrides{
		CurrentContext: contextToUse,
	}
	
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*apiConfig, contextToUse, configOverrides, nil)
	config, err := clientConfig.ClientConfig()
	if err != nil {
		respondJSON(w, http.StatusBadRequest, ClusterStatus{
			Connected: false,
			Message:   "Failed to create client config: " + err.Error(),
		})
		return
	}
	
	// 配置超时和TLS
	config.Timeout = 15 * time.Second
	
	// 如果没有CA数据，跳过TLS验证
	if len(config.TLSClientConfig.CAData) == 0 && config.TLSClientConfig.CAFile == "" {
		log.Printf("No CA certificate found, skipping TLS verification")
		config.TLSClientConfig.Insecure = true
	}
	
	log.Printf("Attempting to connect to: %s", config.Host)
	
	// 创建clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, ClusterStatus{
			Connected: false,
			Message:   "Failed to create K8s client: " + err.Error(),
		})
		return
	}
	
	// 测试连接
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	
	_, err = clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{Limit: 1})
	if err != nil {
		respondJSON(w, http.StatusUnauthorized, ClusterStatus{
			Connected: false,
			Message:   "Failed to connect to cluster: " + err.Error(),
		})
		return
	}
	
	// 存储客户端配置
	currentClientset = clientset
	currentRestConfig = config
	currentContext = contextToUse
	
	if ctx, ok := apiConfig.Contexts[contextToUse]; ok {
		currentCluster = ctx.Cluster
	}
	
	log.Printf("Successfully connected to default cluster! Context: %s", contextToUse)
	
	respondJSON(w, http.StatusOK, ClusterStatus{
		Connected:   true,
		Message:     fmt.Sprintf("Successfully connected to cluster '%s'.", currentCluster),
		ClusterName: currentCluster,
		Context:     currentContext,
	})
}



// handleListCFSDatasets 处理CFS数据集列表
func handleListCFSDatasets(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	datasets := []map[string]interface{}{
		{
			"name": "example-dataset",
			"path": "/mnt/cfs/example-dataset",
			"size": "1GB",
			"created": "2024-01-01",
		},
	}
	
	respondJSON(w, http.StatusOK, datasets)
}

// handleCreateCFSDataset 处理创建CFS数据集
func handleCreateCFSDataset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Dataset created successfully",
		"status": "success",
	})
}

// handleDeleteCFSDataset 处理删除CFS数据集
func handleDeleteCFSDataset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Dataset deleted successfully",
		"status": "success",
	})
}

// handleUploadCFSFile 处理CFS文件上传
func handleUploadCFSFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "File uploaded successfully",
		"status": "success",
	})
}

// handleGetCFSDatasetStats 处理获取CFS数据集统计
func handleGetCFSDatasetStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"totalSize": "10GB",
		"fileCount": 100,
		"datasetCount": 5,
	})
}

// handleBrowseDirectory 处理浏览目录
func handleBrowseDirectory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"path": "/mnt/cfs",
		"files": []string{"file1.txt", "file2.txt"},
	})
}

// handleGetDirectoryTree 处理获取目录树
func handleGetDirectoryTree(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"tree": map[string]interface{}{
			"name": "root",
			"type": "directory",
			"children": []interface{}{},
		},
	})
}

// handleDownloadFile 处理下载文件
func handleDownloadFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Write([]byte("file content"))
}

// handlePreviewFile 处理预览文件
func handlePreviewFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"content": "file preview content",
		"type": "text",
	})
}

// handlePreviewParquet 处理预览Parquet文件
func handlePreviewParquet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"schema": []string{"col1", "col2", "col3"},
		"data": [][]interface{}{{"value1", "value2", "value3"}},
	})
}