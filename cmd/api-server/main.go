package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/rs/cors"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
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
)

func main() {
	mux := http.NewServeMux()
	
	// API routes
	mux.HandleFunc("/api/cluster/connect", handleClusterConnect)
	mux.HandleFunc("/api/cluster/status", handleClusterStatus)
	mux.HandleFunc("/api/cluster/stats", handleGetStats)
	mux.HandleFunc("/api/cluster/parse-kubeconfig", handleParseKubeconfig)
	
	// Environment routes
	mux.HandleFunc("/api/environments", handleListEnvironments)
	mux.HandleFunc("/api/environments/create", handleCreateEnvironment)
	mux.HandleFunc("/api/environments/delete", handleDeleteEnvironment)
	mux.HandleFunc("/api/environments/scale", handleScaleEnvironment)
	mux.HandleFunc("/api/environments/detail", handleGetEnvironmentDetail)
	mux.HandleFunc("/api/environments/status", handleGetEnvironmentStatus)
	mux.HandleFunc("/api/environments/dashboard-url", handleGetDashboardURL)
	
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
	if currentClientset == nil {
		respondJSON(w, http.StatusOK, ClusterStatus{
			Connected: false,
			Message:   "Not connected to any cluster",
		})
		return
	}
	
	// Test connection by listing pods
	_, err := currentClientset.CoreV1().Pods("").List(context.Background(), metav1.ListOptions{Limit: 1})
	if err != nil {
		currentClientset = nil
		respondJSON(w, http.StatusOK, ClusterStatus{
			Connected: false,
			Message:   "Connection lost: " + err.Error(),
		})
		return
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