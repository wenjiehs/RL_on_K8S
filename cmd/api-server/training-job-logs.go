package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// GetLogsRequest 获取日志请求参数
type GetLogsRequest struct {
	JobID string `json:"jobId"`
	Lines int    `json:"lines"`     // 返回最后N行，默认100
	Since string `json:"since"`     // 时间范围，如"1h", "30m"
	Level string `json:"level"`     // 日志级别过滤
}

// GetLogsResponse 获取日志响应
type GetLogsResponse struct {
	Success   bool     `json:"success"`
	Message   string   `json:"message"`
	Logs      []string `json:"logs"`
	PodName   string   `json:"podName"`
	Namespace string   `json:"namespace"`
	Total     int      `json:"total"`
}

// handleGetTrainingJobLogs 处理获取训练任务日志请求
func handleGetTrainingJobLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json")

	// 从context中获取jobId
	jobIDValue := r.Context().Value("jobID")
	if jobIDValue == nil {
		respondJSON(w, http.StatusBadRequest, GetLogsResponse{
			Success: false,
			Message: "Job ID is required",
		})
		return
	}

	jobID := jobIDValue.(string)
	if jobID == "" {
		respondJSON(w, http.StatusBadRequest, GetLogsResponse{
			Success: false,
			Message: "Job ID is required",
		})
		return
	}

	// 解析查询参数
	query := r.URL.Query()
	lines := 100 // 默认100行
	if linesStr := query.Get("lines"); linesStr != "" {
		if parsedLines, err := strconv.Atoi(linesStr); err == nil && parsedLines > 0 {
			lines = parsedLines
		}
	}

	since := query.Get("since")
	level := query.Get("level")

	log.Printf("Getting logs for job %s: lines=%d, since=%s, level=%s", jobID, lines, since, level)

	// 获取训练任务信息
	job, err := GetTrainingJobDB(jobID)
	if err != nil {
		respondJSON(w, http.StatusNotFound, GetLogsResponse{
			Success: false,
			Message: fmt.Sprintf("Training job not found: %v", err),
		})
		return
	}

	// 查找Ray Head Pod
	podName, namespace, err := findRayHeadPodForJob(job)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, GetLogsResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to find Ray head pod: %v", err),
		})
		return
	}

	// 获取Pod日志
	logs, err := getPodLogs(namespace, podName, lines, since, level)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, GetLogsResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to get pod logs: %v", err),
		})
		return
	}

	log.Printf("Retrieved %d log lines for job %s from pod %s/%s", len(logs), jobID, namespace, podName)

	// 返回成功响应
	respondJSON(w, http.StatusOK, GetLogsResponse{
		Success:   true,
		Message:   "Logs retrieved successfully",
		Logs:      logs,
		PodName:   podName,
		Namespace: namespace,
		Total:     len(logs),
	})
}

// getPodLogs 获取Pod日志
func getPodLogs(namespace, podName string, lines int, since, level string) ([]string, error) {
	ctx := context.Background()

	// 构建日志选项
	logOptions := &corev1.PodLogOptions{
		Container: "ray-head",
		Follow:    false,
		TailLines: int64Ptr(int64(lines)),
	}

	// 处理时间范围
	if since != "" {
		if duration, err := time.ParseDuration(since); err == nil {
			sinceTime := time.Now().Add(-duration)
			logOptions.SinceTime = &metav1.Time{Time: sinceTime}
		}
	}

	// 获取日志
	req := currentClientset.CoreV1().Pods(namespace).GetLogs(podName, logOptions)
	podLogs, err := req.Stream(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get log stream: %w", err)
	}
	defer podLogs.Close()

	// 读取日志内容
	var logs []string
	scanner := bufio.NewScanner(podLogs)
	for scanner.Scan() {
		line := scanner.Text()
		
		// 应用日志级别过滤
		if level != "" && !strings.Contains(strings.ToUpper(line), strings.ToUpper(level)) {
			continue
		}
		
		logs = append(logs, line)
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("failed to read log stream: %w", err)
	}

	return logs, nil
}

// handleDownloadTrainingJobLogs 处理下载训练任务日志请求
func handleDownloadTrainingJobLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	// 解析请求
	var req GetLogsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request: %v", err), http.StatusBadRequest)
		return
	}

	if req.JobID == "" {
		http.Error(w, "Job ID is required", http.StatusBadRequest)
		return
	}

	// 获取训练任务信息
	job, err := GetTrainingJobDB(req.JobID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Training job not found: %v", err), http.StatusNotFound)
		return
	}

	// 查找Ray Head Pod
	podName, namespace, err := findRayHeadPodForJob(job)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to find Ray head pod: %v", err), http.StatusInternalServerError)
		return
	}

	// 获取所有日志（限制最大行数）
	maxLines := 10000
	if req.Lines > 0 && req.Lines < maxLines {
		maxLines = req.Lines
	}

	logs, err := getPodLogs(namespace, podName, maxLines, req.Since, req.Level)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get pod logs: %v", err), http.StatusInternalServerError)
		return
	}

	// 设置下载响应头
	filename := fmt.Sprintf("training-logs-%s-%s.txt", req.JobID, time.Now().Format("20060102-150405"))
	w.Header().Set("Content-Type", "text/plain")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	// 写入日志内容
	for _, line := range logs {
		fmt.Fprintln(w, line)
	}

	log.Printf("Downloaded %d log lines for job %s", len(logs), req.JobID)
}

// handleStreamTrainingJobLogs 处理流式日志请求 (WebSocket)
func handleStreamTrainingJobLogs(w http.ResponseWriter, r *http.Request) {
	// 检查是否为WebSocket升级请求
	if r.Header.Get("Upgrade") != "websocket" {
		http.Error(w, "This endpoint requires WebSocket connection", http.StatusBadRequest)
		return
	}

	// 从URL路径中提取jobId
	log.Printf("WebSocket URL path: %s", r.URL.Path)
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	log.Printf("Path parts: %v", pathParts)
	if len(pathParts) < 4 {
		http.Error(w, "Invalid URL format, expected: /ws/training-jobs/{jobId}/logs", http.StatusBadRequest)
		return
	}

	jobID := pathParts[2]
	if jobID == "" {
		http.Error(w, "Job ID is required", http.StatusBadRequest)
		return
	}

	log.Printf("WebSocket log streaming requested for job %s", jobID)

	// 获取训练任务信息
	job, err := GetTrainingJobDB(jobID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Training job not found: %v", err), http.StatusNotFound)
		return
	}

	// 查找Ray Head Pod
	podName, namespace, err := findRayHeadPodForJob(job)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to find Ray head pod: %v", err), http.StatusInternalServerError)
		return
	}

	// 升级到WebSocket连接
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade to WebSocket: %v", err)
		return
	}
	defer conn.Close()

	log.Printf("WebSocket connection established for job %s, pod %s/%s", jobID, namespace, podName)

	// 启动日志流
	streamPodLogs(conn, namespace, podName, jobID)
}

// streamPodLogs 流式传输Pod日志
func streamPodLogs(conn *websocket.Conn, namespace, podName, jobID string) {
	// 使用较短的超时context，避免长时间阻塞
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// 设置连接读取超时
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetWriteDeadline(time.Now().Add(10 * time.Second))

	// 构建日志选项
	logOptions := &corev1.PodLogOptions{
		Container: "ray-head",
		Follow:    true,
		TailLines: int64Ptr(100), // 先获取最后100行
	}

	// 获取日志流
	req := currentClientset.CoreV1().Pods(namespace).GetLogs(podName, logOptions)
	podLogs, err := req.Stream(ctx)
	if err != nil {
		log.Printf("Failed to get log stream for job %s: %v", jobID, err)
		conn.WriteJSON(map[string]interface{}{
			"type":    "error",
			"message": fmt.Sprintf("Failed to get log stream: %v", err),
		})
		return
	}
	defer podLogs.Close()

	log.Printf("Started streaming logs for job %s", jobID)

	// 发送连接成功消息
	if err := conn.WriteJSON(map[string]interface{}{
		"type":    "connected",
		"message": "Log streaming started",
		"podName": podName,
		"namespace": namespace,
	}); err != nil {
		log.Printf("Failed to send connected message for job %s: %v", jobID, err)
		return
	}

	// 读取并发送日志
	scanner := bufio.NewScanner(podLogs)
	
	// 添加ping机制保持连接，但降低频率
	pingTicker := time.NewTicker(45 * time.Second)
	defer pingTicker.Stop()
	
	// 添加pong处理
	conn.SetPongHandler(func(appData string) error {
		log.Printf("Received pong from client for job %s", jobID)
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})
	
	for {
		select {
		case <-ctx.Done():
			log.Printf("Context cancelled for job %s: %v", jobID, ctx.Err())
			conn.WriteJSON(map[string]interface{}{
				"type":    "ended",
				"message": "Log streaming timeout",
				"timestamp": time.Now().Format(time.RFC3339),
			})
			return
			
		case <-pingTicker.C:
			// 发送ping保持连接
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("Failed to send ping for job %s: %v", jobID, err)
				return
			}
			
		default:
			if scanner.Scan() {
				line := scanner.Text()
				
				// 发送日志行
				conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
				err := conn.WriteJSON(map[string]interface{}{
					"type":    "log",
					"content": line,
					"timestamp": time.Now().Format(time.RFC3339),
				})
				
				if err != nil {
					log.Printf("Failed to send log line for job %s: %v", jobID, err)
					return
				}
			} else {
				// 扫描结束或出错
				if err := scanner.Err(); err != nil {
					log.Printf("Scanner error for job %s: %v", jobID, err)
					conn.WriteJSON(map[string]interface{}{
						"type":    "error",
						"message": fmt.Sprintf("Error reading log stream: %v", err),
					})
				}
				goto done
			}
		}
	}
	
done:

	// 发送结束消息
	conn.WriteJSON(map[string]interface{}{
		"type":    "ended",
		"message": "Log streaming completed",
		"timestamp": time.Now().Format(time.RFC3339),
	})

	log.Printf("Log streaming ended for job %s", jobID)
}

// int64Ptr 返回int64指针
func int64Ptr(i int64) *int64 {
	return &i
}