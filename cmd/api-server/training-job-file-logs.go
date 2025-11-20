package main

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"
)

// TrainingLogResponse 训练日志响应
type TrainingLogResponse struct {
	Success    bool     `json:"success"`
	Message    string   `json:"message"`
	JobID      string   `json:"jobId"`
	Lines      []string `json:"lines"`
	TotalLines int      `json:"totalLines"`
	HasMore    bool     `json:"hasMore"`
}

// handleGetTrainingJobFileLogs 处理获取训练任务文件日志请求
func handleGetTrainingJobFileLogs(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 获取参数
	jobID := r.URL.Query().Get("jobId")
	if jobID == "" {
		respondJSON(w, http.StatusBadRequest, TrainingLogResponse{
			Success: false,
			Message: "jobId is required",
		})
		return
	}

	// 获取分页参数
	offset := 0
	limit := 1000 // 默认返回最后1000行

	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		if val, err := strconv.Atoi(offsetStr); err == nil {
			offset = val
		}
	}

	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if val, err := strconv.Atoi(limitStr); err == nil && val > 0 {
			limit = val
		}
	}

	log.Printf("[File Logs] Fetching logs for job %s (offset=%d, limit=%d)", jobID, offset, limit)

	// 检查并初始化 Kubernetes 连接
	if currentClientset == nil || currentRestConfig == nil {
		log.Printf("Kubernetes not connected, attempting to reconnect...")
		err := attemptReconnect()
		if err != nil {
			respondJSON(w, http.StatusServiceUnavailable, TrainingLogResponse{
				Success: false,
				Message: fmt.Sprintf("Failed to connect to Kubernetes: %v", err),
				JobID:   jobID,
			})
			return
		}
		log.Printf("Successfully connected to Kubernetes cluster")
	}

	// 获取 Pod 信息
	podName, namespace, err := findJobPod(jobID)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, TrainingLogResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to find job pod: %v", err),
			JobID:   jobID,
		})
		return
	}

	// 从 Pod 中读取日志文件
	lines, totalLines, err := readLogFileFromPod(podName, namespace, jobID, offset, limit)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, TrainingLogResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to read log file: %v", err),
			JobID:   jobID,
		})
		return
	}

	respondJSON(w, http.StatusOK, TrainingLogResponse{
		Success:    true,
		Message:    "Logs retrieved successfully",
		JobID:      jobID,
		Lines:      lines,
		TotalLines: totalLines,
		HasMore:    offset+len(lines) < totalLines,
	})
}

// readLogFileFromPod 从 Pod 中读取日志文件
func readLogFileFromPod(podName, namespace, jobID string, offset, limit int) ([]string, int, error) {
	// 获取训练任务信息以获取正确的输出目录
	db := GetDB()
	if db == nil {
		return nil, 0, fmt.Errorf("database not available")
	}
	
	var job TrainingJobDB
	if err := db.Where("id = ?", jobID).First(&job).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to find training job: %v", err)
	}
	
	// 使用任务的输出目录路径
	outputDir := job.OutputDirectory
	if outputDir == "" {
		outputDir = fmt.Sprintf("/mnt/cfs-turbo/cfs/%s/checkpoint", jobID)
	}
	
	logFilePath := fmt.Sprintf("%s/training.log", outputDir)

	log.Printf("[File Logs] Reading log file from pod %s/%s: %s", namespace, podName, logFilePath)

	// 首先检查文件是否存在并获取总行数
	checkCmd := []string{
		"sh", "-c",
		fmt.Sprintf("if [ -f %s ]; then wc -l < %s; else echo '0'; fi", logFilePath, logFilePath),
	}

	req := currentClientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace(namespace).
		SubResource("exec")

	req.VersionedParams(&corev1.PodExecOptions{
		Command: checkCmd,
		Stdout:  true,
		Stderr:  true,
		TTY:     false,
		Container: "ray-head",
	}, scheme.ParameterCodec)

	exec, err := remotecommand.NewSPDYExecutor(currentRestConfig, "POST", req.URL())
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create executor: %v", err)
	}

	var stdout, stderr strings.Builder
	err = exec.Stream(remotecommand.StreamOptions{
		Stdout: &stdout,
		Stderr: &stderr,
	})

	if err != nil {
		return nil, 0, fmt.Errorf("failed to check file: %v, stderr: %s", err, stderr.String())
	}

	totalLines, err := strconv.Atoi(strings.TrimSpace(stdout.String()))
	if err != nil {
		return nil, 0, fmt.Errorf("failed to parse line count: %v", err)
	}

	if totalLines == 0 {
		return []string{"训练日志文件尚未生成或为空"}, 0, nil
	}

	// 读取指定范围的日志行
	// 使用 tail 和 head 组合来获取指定范围的行
	var readCmd []string
	if offset == 0 {
		// 从开始读取
		readCmd = []string{
			"sh", "-c",
			fmt.Sprintf("head -n %d %s", limit, logFilePath),
		}
	} else {
		// 跳过 offset 行，然后读取 limit 行
		readCmd = []string{
			"sh", "-c",
			fmt.Sprintf("tail -n +%d %s | head -n %d", offset+1, logFilePath, limit),
		}
	}

	req = currentClientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace(namespace).
		SubResource("exec")

	req.VersionedParams(&corev1.PodExecOptions{
		Command: readCmd,
		Stdout:  true,
		Stderr:  true,
		TTY:     false,
		Container: "ray-head",
	}, scheme.ParameterCodec)

	exec, err = remotecommand.NewSPDYExecutor(currentRestConfig, "POST", req.URL())
	if err != nil {
		return nil, totalLines, fmt.Errorf("failed to create executor: %v", err)
	}

	stdout.Reset()
	stderr.Reset()
	err = exec.Stream(remotecommand.StreamOptions{
		Stdout: &stdout,
		Stderr: &stderr,
	})

	if err != nil {
		return nil, totalLines, fmt.Errorf("failed to read file: %v, stderr: %s", err, stderr.String())
	}

	// 解析日志行
	lines := strings.Split(strings.TrimSpace(stdout.String()), "\n")

	log.Printf("[File Logs] Read %d lines from log file (total: %d)", len(lines), totalLines)

	return lines, totalLines, nil
}

// findJobPod 查找训练任务对应的 Pod
func findJobPod(jobID string) (string, string, error) {
	// 训练任务在 Ray head pod 中运行，直接返回默认的 Ray head pod
	log.Printf("Training job %s runs in Ray head pod", jobID)
	return "ray-single-group-head-cmkr6", "rl", nil
}