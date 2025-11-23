package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"path"
	"path/filepath"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"
)

// Checkpoint represents a training checkpoint file
type Checkpoint struct {
	Name      string    `json:"name"`      // Checkpoint名称
	Path      string    `json:"path"`      // 相对路径
	Size      int64     `json:"size"`      // 文件大小(字节)
	SizeStr   string    `json:"sizeStr"`   // 格式化后的大小
	Step      int       `json:"step"`      // 训练步数
	Loss      float64   `json:"loss"`      // Loss值(如果有)
	Timestamp time.Time `json:"timestamp"` // 创建时间
}

// handleListCheckpointsHandler 列出训练任务的所有checkpoints
func handleListCheckpointsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Content-Type", "application/json")

	jobID := r.URL.Query().Get("id")
	if jobID == "" {
		http.Error(w, "Job ID is required", http.StatusBadRequest)
		return
	}

	// 获取训练任务信息
	job, err := GetTrainingJob(jobID)
	if err != nil {
		log.Printf("Failed to get training job %s: %v", jobID, err)
		respondJSON(w, http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   "Training job not found",
		})
		return
	}

	// 从CFS Data Accessor获取checkpoint列表
	// 优先使用outputDirectory，然后尝试job ID、job name、environment ID
	checkpoints, err := listCheckpointsFromCFSAccessor(jobID, job.Name, job.EnvironmentID, job.OutputDirectory)
	if err != nil {
		log.Printf("Failed to list checkpoints for job %s: %v", jobID, err)
		respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Failed to list checkpoints: " + err.Error(),
		})
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success":         true,
		"checkpoints":     checkpoints,
		"jobId":           jobID,
		"jobName":         job.Name,
		"environmentId":   job.EnvironmentID,
		"outputDirectory": job.OutputDirectory,
	})
}

// listCheckpointsFromCFSAccessor 从CFS Data Accessor Pod获取checkpoint列表
// 统一使用 jobName 作为checkpoint路径标识符
func listCheckpointsFromCFSAccessor(jobID, jobName, environmentID, outputDirectory string) ([]Checkpoint, error) {
	if currentClientset == nil {
		return nil, fmt.Errorf("Kubernetes client not initialized")
	}

	// 查找cfs-data-accessor Pod
	pods, err := currentClientset.CoreV1().Pods("rl").List(context.Background(), metav1.ListOptions{
		LabelSelector: "app=cfs-data-accessor",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list cfs-data-accessor pods: %w", err)
	}
	if len(pods.Items) == 0 {
		return nil, fmt.Errorf("cfs-data-accessor pod not found")
	}

	podName := pods.Items[0].Name
	
	// 统一使用 jobName 作为checkpoint路径，简化逻辑
	// 如果 outputDirectory 已配置且包含 jobName，使用它；否则使用标准的 jobName 路径
	var checkpointPath string
	
	if outputDirectory != "" && strings.Contains(outputDirectory, jobName) {
		// outputDirectory 已正确配置为 jobName 格式
		if strings.Contains(outputDirectory, "checkpoint") {
			checkpointPath = outputDirectory
		} else {
			checkpointPath = outputDirectory + "/checkpoint"
		}
		log.Printf("Using configured output directory: %s", checkpointPath)
	} else {
		// 统一使用 jobName 生成标准路径
		checkpointPath = fmt.Sprintf("/mnt/cfs-turbo/cfs/%s/checkpoint", jobName)
		log.Printf("Using standard jobName path: %s", checkpointPath)
	}

	// 执行ls命令列出checkpoint目录
	// 使用 ls -lt 按时间倒序排列，获取详细信息
	command := fmt.Sprintf("ls -lt %s 2>/dev/null | grep -v '^total' | awk '{print $9\":\"$5\":\"$6\" \"$7\" \"$8}'", checkpointPath)
	
	req := currentClientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace("rl").
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: "cfs-data-accessor",
			Command:   []string{"sh", "-c", command},
			Stdout:    true,
			Stderr:    true,
		}, scheme.ParameterCodec)

	executor, err := remotecommand.NewSPDYExecutor(currentRestConfig, "POST", req.URL())
	if err != nil {
		return nil, fmt.Errorf("failed to create executor: %w", err)
	}

	var stdout, stderr strings.Builder
	err = executor.StreamWithContext(context.Background(), remotecommand.StreamOptions{
		Stdout: &stdout,
		Stderr: &stderr,
	})

	if err != nil {
		log.Printf("Command execution error: %v, stderr: %s", err, stderr.String())
		// 如果目录不存在，返回空列表
		if strings.Contains(stderr.String(), "No such file or directory") {
			return []Checkpoint{}, nil
		}
		return nil, fmt.Errorf("failed to list checkpoints: %w", err)
	}

	// 解析输出
	checkpoints := []Checkpoint{}
	output := strings.TrimSpace(stdout.String())
	if output == "" {
		return checkpoints, nil
	}

	lines := strings.Split(output, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// 解析格式: filename:size:date
		parts := strings.SplitN(line, ":", 3)
		if len(parts) < 3 {
			continue
		}

		filename := parts[0]
		sizeStr := parts[1]
		dateStr := parts[2]

		// 跳过目录和特殊文件
		if filename == "." || filename == ".." || filename == "" {
			continue
		}

		// 解析大小
		var size int64
		fmt.Sscanf(sizeStr, "%d", &size)

		// 解析时间 (假设格式为 "Nov 20 15:30")
		timestamp := parseTimestamp(dateStr)

		// 尝试从文件名提取step信息 (例如: checkpoint-1000, step_1000.pt)
		step := extractStepFromFilename(filename)

		checkpoint := Checkpoint{
			Name:      filename,
			Path:      fmt.Sprintf("%s/%s", checkpointPath, filename),
			Size:      size,
			SizeStr:   formatSize(size),
			Step:      step,
			Loss:      0.0, // 暂时无法从文件名获取，可以后续扩展
			Timestamp: timestamp,
		}

		checkpoints = append(checkpoints, checkpoint)
	}

	return checkpoints, nil
}

// handleDownloadCheckpointHandler 下载checkpoint文件
func handleDownloadCheckpointHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	jobID := r.URL.Query().Get("id")
	checkpointPath := r.URL.Query().Get("path")
	
	if jobID == "" || checkpointPath == "" {
		http.Error(w, "Job ID and checkpoint path are required", http.StatusBadRequest)
		return
	}

	// 验证checkpoint路径是否包含完整路径
	// 如果路径是相对路径（不是完整路径），则需要从数据库获取job信息
	if !strings.HasPrefix(checkpointPath, "/mnt/cfs-turbo/cfs/") {
		// 获取训练任务信息
		job, err := GetTrainingJob(jobID)
		if err != nil {
			log.Printf("Failed to get training job %s: %v", jobID, err)
			http.Error(w, "Training job not found", http.StatusNotFound)
			return
		}
		
		// 统一使用 job name 构造路径
		checkpointPath = fmt.Sprintf("/mnt/cfs-turbo/cfs/%s/checkpoint/%s", job.Name, path.Base(checkpointPath))
	}

	// 使用cfs-data-accessor的HTTP服务下载文件
	filename := path.Base(checkpointPath)
	
	// 检查是否是目录（需要打包）
	// 先不设置Content-Disposition，让downloadFileFromCFSAccessor来决定
	isDirectory := !strings.Contains(filename, ".")
	
	if isDirectory {
		// 如果是目录，下载为tar.gz
		w.Header().Set("Content-Type", "application/gzip")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.tar.gz\"", filename))
	} else {
		// 如果是文件，设置为二进制流
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	}

	// 通过cfs-data-accessor服务下载
	err := downloadFileFromCFSAccessor(w, checkpointPath)
	if err != nil {
		log.Printf("Failed to download checkpoint %s: %v", checkpointPath, err)
		// 注意：如果已经开始写入响应，不能再设置错误状态
		// 这里只记录日志
		return
	}
}

// downloadFileFromCFSAccessor 从CFS Data Accessor通过HTTP下载文件
// 如果是目录，则自动打包成tar.gz
func downloadFileFromCFSAccessor(w http.ResponseWriter, filePath string) error {
	if currentClientset == nil {
		return fmt.Errorf("Kubernetes client not initialized")
	}

	// 查找cfs-data-accessor Pod
	pods, err := currentClientset.CoreV1().Pods("rl").List(context.Background(), metav1.ListOptions{
		LabelSelector: "app=cfs-data-accessor",
	})
	if err != nil {
		return fmt.Errorf("failed to list cfs-data-accessor pods: %w", err)
	}
	if len(pods.Items) == 0 {
		return fmt.Errorf("cfs-data-accessor pod not found")
	}

	podName := pods.Items[0].Name

	// 首先检查是文件还是目录
	checkCmd := fmt.Sprintf("if [ -d %s ]; then echo 'directory'; elif [ -f %s ]; then echo 'file'; else echo 'not_found'; fi", filePath, filePath)
	
	req := currentClientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace("rl").
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: "cfs-data-accessor",
			Command:   []string{"sh", "-c", checkCmd},
			Stdout:    true,
			Stderr:    false,
		}, scheme.ParameterCodec)

	executor, err := remotecommand.NewSPDYExecutor(currentRestConfig, "POST", req.URL())
	if err != nil {
		return fmt.Errorf("failed to create executor: %w", err)
	}

	var checkOutput strings.Builder
	err = executor.StreamWithContext(context.Background(), remotecommand.StreamOptions{
		Stdout: &checkOutput,
	})

	if err != nil {
		return fmt.Errorf("failed to check file type: %w", err)
	}

	fileType := strings.TrimSpace(checkOutput.String())
	log.Printf("File type for %s: %s", filePath, fileType)

	if fileType == "not_found" {
		return fmt.Errorf("file or directory not found: %s", filePath)
	}

	// 如果是目录，打包成tar.gz
	if fileType == "directory" {
		return downloadDirectoryAsTarGz(w, podName, filePath)
	}

	// 如果是文件，直接通过HTTP下载
	serviceURL := "http://cfs-data-accessor-service.rl.svc.cluster.local:8080"
	relativePath := strings.TrimPrefix(filePath, "/mnt/cfs-turbo/")
	downloadURL := fmt.Sprintf("%s/%s", serviceURL, relativePath)

	log.Printf("Downloading file from: %s", downloadURL)

	resp, err := http.Get(downloadURL)
	if err != nil {
		return fmt.Errorf("failed to request file: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed with status: %d", resp.StatusCode)
	}

	// 流式传输文件内容
	_, err = io.Copy(w, resp.Body)
	if err != nil {
		return fmt.Errorf("failed to stream file: %w", err)
	}

	return nil
}

// downloadDirectoryAsTarGz 将目录打包成tar.gz并流式传输
func downloadDirectoryAsTarGz(w http.ResponseWriter, podName, dirPath string) error {
	// 使用tar命令打包目录并通过stdout输出
	// -C 切换到父目录，只打包目录本身而不包含完整路径
	parentDir := filepath.Dir(dirPath)
	dirName := filepath.Base(dirPath)
	tarCmd := fmt.Sprintf("cd %s && tar czf - %s", parentDir, dirName)
	
	log.Printf("Creating tar.gz for directory: %s (command: %s)", dirPath, tarCmd)

	req := currentClientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace("rl").
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: "cfs-data-accessor",
			Command:   []string{"sh", "-c", tarCmd},
			Stdout:    true,
			Stderr:    true,
		}, scheme.ParameterCodec)

	executor, err := remotecommand.NewSPDYExecutor(currentRestConfig, "POST", req.URL())
	if err != nil {
		return fmt.Errorf("failed to create executor: %w", err)
	}

	var stderr strings.Builder
	err = executor.StreamWithContext(context.Background(), remotecommand.StreamOptions{
		Stdout: w,
		Stderr: &stderr,
	})

	if err != nil {
		log.Printf("Tar command error: %v, stderr: %s", err, stderr.String())
		return fmt.Errorf("failed to create tar.gz: %w", err)
	}

	if stderr.Len() > 0 {
		log.Printf("Tar command stderr: %s", stderr.String())
	}

	return nil
}

// handleDeleteCheckpointHandler 删除checkpoint文件
func handleDeleteCheckpointHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete && r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Content-Type", "application/json")

	jobID := r.URL.Query().Get("id")
	checkpointPath := r.URL.Query().Get("path")

	if jobID == "" || checkpointPath == "" {
		respondJSON(w, http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Job ID and checkpoint path are required",
		})
		return
	}

	// 验证checkpoint路径是否包含完整路径
	// 如果路径是相对路径，则需要从数据库获取job信息
	if !strings.HasPrefix(checkpointPath, "/mnt/cfs-turbo/cfs/") {
		// 获取训练任务信息
		job, err := GetTrainingJob(jobID)
		if err != nil {
			log.Printf("Failed to get training job %s: %v", jobID, err)
			respondJSON(w, http.StatusNotFound, map[string]interface{}{
				"success": false,
				"error":   "Training job not found",
			})
			return
		}
		
		// 统一使用 job name 构造路径
		checkpointPath = fmt.Sprintf("/mnt/cfs-turbo/cfs/%s/checkpoint/%s", job.Name, path.Base(checkpointPath))
	}

	// 通过CFS Data Accessor删除文件
	err := deleteCheckpointViaCFSAccessor(jobID, checkpointPath)
	if err != nil {
		log.Printf("Failed to delete checkpoint %s: %v", checkpointPath, err)
		respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Failed to delete checkpoint: " + err.Error(),
		})
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Checkpoint deleted successfully",
	})
}

// deleteCheckpointViaCFSAccessor 通过CFS Data Accessor删除checkpoint文件
func deleteCheckpointViaCFSAccessor(jobID, checkpointPath string) error {
	if currentClientset == nil {
		return fmt.Errorf("Kubernetes client not initialized")
	}

	// 查找cfs-data-accessor Pod
	pods, err := currentClientset.CoreV1().Pods("rl").List(context.Background(), metav1.ListOptions{
		LabelSelector: "app=cfs-data-accessor",
	})
	if err != nil {
		return fmt.Errorf("failed to list cfs-data-accessor pods: %w", err)
	}
	if len(pods.Items) == 0 {
		return fmt.Errorf("cfs-data-accessor pod not found")
	}

	podName := pods.Items[0].Name

	// 执行rm命令删除文件
	command := fmt.Sprintf("rm -f %s", checkpointPath)

	req := currentClientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace("rl").
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: "cfs-data-accessor",
			Command:   []string{"sh", "-c", command},
			Stdout:    true,
			Stderr:    true,
		}, scheme.ParameterCodec)

	executor, err := remotecommand.NewSPDYExecutor(currentRestConfig, "POST", req.URL())
	if err != nil {
		return fmt.Errorf("failed to create executor: %w", err)
	}

	var stdout, stderr strings.Builder
	err = executor.StreamWithContext(context.Background(), remotecommand.StreamOptions{
		Stdout: &stdout,
		Stderr: &stderr,
	})

	if err != nil {
		log.Printf("Delete command error: %v, stderr: %s", err, stderr.String())
		return fmt.Errorf("failed to delete checkpoint: %w", err)
	}

	return nil
}

// 辅助函数

// formatSize 格式化文件大小
func formatSize(size int64) string {
	const (
		KB = 1024
		MB = KB * 1024
		GB = MB * 1024
	)

	switch {
	case size >= GB:
		return fmt.Sprintf("%.2f GB", float64(size)/float64(GB))
	case size >= MB:
		return fmt.Sprintf("%.2f MB", float64(size)/float64(MB))
	case size >= KB:
		return fmt.Sprintf("%.2f KB", float64(size)/float64(KB))
	default:
		return fmt.Sprintf("%d B", size)
	}
}

// extractStepFromFilename 从文件名提取训练步数
func extractStepFromFilename(filename string) int {
	// 支持多种命名格式:
	// checkpoint-1000, step_1000.pt, checkpoint_step1000.pth, model-1000.bin
	var step int
	
	// 尝试多种模式
	patterns := []string{
		"checkpoint-%d",
		"step_%d",
		"step%d",
		"model-%d",
		"checkpoint_step%d",
	}

	for _, pattern := range patterns {
		if n, _ := fmt.Sscanf(filename, pattern, &step); n == 1 {
			return step
		}
	}

	return 0 // 无法提取步数
}

// parseTimestamp 解析时间戳字符串
func parseTimestamp(dateStr string) time.Time {
	// 尝试解析常见的ls输出格式
	// 格式1: "Nov 20 15:30"
	// 格式2: "Nov 20 2024"
	
	now := time.Now()
	layouts := []string{
		"Jan 2 15:04",
		"Jan 2 2006",
		"2006-01-02 15:04:05",
	}

	for _, layout := range layouts {
		if t, err := time.Parse(layout, dateStr); err == nil {
			// 如果没有年份，使用当前年份
			if t.Year() == 0 {
				t = time.Date(now.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), 0, time.Local)
			}
			return t
		}
	}

	// 如果无法解析，返回当前时间
	return now
}

// fileExists 检查文件是否存在于CFS存储中
func fileExists(filePath string) bool {
	if currentClientset == nil {
		return false
	}

	// 查找cfs-data-accessor Pod
	pods, err := currentClientset.CoreV1().Pods("rl").List(context.Background(), metav1.ListOptions{
		LabelSelector: "app=cfs-data-accessor",
	})
	if err != nil || len(pods.Items) == 0 {
		return false
	}

	podName := pods.Items[0].Name
	checkCmd := fmt.Sprintf("[ -f %s ] && echo 'exists' || echo 'not_found'", filePath)
	
	req := currentClientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace("rl").
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: "cfs-data-accessor",
			Command:   []string{"sh", "-c", checkCmd},
			Stdout:    true,
			Stderr:    false,
		}, scheme.ParameterCodec)
	
	executor, err := remotecommand.NewSPDYExecutor(currentRestConfig, "POST", req.URL())
	if err != nil {
		return false
	}
	
	var output strings.Builder
	err = executor.StreamWithContext(context.Background(), remotecommand.StreamOptions{
		Stdout: &output,
	})
	
	return err == nil && strings.TrimSpace(output.String()) == "exists"
}
