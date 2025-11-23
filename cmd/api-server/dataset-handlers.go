package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"
)

// FileEntry 文件条目信息
type FileEntry struct {
	Name      string `json:"name"`      // 文件名
	Path      string `json:"path"`      // 完整路径
	IsDir     bool   `json:"isDir"`     // 是否为目录
	Size      int64  `json:"size"`      // 文件大小（字节）
	ModTime   string `json:"modTime"`   // 修改时间
	Extension string `json:"extension"` // 文件扩展名
}

// FilePreviewResponse 文件预览响应
type FilePreviewResponse struct {
	Type     string      `json:"type"`     // text, parquet, unsupported
	Content  string      `json:"content"`  // 文本内容
	Size     int64       `json:"size"`     // 文件大小
	Lines    int         `json:"lines"`    // 行数（文本文件）
	Schema   interface{} `json:"schema"`   // Schema（Parquet文件）
	Preview  interface{} `json:"preview"`  // 预览数据
	RowCount int         `json:"rowCount"` // 行数（Parquet文件）
}

// ErrorResponse 错误响应
type ErrorResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
	Code    string `json:"code"`
}

// SuccessResponse 成功响应
type SuccessResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Path    string `json:"path,omitempty"`
}

// validateDatasetPath 验证数据集路径安全性
func validateDatasetPath(path string) error {
	// 检查路径前缀
	if !strings.HasPrefix(path, "/cfs/") && !strings.HasPrefix(path, "/mnt/cfs-turbo/cfs/") {
		return errors.New("invalid path prefix")
	}

	// 检查危险字符
	if strings.Contains(path, "..") {
		return errors.New("path traversal detected")
	}

	// 清理路径
	cleanPath := filepath.Clean(path)
	if cleanPath != path {
		return errors.New("invalid path format")
	}

	return nil
}

// convertToMountPath 转换为容器内挂载路径
func convertToMountPath(path string) string {
	// 如果已经是挂载路径，直接返回
	if strings.HasPrefix(path, "/mnt/cfs-turbo/") {
		return path
	}
	
	// 将 /cfs/rl-data 转换为 /mnt/cfs-turbo/rl
	if strings.HasPrefix(path, "/cfs/rl-data") {
		return strings.Replace(path, "/cfs/rl-data", "/mnt/cfs-turbo/rl", 1)
	}
	
	// 将 /cfs/ 转换为 /mnt/cfs-turbo/cfs/
	if strings.HasPrefix(path, "/cfs/") {
		return strings.Replace(path, "/cfs/", "/mnt/cfs-turbo/cfs/", 1)
	}
	
	return path
}

// getCFSDataAccessorPod 获取 CFS Data Accessor Pod
func getCFSDataAccessorPod() (string, error) {
	if currentClientset == nil {
		return "", errors.New("kubernetes client not initialized")
	}

	pods, err := currentClientset.CoreV1().Pods("rl").List(context.Background(), metav1.ListOptions{
		LabelSelector: "app=cfs-data-accessor",
	})
	if err != nil {
		return "", fmt.Errorf("failed to list pods: %v", err)
	}

	if len(pods.Items) == 0 {
		return "", errors.New("cfs-data-accessor pod not found")
	}

	return pods.Items[0].Name, nil
}

// execCommandInPod 在 Pod 中执行命令
func execCommandInPod(podName, command string, timeout time.Duration) (string, error) {
	if currentClientset == nil || currentRestConfig == nil {
		return "", errors.New("kubernetes client not initialized")
	}

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
		return "", fmt.Errorf("failed to create executor: %v", err)
	}

	var stdout, stderr strings.Builder
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	err = executor.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdout: &stdout,
		Stderr: &stderr,
	})

	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return "", fmt.Errorf("command timeout after %v", timeout)
		}
		return "", fmt.Errorf("command failed: %v, stderr: %s", err, stderr.String())
	}

	if stderr.String() != "" {
		log.Printf("Command stderr: %s", stderr.String())
	}

	return stdout.String(), nil
}

// handleDatasetBrowse 处理目录浏览请求
func handleDatasetBrowse(w http.ResponseWriter, r *http.Request) {
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
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   "Method not allowed",
			Code:    "METHOD_NOT_ALLOWED",
		})
		return
	}

	// 获取路径参数
	path := r.URL.Query().Get("path")
	if path == "" {
		path = "/cfs/rl-data"
	}

	// 验证路径安全性
	if err := validateDatasetPath(path); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   err.Error(),
			Code:    "PATH_INVALID",
		})
		return
	}

	// 转换为挂载路径
	mountPath := convertToMountPath(path)
	log.Printf("Browsing path: %s (mount: %s)", path, mountPath)

	// 获取 CFS Pod
	podName, err := getCFSDataAccessorPod()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   err.Error(),
			Code:    "POD_NOT_FOUND",
		})
		return
	}

	// 执行 ls 命令列出文件
	// 使用 stat 命令获取更详细的文件信息
	command := fmt.Sprintf(`
		if [ ! -d "%s" ]; then
			echo "ERROR: Directory not found: %s"
			exit 1
		fi
		cd "%s" && ls -A | while read file; do
			if [ -z "$file" ]; then
				continue
			fi
			if [ -d "$file" ]; then
				echo "DIR|$file|0|$(stat -c %%Y "$file" 2>/dev/null || echo 0)"
			else
				echo "FILE|$file|$(stat -c %%s "$file" 2>/dev/null || echo 0)|$(stat -c %%Y "$file" 2>/dev/null || echo 0)"
			fi
		done
	`, mountPath, mountPath, mountPath)

	output, err := execCommandInPod(podName, command, 10*time.Second)
	if err != nil {
		log.Printf("Failed to execute ls command: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to list directory: %v", err),
			Code:    "EXEC_FAILED",
		})
		return
	}

	if strings.HasPrefix(output, "ERROR:") {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   strings.TrimPrefix(output, "ERROR: "),
			Code:    "FILE_NOT_FOUND",
		})
		return
	}

	// 解析输出
	var files []FileEntry
	lines := strings.Split(strings.TrimSpace(output), "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}

		parts := strings.Split(line, "|")
		if len(parts) != 4 {
			log.Printf("Invalid line format: %s", line)
			continue
		}

		fileType := parts[0]
		name := parts[1]
		sizeStr := parts[2]
		modTimeStr := parts[3]

		// 跳过 . 和 ..
		if name == "." || name == ".." {
			continue
		}

		size, _ := strconv.ParseInt(sizeStr, 10, 64)
		modTimeUnix, _ := strconv.ParseInt(modTimeStr, 10, 64)
		modTime := time.Unix(modTimeUnix, 0).Format("2006-01-02 15:04:05")

		isDir := fileType == "DIR"
		// 将挂载路径转换回前端使用的路径
		var filePath string
		if strings.HasPrefix(mountPath, "/mnt/cfs-turbo/rl") {
			// /mnt/cfs-turbo/rl -> /cfs/rl-data
			filePath = filepath.Join(strings.Replace(mountPath, "/mnt/cfs-turbo/rl", "/cfs/rl-data", 1), name)
		} else {
			// /mnt/cfs-turbo/cfs -> /cfs
			filePath = filepath.Join(strings.Replace(mountPath, "/mnt/cfs-turbo", "", 1), name)
		}
		extension := ""
		if !isDir {
			extension = filepath.Ext(name)
		}

		files = append(files, FileEntry{
			Name:      name,
			Path:      filePath,
			IsDir:     isDir,
			Size:      size,
			ModTime:   modTime,
			Extension: extension,
		})
	}

	// 返回文件列表
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(files)
	log.Printf("Successfully browsed %s, found %d items", path, len(files))
}

// handleDatasetPreview 处理文件预览请求
func handleDatasetPreview(w http.ResponseWriter, r *http.Request) {
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
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   "Method not allowed",
			Code:    "METHOD_NOT_ALLOWED",
		})
		return
	}

	// 获取路径参数
	path := r.URL.Query().Get("path")
	if path == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   "Path parameter is required",
			Code:    "PATH_REQUIRED",
		})
		return
	}

	// 验证路径安全性
	if err := validateDatasetPath(path); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   err.Error(),
			Code:    "PATH_INVALID",
		})
		return
	}

	// 转换为挂载路径
	mountPath := convertToMountPath(path)
	log.Printf("Previewing file: %s (mount: %s)", path, mountPath)

	// 获取 CFS Pod
	podName, err := getCFSDataAccessorPod()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   err.Error(),
			Code:    "POD_NOT_FOUND",
		})
		return
	}

	// 检查文件是否存在并获取大小
	checkCommand := fmt.Sprintf(`
		if [ ! -f "%s" ]; then
			echo "ERROR: File not found"
			exit 1
		fi
		stat -c %%s "%s"
	`, mountPath, mountPath)

	sizeOutput, err := execCommandInPod(podName, checkCommand, 10*time.Second)
	if err != nil || strings.HasPrefix(sizeOutput, "ERROR:") {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   "File not found",
			Code:    "FILE_NOT_FOUND",
		})
		return
	}

	fileSize, _ := strconv.ParseInt(strings.TrimSpace(sizeOutput), 10, 64)
	
	// 检查文件大小（限制预览 1MB）
	const maxPreviewSize = 1024 * 1024 // 1MB
	if fileSize > maxPreviewSize {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   fmt.Sprintf("File too large for preview (max 1MB, actual %d bytes)", fileSize),
			Code:    "FILE_TOO_LARGE",
		})
		return
	}

	// 检查文件类型
	extension := strings.ToLower(filepath.Ext(path))
	
	// 支持的文本文件类型
	textExtensions := map[string]bool{
		".txt": true, ".py": true, ".sh": true, ".json": true,
		".yaml": true, ".yml": true, ".md": true, ".log": true,
		".conf": true, ".cfg": true, ".ini": true, ".csv": true,
	}

	if textExtensions[extension] {
		// 预览文本文件
		readCommand := fmt.Sprintf(`head -c %d "%s"`, maxPreviewSize, mountPath)
		content, err := execCommandInPod(podName, readCommand, 15*time.Second)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(ErrorResponse{
				Success: false,
				Error:   fmt.Sprintf("Failed to read file: %v", err),
				Code:    "READ_FAILED",
			})
			return
		}

		lines := len(strings.Split(content, "\n"))

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(FilePreviewResponse{
			Type:    "text",
			Content: content,
			Size:    fileSize,
			Lines:   lines,
		})
		log.Printf("Successfully previewed text file: %s (%d bytes, %d lines)", path, fileSize, lines)
		return
	}

	if extension == ".parquet" {
		// 预览 Parquet 文件
		// 注意：这需要 Pod 中安装 parquet-tools，如果没有安装则返回基本信息
		schemaCommand := fmt.Sprintf(`
			if command -v parquet-tools >/dev/null 2>&1; then
				parquet-tools schema "%s" 2>/dev/null || echo "ERROR: Failed to read schema"
			else
				echo "ERROR: parquet-tools not installed"
			fi
		`, mountPath)

		schemaOutput, _ := execCommandInPod(podName, schemaCommand, 15*time.Second)
		
		if strings.HasPrefix(schemaOutput, "ERROR:") {
			// parquet-tools 不可用，返回基本信息
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(FilePreviewResponse{
				Type:    "parquet",
				Content: "Parquet file (parquet-tools not available for detailed preview)",
				Size:    fileSize,
			})
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(FilePreviewResponse{
			Type:    "parquet",
			Content: schemaOutput,
			Size:    fileSize,
			Schema:  schemaOutput,
		})
		log.Printf("Successfully previewed parquet file: %s (%d bytes)", path, fileSize)
		return
	}

	// 不支持的文件类型
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(FilePreviewResponse{
		Type:    "unsupported",
		Content: fmt.Sprintf("Preview not supported for %s files", extension),
		Size:    fileSize,
	})
}

// handleDatasetDownload 处理文件下载请求
func handleDatasetDownload(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   "Method not allowed",
			Code:    "METHOD_NOT_ALLOWED",
		})
		return
	}

	// 获取路径参数
	path := r.URL.Query().Get("path")
	if path == "" {
		w.WriteHeader(http.StatusBadRequest)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   "Path parameter is required",
			Code:    "PATH_REQUIRED",
		})
		return
	}

	// 验证路径安全性
	if err := validateDatasetPath(path); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   err.Error(),
			Code:    "PATH_INVALID",
		})
		return
	}

	// 转换为挂载路径
	mountPath := convertToMountPath(path)
	fileName := filepath.Base(path)
	log.Printf("Downloading file: %s (mount: %s)", path, mountPath)

	// 获取 CFS Pod
	podName, err := getCFSDataAccessorPod()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   err.Error(),
			Code:    "POD_NOT_FOUND",
		})
		return
	}

	// 检查文件是否存在并获取大小
	checkCommand := fmt.Sprintf(`
		if [ ! -f "%s" ]; then
			echo "ERROR: File not found"
			exit 1
		fi
		stat -c %%s "%s"
	`, mountPath, mountPath)

	sizeOutput, err := execCommandInPod(podName, checkCommand, 10*time.Second)
	if err != nil || strings.HasPrefix(sizeOutput, "ERROR:") {
		w.WriteHeader(http.StatusNotFound)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   "File not found",
			Code:    "FILE_NOT_FOUND",
		})
		return
	}

	fileSize, _ := strconv.ParseInt(strings.TrimSpace(sizeOutput), 10, 64)

	// 设置下载响应头
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fileName))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", fileSize))

	// 流式读取并传输文件
	if currentClientset == nil || currentRestConfig == nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	req := currentClientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace("rl").
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: "cfs-data-accessor",
			Command:   []string{"cat", mountPath},
			Stdout:    true,
			Stderr:    true,
		}, scheme.ParameterCodec)

	executor, err := remotecommand.NewSPDYExecutor(currentRestConfig, "POST", req.URL())
	if err != nil {
		log.Printf("Failed to create executor: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	var stderr strings.Builder
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	err = executor.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdout: w,
		Stderr: &stderr,
	})

	if err != nil {
		log.Printf("Failed to download file %s: %v, stderr: %s", path, err, stderr.String())
		return
	}

	log.Printf("Successfully downloaded file: %s (%d bytes)", path, fileSize)
}

// handleDatasetDelete 处理文件删除请求
func handleDatasetDelete(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodDelete {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   "Method not allowed",
			Code:    "METHOD_NOT_ALLOWED",
		})
		return
	}

	// 获取路径参数
	path := r.URL.Query().Get("path")
	if path == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   "Path parameter is required",
			Code:    "PATH_REQUIRED",
		})
		return
	}

	// 验证路径安全性
	if err := validateDatasetPath(path); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   err.Error(),
			Code:    "PATH_INVALID",
		})
		return
	}

	// 转换为挂载路径
	mountPath := convertToMountPath(path)
	log.Printf("Deleting file: %s (mount: %s)", path, mountPath)

	// 获取 CFS Pod
	podName, err := getCFSDataAccessorPod()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   err.Error(),
			Code:    "POD_NOT_FOUND",
		})
		return
	}

	// 检查文件是否存在并删除
	deleteCommand := fmt.Sprintf(`
		if [ ! -e "%s" ]; then
			echo "ERROR: File not found"
			exit 1
		fi
		if [ -d "%s" ]; then
			rmdir "%s" 2>&1 || echo "ERROR: Directory not empty"
		else
			rm -f "%s" && echo "SUCCESS"
		fi
	`, mountPath, mountPath, mountPath, mountPath)

	output, err := execCommandInPod(podName, deleteCommand, 10*time.Second)
	if err != nil {
		log.Printf("Failed to delete file: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to delete file: %v", err),
			Code:    "DELETE_FAILED",
		})
		return
	}

	if strings.HasPrefix(output, "ERROR:") {
		errorMsg := strings.TrimPrefix(strings.TrimSpace(output), "ERROR: ")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{
			Success: false,
			Error:   errorMsg,
			Code:    "DELETE_FAILED",
		})
		return
	}

	// 删除成功
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(SuccessResponse{
		Success: true,
		Message: "File deleted successfully",
		Path:    path,
	})
	log.Printf("Successfully deleted file: %s", path)
}
