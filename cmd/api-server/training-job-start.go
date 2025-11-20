package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"
)

// StartTrainingJobRequest 启动训练任务请求
type StartTrainingJobRequest struct {
	JobID string `json:"jobId"`
}

// StartTrainingJobResponse 启动训练任务响应
type StartTrainingJobResponse struct {
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	JobID     string `json:"jobId"`
	PodName   string `json:"podName,omitempty"`
	Namespace string `json:"namespace,omitempty"`
}

// TrainingJobExecutor 训练任务执行器
type TrainingJobExecutor struct {
	job       *TrainingJobDB
	podName   string
	namespace string
	command   string
}

// handleStartTrainingJob 处理启动训练任务请求
func handleStartTrainingJob(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json")

	// 解析请求
	var req StartTrainingJobRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, StartTrainingJobResponse{
			Success: false,
			Message: fmt.Sprintf("Invalid request: %v", err),
		})
		return
	}

	// 验证任务ID
	if req.JobID == "" {
		respondJSON(w, http.StatusBadRequest, StartTrainingJobResponse{
			Success: false,
			Message: "Job ID is required",
		})
		return
	}

	// 获取训练任务信息
	job, err := GetTrainingJobDB(req.JobID)
	if err != nil {
		respondJSON(w, http.StatusNotFound, StartTrainingJobResponse{
			Success: false,
			Message: fmt.Sprintf("Training job not found: %v", err),
		})
		return
	}

	// 检查任务状态
	if job.Status == "running" {
		respondJSON(w, http.StatusBadRequest, StartTrainingJobResponse{
			Success: false,
			Message: "Training job is already running",
		})
		return
	}

	// 查找Ray Head Pod
	podName, namespace, err := findRayHeadPodForJob(job)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, StartTrainingJobResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to find Ray head pod: %v", err),
		})
		return
	}

	// 验证Pod是否就绪
	if err := verifyPodReady(namespace, podName); err != nil {
		respondJSON(w, http.StatusServiceUnavailable, StartTrainingJobResponse{
			Success: false,
			Message: fmt.Sprintf("Ray head pod is not ready: %v", err),
		})
		return
	}

	// 生成训练命令
	command := generateTrainingCommand(job)
	
	log.Printf("Starting training job %s on pod %s/%s", job.ID, namespace, podName)
	log.Printf("Command: %s", command)

	// 创建执行器
	executor := &TrainingJobExecutor{
		job:       job,
		podName:   podName,
		namespace: namespace,
		command:   command,
	}

	// 在后台启动训练任务
	go executor.executeTrainingJob()

	// 更新任务状态为running
	if err := UpdateTrainingJobStatus(job.ID, "running"); err != nil {
		log.Printf("Warning: Failed to update job status: %v", err)
	}

	// 返回成功响应
	respondJSON(w, http.StatusOK, StartTrainingJobResponse{
		Success:   true,
		Message:   "Training job started successfully",
		JobID:     job.ID,
		PodName:   podName,
		Namespace: namespace,
	})
}

// findRayHeadPodForJob 查找训练任务对应的Ray Head Pod
func findRayHeadPodForJob(job *TrainingJobDB) (string, string, error) {
	// 检查Kubernetes连接
	if currentClientset == nil {
		return "", "", fmt.Errorf("not connected to Kubernetes cluster")
	}
	
	ctx := context.Background()
	
	// 确定namespace
	namespace := job.Namespace
	if namespace == "" {
		namespace = job.CreateNamespace
	}
	if namespace == "" {
		namespace = "default"
	}

	// 确定环境ID (Ray集群名称)
	envID := job.EnvironmentID
	if envID == "" {
		return "", "", fmt.Errorf("environment ID not set for job %s", job.ID)
	}

	// 查找Ray Head Pod
	labelSelector := fmt.Sprintf("ray.io/cluster=%s,ray.io/node-type=head", envID)
	
	pods, err := currentClientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	
	if err != nil {
		return "", "", fmt.Errorf("failed to list pods: %w", err)
	}

	if len(pods.Items) == 0 {
		return "", "", fmt.Errorf("no Ray head pod found for environment: %s", envID)
	}

	// 查找运行中的Pod
	for _, pod := range pods.Items {
		if pod.Status.Phase == corev1.PodRunning {
			allReady := true
			for _, containerStatus := range pod.Status.ContainerStatuses {
				if !containerStatus.Ready {
					allReady = false
					break
				}
			}
			if allReady {
				return pod.Name, namespace, nil
			}
		}
	}

	// 如果没有完全就绪的Pod，返回第一个
	return pods.Items[0].Name, namespace, nil
}

// verifyPodReady 验证Pod是否就绪
func verifyPodReady(namespace, podName string) error {
	ctx := context.Background()
	
	pod, err := currentClientset.CoreV1().Pods(namespace).Get(ctx, podName, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get pod: %w", err)
	}

	if pod.Status.Phase != corev1.PodRunning {
		return fmt.Errorf("pod is not running, current phase: %s", pod.Status.Phase)
	}

	for _, containerStatus := range pod.Status.ContainerStatuses {
		if !containerStatus.Ready {
			return fmt.Errorf("container %s is not ready", containerStatus.Name)
		}
	}

	return nil
}

// executeTrainingJob 在后台执行训练任务
func (e *TrainingJobExecutor) executeTrainingJob() {
	ctx := context.Background()
	
	log.Printf("[Job %s] Starting execution on pod %s/%s", e.job.ID, e.namespace, e.podName)
	log.Printf("[Job %s] Training command to execute: %s", e.job.ID, e.command)
	
	// 首先创建输出目录
	err := e.createLogDirectory()
	if err != nil {
		log.Printf("[Job %s] Failed to create output directory: %v", e.job.ID, err)
		UpdateTrainingJobStatus(e.job.ID, "failed")
		return
	}
	
	// 准备执行命令 - 修改为异步后台执行，让输出流到容器stdout
	// 日志文件路径与输出目录保持一致，使用任务的output_directory
	outputDir := e.job.OutputDirectory
	if outputDir == "" {
		outputDir = fmt.Sprintf("/mnt/cfs-turbo/cfs/%s/checkpoint", e.job.ID)
	}
	logFile := fmt.Sprintf("%s/training.log", outputDir)
	pidFile := fmt.Sprintf("/tmp/training-job-%s.pid", e.job.ID)
	
	// 构造执行命令，确保训练输出直接流到容器stdout
	// 不使用后台执行，而是直接在前台运行，这样输出会直接流到容器stdout
	execCommand := []string{
		"/bin/bash",
		"-c",
		fmt.Sprintf(`
# 清理之前的进程
if [ -f %s ]; then
    old_pid=$(cat %s)
    if kill -0 $old_pid 2>/dev/null; then
        kill $old_pid 2>/dev/null
        sleep 1
        kill -9 $old_pid 2>/dev/null
    fi
fi

# 清理日志文件
> %s

# 直接执行训练任务，让输出直接流到容器stdout
# 这样kubectl logs就能获取到训练输出
echo "=== Starting Training Job ==="
echo "Command: %s"
echo "=== Training Output ==="
%s 2>&1
`, pidFile, pidFile, logFile, e.command, e.command),
	}

	// 创建执行请求
	req := currentClientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(e.podName).
		Namespace(e.namespace).
		SubResource("exec")

	req.VersionedParams(&corev1.PodExecOptions{
		Command: execCommand,
		Stdin:   false,
		Stdout:  true,
		Stderr:  true,
		TTY:     false,
		Container: "ray-head",
	}, scheme.ParameterCodec)

	// 创建executor
	exec, err := remotecommand.NewSPDYExecutor(currentRestConfig, "POST", req.URL())
	if err != nil {
		log.Printf("[Job %s] Failed to create executor: %v", e.job.ID, err)
		UpdateTrainingJobStatus(e.job.ID, "failed")
		return
	}

	// 在后台执行训练任务，让输出直接流到容器stdout
	// 这样kubectl logs就能获取到真实的训练输出
	go func() {
		startTime := time.Now()
		err = exec.StreamWithContext(ctx, remotecommand.StreamOptions{
			Stdout: os.Stdout,
			Stderr: os.Stderr,
		})
		duration := time.Since(startTime)

		// 检查执行结果
		if err != nil {
			log.Printf("[Job %s] Training job failed after %v: %v", e.job.ID, duration, err)
			UpdateTrainingJobStatus(e.job.ID, "failed")
		} else {
			log.Printf("[Job %s] Training job completed successfully after %v", e.job.ID, duration)
			UpdateTrainingJobStatus(e.job.ID, "completed")
		}
	}()

	// 立即返回，训练任务在后台运行
	log.Printf("[Job %s] Training job started in background", e.job.ID)
}

// monitorTrainingJob 监控训练任务状态
func (e *TrainingJobExecutor) monitorTrainingJob(logFile, pidFile string) {
	log.Printf("[Job %s] Starting monitoring", e.job.ID)
	
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	
	timeout := time.NewTimer(30 * time.Minute) // 30分钟超时
	defer timeout.Stop()
	
	for {
		select {
		case <-timeout.C:
			log.Printf("[Job %s] Training job timed out after 30 minutes", e.job.ID)
			e.cleanupTrainingJob(pidFile)
			UpdateTrainingJobStatus(e.job.ID, "failed")
			return
			
		case <-ticker.C:
			// 检查进程状态
			running, err := e.checkTrainingProcess(pidFile)
			if err != nil {
				log.Printf("[Job %s] Error checking training process: %v", e.job.ID, err)
				continue
			}
			
			if !running {
				log.Printf("[Job %s] Training process has completed", e.job.ID)
				e.cleanupTrainingJob(pidFile)
				UpdateTrainingJobStatus(e.job.ID, "completed")
				return
			}
			
			log.Printf("[Job %s] Training process is still running", e.job.ID)
		}
	}
}

// checkTrainingProcess 检查训练进程是否还在运行
func (e *TrainingJobExecutor) checkTrainingProcess(pidFile string) (bool, error) {
	ctx := context.Background()
	
	// 构造检查进程命令
	checkCommand := []string{
		"/bin/bash",
		"-c",
		fmt.Sprintf(`
if [ -f %s ]; then
    pid=$(cat %s)
    if kill -0 $pid 2>/dev/null; then
        echo "Process $pid is running"
        exit 0
    else
        echo "Process $pid is not running"
        exit 1
    fi
else
    echo "PID file not found"
    exit 1
fi
`, pidFile, pidFile),
	}
	
	// 创建执行请求
	req := currentClientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(e.podName).
		Namespace(e.namespace).
		SubResource("exec")

	req.VersionedParams(&corev1.PodExecOptions{
		Command: checkCommand,
		Stdin:   false,
		Stdout:  true,
		Stderr:  true,
		TTY:     false,
		Container: "ray-head",
	}, scheme.ParameterCodec)

	// 创建executor
	exec, err := remotecommand.NewSPDYExecutor(currentRestConfig, "POST", req.URL())
	if err != nil {
		return false, err
	}

	// 执行检查命令
	var stdout, stderr bytes.Buffer
	err = exec.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdout: &stdout,
		Stderr: &stderr,
	})

	if err != nil {
		return false, err
	}

	// 检查输出
	output := stdout.String()
	return strings.Contains(output, "is running"), nil
}

// cleanupTrainingJob 清理训练任务
func (e *TrainingJobExecutor) cleanupTrainingJob(pidFile string) {
	ctx := context.Background()
	
	// 构造清理命令
	cleanupCommand := []string{
		"/bin/bash",
		"-c",
		fmt.Sprintf(`
if [ -f %s ]; then
    pid=$(cat %s)
    if kill -0 $pid 2>/dev/null; then
        echo "Cleaning up training process $pid"
        kill $pid 2>/dev/null
        sleep 2
        kill -9 $pid 2>/dev/null
    fi
    rm -f %s
fi
`, pidFile, pidFile, pidFile),
	}
	
	// 创建执行请求
	req := currentClientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(e.podName).
		Namespace(e.namespace).
		SubResource("exec")

	req.VersionedParams(&corev1.PodExecOptions{
		Command: cleanupCommand,
		Stdin:   false,
		Stdout:  true,
		Stderr:  true,
		TTY:     false,
		Container: "ray-head",
	}, scheme.ParameterCodec)

	// 创建executor
	exec, err := remotecommand.NewSPDYExecutor(currentRestConfig, "POST", req.URL())
	if err != nil {
		log.Printf("[Job %s] Failed to create cleanup executor: %v", e.job.ID, err)
		return
	}

	// 执行清理命令
	var stdout, stderr bytes.Buffer
	err = exec.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdout: &stdout,
		Stderr: &stderr,
	})

	if err != nil {
		log.Printf("[Job %s] Cleanup command failed: %v", e.job.ID, err)
	} else {
		log.Printf("[Job %s] Cleanup completed", e.job.ID)
	}
}

// createLogDirectory 创建训练输出目录
func (e *TrainingJobExecutor) createLogDirectory() error {
	ctx := context.Background()
	
	// 使用任务的输出目录路径，与generateTrainingCommand保持一致
	outputDir := e.job.OutputDirectory
	if outputDir == "" {
		outputDir = fmt.Sprintf("/mnt/cfs-turbo/cfs/%s/checkpoint", e.job.ID)
	}
	
	createDirCommand := []string{
		"/bin/bash",
		"-c",
		fmt.Sprintf("mkdir -p %s", outputDir),
	}

	// 创建执行请求
	req := currentClientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(e.podName).
		Namespace(e.namespace).
		SubResource("exec")

	req.VersionedParams(&corev1.PodExecOptions{
		Command: createDirCommand,
		Stdin:   false,
		Stdout:  true,
		Stderr:  true,
		TTY:     false,
		Container: "ray-head",
	}, scheme.ParameterCodec)

	// 创建executor
	exec, err := remotecommand.NewSPDYExecutor(currentRestConfig, "POST", req.URL())
	if err != nil {
		return fmt.Errorf("failed to create executor: %v", err)
	}

	// 执行创建目录命令
	var stdout, stderr bytes.Buffer
	err = exec.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdout: &stdout,
		Stderr: &stderr,
	})

	if err != nil {
		return fmt.Errorf("failed to create log directory: %v, stderr: %s", err, stderr.String())
	}

	log.Printf("[Job %s] Log directory created successfully", e.job.ID)
	return nil
}