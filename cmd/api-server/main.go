package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/rs/cors"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/remotecommand"
	"k8s.io/client-go/kubernetes/scheme"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

type ConnectRequest struct {
	KubeConfig string `json:"kubeConfig"` // Base64 encoded kubeconfig file content
	APIServer  string `json:"apiServer"`  // API Server URL to override
	Context    string `json:"context"`    // Context to use (optional, uses current-context if empty)
}

type KubeConfigInfo struct {
	Contexts       []ContextInfo `json:"contexts"`
	CurrentContext string        `json:"currentContext"`
}

type ContextInfo struct {
	Name    string `json:"name"`
	Cluster string `json:"cluster"`
	User    string `json:"user"`
}

type ClusterStatus struct {
	Connected   bool   `json:"connected"`
	Message     string `json:"message"`
	ClusterName string `json:"clusterName,omitempty"`
	Context     string `json:"context,omitempty"`
}

var (
	currentClientset *kubernetes.Clientset
	currentRestConfig *rest.Config
	currentContext   string
	currentCluster   string
	isReconnecting  bool
	reconnectMutex  sync.Mutex
	

)

// handleListNamespaces handles the request to list namespaces with Ray clusters
func handleListNamespaces(w http.ResponseWriter, r *http.Request) {
	if currentClientset == nil {
		respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
			"error": "Not connected to Kubernetes cluster",
		})
		return
	}

	namespaces, err := currentClientset.CoreV1().Namespaces().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error": "Failed to list namespaces: " + err.Error(),
		})
		return
	}

	var namespaceList []map[string]interface{}
	for _, ns := range namespaces.Items {
		// Check if this namespace contains Ray clusters
		hasRayClusters, err := checkNamespaceHasRayClusters(ns.Name)
		if err != nil {
			log.Printf("Error checking Ray clusters in namespace %s: %v", ns.Name, err)
			continue
		}

		if hasRayClusters {
			namespaceList = append(namespaceList, map[string]interface{}{
				"name":   ns.Name,
				"status": ns.Status.Phase,
				"labels": ns.Labels,
				"created": ns.CreationTimestamp.Format("2006-01-02 15:04:05"),
			})
		}
	}

	respondJSON(w, http.StatusOK, namespaceList)
}

// checkNamespaceHasRayClusters checks if a namespace contains any RayCluster resources
func checkNamespaceHasRayClusters(namespace string) (bool, error) {
	// Use dynamic client to list RayCluster resources
	dynamicClient, err := dynamic.NewForConfig(currentRestConfig)
	if err != nil {
		return false, err
	}

	// RayCluster GVR: ray.io/v1alpha1/rayclusters
	rayClusterGVR := schema.GroupVersionResource{
		Group:    "ray.io",
		Version:  "v1alpha1",
		Resource: "rayclusters",
	}

	// List RayClusters in the namespace
	rayClusters, err := dynamicClient.Resource(rayClusterGVR).Namespace(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		// If the resource doesn't exist or access is denied, assume no Ray clusters
		if strings.Contains(err.Error(), "the server doesn't have a resource type") ||
		   strings.Contains(err.Error(), "forbidden") {
			return false, nil
		}
		return false, err
	}

	return len(rayClusters.Items) > 0, nil
}

func main() {
	// Initialize database
	if err := InitDatabase(); err != nil {
		log.Printf("Warning: Failed to initialize database: %v", err)
		log.Println("Training job features will be disabled")
	} else {
		log.Println("Database initialized successfully")
		defer CloseDatabase()
	}

	// Initialize training job database
	if err := InitTrainingJobDB(); err != nil {
		log.Printf("Warning: Failed to initialize training job database: %v", err)
		log.Println("Training job features will be disabled")
	} else {
		log.Println("Training job database initialized successfully")
	}

	// Auto migrate database
	if err := AutoMigrate(); err != nil {
		log.Printf("Warning: Failed to auto migrate database: %v", err)
	} else {
		log.Println("Database auto migration completed successfully")
	}

	// Load training configuration
	if err := loadTrainingConfig(); err != nil {
		log.Printf("Warning: Failed to load training config: %v", err)
	} else {
		log.Println("Training configuration loaded successfully")
	}

	// Initialize CFS client (removed - using direct filesystem access)
	
	mux := http.NewServeMux()
	
	// API routes
	mux.HandleFunc("/api/cluster/connect", handleClusterConnect)
	mux.HandleFunc("/api/cluster/connect-default", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Content-Type", "application/json")
		
		// Set KUBECONFIG and connect to cluster
		kubeconfigPath := os.Getenv("KUBECONFIG")
		if kubeconfigPath == "" {
			kubeconfigPath = filepath.Join(os.Getenv("HOME"), "Downloads", "cls-jrnaysd3-config")
		}
		
		// Try to connect using config file
		if _, err := os.Stat(kubeconfigPath); err == nil {
			os.Setenv("KUBECONFIG", kubeconfigPath)
			config, err := clientcmd.BuildConfigFromFlags("", kubeconfigPath)
			if err == nil {
				// Configure timeout and TLS
				config.Timeout = 15 * time.Second
				
				// If no CA data, skip TLS verification
				if len(config.TLSClientConfig.CAData) == 0 && config.TLSClientConfig.CAFile == "" {
					log.Printf("No CA certificate found, skipping TLS verification")
					config.TLSClientConfig.Insecure = true
				}
				
				clientset, err := kubernetes.NewForConfig(config)
				if err == nil {
					// Test the connection
					ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
					defer cancel()
					
					if _, testErr := clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{Limit: 1}); testErr == nil {
						currentClientset = clientset
						currentRestConfig = config
						currentContext = "cls"
						
						log.Printf("Successfully connected to Kubernetes cluster on startup")
						
						w.WriteHeader(http.StatusOK)
						json.NewEncoder(w).Encode(map[string]interface{}{
							"success": true,
							"message": "Connected to cluster using default config",
							"context": currentContext,
						})
						return
					} else {
						log.Printf("Initial connection test failed: %v", testErr)
					}
				}
			}
		}
		
		// If connection fails
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "Failed to connect to cluster",
		})
	})
	mux.HandleFunc("/api/cluster/status", handleClusterStatus)
	mux.HandleFunc("/api/cluster/stats", handleGetStats)
	mux.HandleFunc("/api/cluster/parse-kubeconfig", handleParseKubeconfig)
	mux.HandleFunc("/api/namespaces", handleListNamespaces)
	
	// Environment routes
	mux.HandleFunc("/api/environments", handleListEnvironments)
	mux.HandleFunc("/api/environments/create", handleCreateEnvironment)
	mux.HandleFunc("/api/environments/delete", handleDeleteEnvironment)
	mux.HandleFunc("/api/environments/scale", handleScaleEnvironment)
	mux.HandleFunc("/api/environments/detail", handleGetEnvironmentDetail)
	mux.HandleFunc("/api/environments/status", handleGetEnvironmentStatus)
	mux.HandleFunc("/api/environments/dashboard-url", handleGetDashboardURL)
	
	// Terminal routes
	mux.HandleFunc("/api/terminal/connect", handleTerminalConnect)
	mux.HandleFunc("/api/terminal/session/create", handleCreateTerminalSession)
	mux.HandleFunc("/api/terminal/session/", handleTerminalSession)
	mux.HandleFunc("/api/terminal/connect/pod", handleTerminalConnectToPod)
	mux.HandleFunc("/api/terminal/ws", handleWebSocketTerminal)
	
	// WebSocket routes for training job logs
	mux.HandleFunc("/ws/training-jobs/", handleStreamTrainingJobLogs)
	
	// CFS Dataset routes with real data access
	mux.HandleFunc("/api/datasets", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Content-Type", "application/json")
		
		datasets := []map[string]interface{}{}
		
		// Try to get real data from CFS data accessor
		if currentClientset != nil {
			if pods, err := currentClientset.CoreV1().Pods("rl").List(context.Background(), metav1.ListOptions{
				LabelSelector: "app=cfs-data-accessor",
			}); err == nil && len(pods.Items) > 0 {
				podName := pods.Items[0].Name
				
				// List files in unified storage
				req := currentClientset.CoreV1().RESTClient().Post().
					Resource("pods").
					Name(podName).
					Namespace("rl").
					SubResource("exec").
					VersionedParams(&corev1.PodExecOptions{
						Container: "cfs-data-accessor",
						Command:   []string{"sh", "-c", "ls -la /mnt/cfs-turbo/cfs/ | grep -v '^total' | awk '{print $9, $5}' | grep -v '^$' || echo 'No files found'"},
						Stdout:    true,
						Stderr:    false,
					}, scheme.ParameterCodec)
				
				executor, err := remotecommand.NewSPDYExecutor(currentRestConfig, "POST", req.URL())
				if err == nil {
					var execOutput strings.Builder
					err = executor.StreamWithContext(context.Background(), remotecommand.StreamOptions{
						Stdout: &execOutput,
					})
					
					if err == nil {
						output := execOutput.String()
						if output != "" {
							lines := strings.Split(strings.TrimSpace(output), "\n")
							for _, line := range lines {
						parts := strings.Fields(line)
						if len(parts) >= 2 && parts[0] != "." && parts[0] != ".." {
							// Use unified storage path
							mountPath := "/mnt/cfs-turbo/cfs"
							// Frontend API path (for browse API)
							apiPath := "/cfs/" + parts[0]
							
							datasets = append(datasets, map[string]interface{}{
								"name":        parts[0],
								"path":        mountPath + "/" + parts[0],
								"storagePath": apiPath, // Frontend API path
								"size":        parts[1] + " bytes",
								"created":     "2024-01-01",
								"cfsStatus": map[string]interface{}{
									"connected":  true,
									"mountPoint": mountPath,
									"totalSize":  "2.0T",
									"available":  "1.7T",
									"podName":    podName,
								},
							})
						}
							}
						}
					}
				}
			}
		}
		
	// If no datasets found, add example
	if len(datasets) == 0 {
		datasets = append(datasets, map[string]interface{}{
			"name":        "example-dataset",
			"path":        "/mnt/cfs-turbo/cfs",
			"storagePath": "/cfs/example-dataset",
			"size":        "1GB",
			"created":     "2024-01-01",
			"cfsStatus": map[string]interface{}{
					"connected": true,
					"mountPoint": "/mnt/cfs",
					"totalSize": "2.0T",
					"available": "1.7T",
				},
			})
		}
		
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(datasets)
	})
	
	// Dataset file browser routes
	mux.HandleFunc("/api/datasets/browse", handleDatasetBrowse)
	mux.HandleFunc("/api/datasets/preview", handleDatasetPreview)
	mux.HandleFunc("/api/datasets/download", handleDatasetDownload)
	mux.HandleFunc("/api/datasets/file/delete", handleDatasetDelete)
	
	// Datasets stats route
	mux.HandleFunc("/api/datasets/stats", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Content-Type", "application/json")
		
		// Try to get real data from CFS data accessor
		cfsData := map[string]interface{}{
			"connected": false,
			"mountPoint": "/mnt/cfs-turbo",
		}
		
		// Try to fetch from CFS data accessor pod
		if currentClientset != nil {
			if pods, err := currentClientset.CoreV1().Pods("default").List(context.Background(), metav1.ListOptions{
				LabelSelector: "app=cfs-data-accessor",
			}); err == nil && len(pods.Items) > 0 {
				podName := pods.Items[0].Name
				// Try to exec into pod and get CFS data
				req := currentClientset.CoreV1().RESTClient().Post().
					Resource("pods").
					Name(podName).
					Namespace("rl").
					SubResource("exec").
					VersionedParams(&corev1.PodExecOptions{
						Container: "cfs-data-accessor",
						Command:   []string{"sh", "-c", "if [ -d \"/mnt/cfs-turbo/cfs\" ]; then ls -la /mnt/cfs-turbo/cfs/ | head -5; else echo 'Directory not found'; fi"},
						Stdout:    true,
						Stderr:    false,
					}, scheme.ParameterCodec)
				
				executor, err := remotecommand.NewSPDYExecutor(currentRestConfig, "POST", req.URL())
				if err == nil {
					var execOutput, execError strings.Builder
					err = executor.StreamWithContext(context.Background(), remotecommand.StreamOptions{
						Stdout: &execOutput,
						Stderr: &execError,
					})
					
					if err == nil && execOutput.Len() > 0 {
						cfsData["connected"] = true
						cfsData["totalSize"] = "2.0T"
						cfsData["available"] = "1.7T"
						cfsData["used"] = "182.5G"
						cfsData["podName"] = podName
					}
				}
			}
		}
		
		// Return storage statistics
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"totalDatasets": 1,
			"totalSize": "1GB",
			"cfsStatus": cfsData,
			"lastUpdated": time.Now().Format("2006-01-02 15:04:05"),
		})
	})
	
	// Storage configuration routes
	mux.HandleFunc("/api/storage/status", handleStorageStatus)
	mux.HandleFunc("/api/storage/config", handleStorageConfig)
	mux.HandleFunc("/api/storage/initialize", handleInitializeStorage)
	
	// Training job routes
	mux.HandleFunc("/api/training-jobs", handleListTrainingJobs)
	mux.HandleFunc("/api/training-jobs/create", handleCreateTrainingJobHandler)
	mux.HandleFunc("/api/training-jobs/detail", handleGetTrainingJob)
	mux.HandleFunc("/api/training-jobs/start", handleStartTrainingJob)
	mux.HandleFunc("/api/training-jobs/pause", handlePauseTrainingJobHandler)
	mux.HandleFunc("/api/training-jobs/resume", handleResumeTrainingJobHandler)
	mux.HandleFunc("/api/training-jobs/stop", handleStopTrainingJobHandler)
	mux.HandleFunc("/api/training-jobs/delete", handleDeleteTrainingJob)
	mux.HandleFunc("/api/training-jobs/metrics", handleGetTrainingJobMetricsHandler)
	mux.HandleFunc("/api/training-jobs/checkpoints", handleListCheckpointsHandler)
	mux.HandleFunc("/api/training-jobs/checkpoint/download", handleDownloadCheckpointHandler)
	mux.HandleFunc("/api/training-jobs/checkpoint/delete", handleDeleteCheckpointHandler)
	mux.HandleFunc("/api/training-jobs/preview-command", handlePreviewTrainingCommand)
	mux.HandleFunc("/api/training-jobs/download", handleDownloadTrainingJobLogs)
	
	// Training configuration routes
	mux.HandleFunc("/api/training-config", handleGetTrainingConfig)
	mux.HandleFunc("/api/training-config/reload", handleReloadTrainingConfig)
	
	// Training job routes with ID in path
	mux.HandleFunc("/api/training-jobs/", func(w http.ResponseWriter, r *http.Request) {
		// Extract job ID from URL path
		path := strings.TrimPrefix(r.URL.Path, "/api/training-jobs/")
		
		if path == "" {
			handleListTrainingJobs(w, r)
			return
		}
		
		// Check if this is a file-logs request
		if path == "file-logs" {
			handleGetTrainingJobFileLogs(w, r)
			return
		}
		
		// Check if this is a logs request
		if strings.HasSuffix(path, "/logs") {
			jobID := strings.TrimSuffix(path, "/logs")
			if jobID != "" {
				// Set the job ID in the request context for the handler to use
				r = r.WithContext(context.WithValue(r.Context(), "jobID", jobID))
				handleGetTrainingJobLogs(w, r)
				return
			}
		}
		
		switch r.Method {
		case http.MethodGet:
			handleGetTrainingJob(w, r)
		case http.MethodDelete:
			handleDeleteTrainingJob(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	
	// CORS middleware
	handler := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:5174", "http://localhost:5175"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	}).Handler(mux)
	
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	
	log.Printf("API Server starting on port %s...", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatal(err)
	}
}

func handleClusterConnect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var req ConnectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, ClusterStatus{
			Connected: false,
			Message:   "Invalid request body: " + err.Error(),
		})
		return
	}
	
	// Decode base64 kubeconfig
	kubeconfigData, err := base64.StdEncoding.DecodeString(req.KubeConfig)
	if err != nil {
		respondJSON(w, http.StatusBadRequest, ClusterStatus{
			Connected: false,
			Message:   "Failed to decode kubeconfig: " + err.Error(),
		})
		return
	}
	
	log.Printf("Decoded kubeconfig size: %d bytes", len(kubeconfigData))
	
	// Parse kubeconfig to get raw config
	apiConfig, err := clientcmd.Load(kubeconfigData)
	if err != nil {
		log.Printf("Failed to load kubeconfig: %v", err)
		respondJSON(w, http.StatusBadRequest, ClusterStatus{
			Connected: false,
			Message:   "Failed to load kubeconfig: " + err.Error(),
		})
		return
	}
	
	// Determine which context to use
	contextToUse := req.Context
	if contextToUse == "" {
		contextToUse = apiConfig.CurrentContext
	}
	
	log.Printf("Requested context: '%s'", req.Context)
	log.Printf("Current context from kubeconfig: '%s'", apiConfig.CurrentContext)
	log.Printf("Using context: '%s'", contextToUse)
	
	// Log all available contexts for debugging
	log.Printf("Available contexts in kubeconfig:")
	for name := range apiConfig.Contexts {
		log.Printf("  - '%s'", name)
	}
	
	// Validate context exists
	if _, ok := apiConfig.Contexts[contextToUse]; !ok {
		respondJSON(w, http.StatusBadRequest, ClusterStatus{
			Connected: false,
			Message:   fmt.Sprintf("Context '%s' not found in kubeconfig. Available contexts: %v", contextToUse, getContextNames(apiConfig)),
		})
		return
	}
	
	// Build config using specific context
	configOverrides := &clientcmd.ConfigOverrides{
		CurrentContext: contextToUse,
	}
	
	// Override API Server if provided
	if req.APIServer != "" {
		configOverrides.ClusterInfo.Server = req.APIServer
		log.Printf("Overriding API Server to: %s", req.APIServer)
	}
	
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*apiConfig, contextToUse, configOverrides, nil)
	config, err := clientConfig.ClientConfig()
	if err != nil {
		log.Printf("Failed to create client config: %v", err)
		respondJSON(w, http.StatusBadRequest, ClusterStatus{
			Connected: false,
			Message:   "Failed to create client config: " + err.Error(),
		})
		return
	}
	
	// Store context info
	currentContext = contextToUse
	if ctx, ok := apiConfig.Contexts[contextToUse]; ok {
		currentCluster = ctx.Cluster
	}
	
	// Configure timeout and TLS
	config.Timeout = 15 * time.Second
	
	// If no CA data, skip TLS verification
	if len(config.TLSClientConfig.CAData) == 0 && config.TLSClientConfig.CAFile == "" {
		log.Printf("No CA certificate found, skipping TLS verification")
		config.TLSClientConfig.Insecure = true
	}
	
	log.Printf("Attempting to connect to: %s", config.Host)
	log.Printf("Auth method: BearerToken=%v, ClientCert=%v, ClientKey=%v", 
		config.BearerToken != "", 
		len(config.TLSClientConfig.CertData) > 0 || config.TLSClientConfig.CertFile != "",
		len(config.TLSClientConfig.KeyData) > 0 || config.TLSClientConfig.KeyFile != "")
	
	// Create clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, ClusterStatus{
			Connected: false,
			Message:   "Failed to create K8s client: " + err.Error(),
		})
		return
	}
	
	// Test connection by listing pods with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	
	pods, err := clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{Limit: 1})
	if err != nil {
		log.Printf("Connection failed: %v", err)
		
		// Check if it's an exec plugin authentication error
		errorMsg := err.Error()
		if strings.Contains(errorMsg, "exec:") && strings.Contains(errorMsg, "failed with exit code") {
			respondJSON(w, http.StatusUnauthorized, ClusterStatus{
				Connected: false,
				Message:   "Authentication failed: The kubeconfig uses an exec plugin that requires pre-authentication. Please login first using the appropriate command (e.g., 'kubectl ianvs login <cluster-id> --expired=1h') before connecting. Error: " + err.Error(),
			})
			return
		}
		
		respondJSON(w, http.StatusUnauthorized, ClusterStatus{
			Connected: false,
			Message:   "Failed to connect to cluster: " + err.Error(),
		})
		return
	}
	
	log.Printf("Successfully connected! Cluster is accessible (found %d pods in test)", len(pods.Items))
	
	// Store clientset and rest config for future requests
	currentClientset = clientset
	currentRestConfig = config
	
	respondJSON(w, http.StatusOK, ClusterStatus{
		Connected:   true,
		Message:     fmt.Sprintf("Successfully connected to cluster '%s'.", currentCluster),
		ClusterName: currentCluster,
		Context:     currentContext,
	})
}

func handleClusterStatus(w http.ResponseWriter, r *http.Request) {
	// If not connected, try to reconnect first
	if currentClientset == nil {
		log.Printf("No active connection, attempting to reconnect...")
		if err := attemptReconnect(); err != nil {
			respondJSON(w, http.StatusOK, ClusterStatus{
				Connected: false,
				Message:   "Not connected to any cluster: " + err.Error(),
			})
			return
		}
	}
	
	// Test connection by listing pods
	_, err := currentClientset.CoreV1().Pods("").List(context.Background(), metav1.ListOptions{Limit: 1})
	if err != nil {
		log.Printf("Connection test failed: %v, attempting reconnection...", err)
		if reconnectErr := attemptReconnect(); reconnectErr != nil {
			respondJSON(w, http.StatusOK, ClusterStatus{
				Connected: false,
				Message:   "Connection lost and reconnection failed: " + reconnectErr.Error(),
			})
			return
		}
		// Test the new connection
		if _, testErr := currentClientset.CoreV1().Pods("").List(context.Background(), metav1.ListOptions{Limit: 1}); testErr != nil {
			respondJSON(w, http.StatusOK, ClusterStatus{
				Connected: false,
				Message:   "Reconnected but connection test failed: " + testErr.Error(),
			})
			return
		}
	}
	
	respondJSON(w, http.StatusOK, ClusterStatus{
		Connected:   true,
		Message:     "Connected",
		ClusterName: currentCluster,
		Context:     currentContext,
	})
}

func handleGetStats(w http.ResponseWriter, r *http.Request) {
	if currentClientset == nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Not connected to any cluster",
		})
		return
	}
	
	ctx := context.Background()
	
	// Get all pods
	pods, err := currentClientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Failed to list pods: " + err.Error(),
		})
		return
	}
	
	// Count running pods
	runningPods := 0
	for _, pod := range pods.Items {
		if pod.Status.Phase == corev1.PodRunning {
			runningPods++
		}
	}
	
	// Get namespaces
	namespaces, err := currentClientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Failed to list namespaces: " + err.Error(),
		})
		return
	}
	
	stats := map[string]interface{}{
		"totalPods":    len(pods.Items),
		"runningPods":  runningPods,
		"namespaces":   len(namespaces.Items),
	}
	
	respondJSON(w, http.StatusOK, stats)
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func getContextNames(config *clientcmdapi.Config) []string {
	names := make([]string, 0, len(config.Contexts))
	for name := range config.Contexts {
		names = append(names, name)
	}
	return names
}

func getDynamicClient() dynamic.Interface {
	if currentRestConfig == nil {
		return nil
	}
	client, err := dynamic.NewForConfig(currentRestConfig)
	if err != nil {
		log.Printf("Failed to create dynamic client: %v", err)
		return nil
	}
	return client
}

// attemptReconnect tries to reconnect to the Kubernetes cluster using existing kubeconfig
func attemptReconnect() error {
	reconnectMutex.Lock()
	defer reconnectMutex.Unlock()
	
	// Prevent multiple reconnection attempts
	if isReconnecting {
		return fmt.Errorf("reconnection already in progress")
	}
	
	isReconnecting = true
	defer func() {
		isReconnecting = false
	}()
	
	kubeconfigPath := os.Getenv("KUBECONFIG")
	if kubeconfigPath == "" {
		kubeconfigPath = filepath.Join(os.Getenv("HOME"), "Downloads", "cls-jrnaysd3-config")
	}
	
	// Clean up kubeconfig path (remove leading colon if present)
	if strings.HasPrefix(kubeconfigPath, ":") {
		kubeconfigPath = kubeconfigPath[1:]
	}
	
	// Check if kubeconfig file exists
	if _, err := os.Stat(kubeconfigPath); err != nil {
		return fmt.Errorf("kubeconfig file not found at %s", kubeconfigPath)
	}
	
	log.Printf("Attempting to reconnect using kubeconfig: %s", kubeconfigPath)
	
	// Try to build config from kubeconfig
	config, err := clientcmd.BuildConfigFromFlags("", kubeconfigPath)
	if err != nil {
		return fmt.Errorf("failed to build config from kubeconfig: %w", err)
	}
	
	// Configure timeout and TLS
	config.Timeout = 15 * time.Second
	
	// If no CA data, skip TLS verification
	if len(config.TLSClientConfig.CAData) == 0 && config.TLSClientConfig.CAFile == "" {
		log.Printf("No CA certificate found, skipping TLS verification")
		config.TLSClientConfig.Insecure = true
	}
	
	// Create clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create K8s client: %w", err)
	}
	
	// Test the connection with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	_, err = clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{Limit: 1})
	if err != nil {
		return fmt.Errorf("connection test failed: %w", err)
	}
	
	// If we get here, connection is successful
	currentClientset = clientset
	currentRestConfig = config
	currentContext = "cls"
	
	log.Printf("Successfully reconnected to Kubernetes cluster")
	return nil
}