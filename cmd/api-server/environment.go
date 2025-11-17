package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

// Environment represents a RL training environment
type Environment struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Framework   string            `json:"framework"` // ray, horovod, deepspeed, custom
	Image       string            `json:"image"`
	Replicas    int32             `json:"replicas"`
	Status      string            `json:"status"` // pending, running, stopped, error
	Namespace   string            `json:"namespace"`
	Labels      map[string]string `json:"labels,omitempty"`
	Annotations map[string]string `json:"annotations,omitempty"`
	CreatedAt   time.Time         `json:"createdAt"`
	UpdatedAt   time.Time         `json:"updatedAt"`
}

// EnvironmentDetail represents detailed information about an environment
type EnvironmentDetail struct {
	Environment
	RayVersion      string            `json:"rayVersion,omitempty"`
	PythonVersion   string            `json:"pythonVersion,omitempty"`
	Resources       ResourceConfig    `json:"resources"`
	Storage         StorageConfig     `json:"storage"`
	Network         NetworkConfig     `json:"network"`
	Nodes           NodeConfig        `json:"nodes"`
}

// ResourceConfig represents resource allocation
type ResourceConfig struct {
	CPU       string `json:"cpu"`
	Memory    string `json:"memory"`
	GPU       string `json:"gpu,omitempty"`
	GPUType   string `json:"gpuType,omitempty"`
}

// StorageConfig represents storage configuration
type StorageConfig struct {
	PersistentVolumePath string `json:"persistentVolumePath,omitempty"`
	Size                 string `json:"size,omitempty"`
}

// NetworkConfig represents network configuration
type NetworkConfig struct {
	HeadNodeIP    string `json:"headNodeIP,omitempty"`
	DashboardPort string `json:"dashboardPort,omitempty"`
	ClientPort    string `json:"clientPort,omitempty"`
}

// NodeConfig represents node configuration
type NodeConfig struct {
	Head    int32 `json:"head"`
	Workers int32 `json:"workers"`
}

// DashboardURLResponse represents the response for dashboard URL
type DashboardURLResponse struct {
	URL       string `json:"url,omitempty"`
	Available bool   `json:"available"`
	Message   string `json:"message"`
}

// CreateEnvironmentRequest represents the request to create an environment
type CreateEnvironmentRequest struct {
	Name      string            `json:"name"`
	Framework string            `json:"framework"`
	Image     string            `json:"image"`
	Replicas  int32             `json:"replicas"`
	Namespace string            `json:"namespace"`
	Labels    map[string]string `json:"labels,omitempty"`
}

// ScaleEnvironmentRequest represents the request to scale an environment
type ScaleEnvironmentRequest struct {
	Replicas int32 `json:"replicas"`
}

// Predefined framework images - using KubeRay for Ray environments
var frameworkImages = map[string]string{
	"ray":       "rayproject/ray:2.9.0",  // KubeRay compatible version
	"horovod":   "horovod/horovod:latest",
	"deepspeed": "deepspeed/deepspeed:latest",
}

// RayCluster configuration for KubeRay
const (
	defaultRayVersion = "2.9.0"
	defaultRayImage   = "rayproject/ray:2.9.0"
)

// sanitizeName converts a name to be Kubernetes-compliant
// Rules:
// - Must consist of lower case alphanumeric characters, '-' or '.'
// - Must start and end with an alphanumeric character
// - Maximum length is 253 characters
func sanitizeName(name string) string {
	// Convert to lowercase
	name = strings.ToLower(name)
	
	// Replace spaces and underscores with hyphens
	name = strings.ReplaceAll(name, " ", "-")
	name = strings.ReplaceAll(name, "_", "-")
	
	// Remove any characters that are not alphanumeric, hyphen, or dot
	reg := regexp.MustCompile(`[^a-z0-9\-\.]+`)
	name = reg.ReplaceAllString(name, "")
	
	// Remove leading and trailing non-alphanumeric characters
	name = strings.Trim(name, "-.")
	
	// Ensure it starts with an alphanumeric character
	if len(name) > 0 && !isAlphanumeric(name[0]) {
		name = "env-" + name
	}
	
	// Truncate to 253 characters if needed
	if len(name) > 253 {
		name = name[:253]
	}
	
	// If name is empty after sanitization, use a default
	if name == "" {
		name = "rl-env"
	}
	
	return name
}

// isAlphanumeric checks if a byte is alphanumeric
func isAlphanumeric(b byte) bool {
	return (b >= 'a' && b <= 'z') || (b >= '0' && b <= '9')
}

// handleListEnvironments lists all environments (deployments with rl-env label and RayClusters)
func handleListEnvironments(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if currentClientset == nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Not connected to any cluster",
		})
		return
	}

	ctx := context.Background()
	namespace := r.URL.Query().Get("namespace")
	if namespace == "" {
		namespace = "default"
	}

	environments := make([]Environment, 0)

	// List RayClusters
	if currentRestConfig != nil {
		dynamicClient, err := dynamic.NewForConfig(currentRestConfig)
		if err == nil {
			rayClusterGVR := schema.GroupVersionResource{
				Group:    "ray.io",
				Version:  "v1",
				Resource: "rayclusters",
			}
			
			rayClusters, err := dynamicClient.Resource(rayClusterGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
			if err == nil {
				for _, item := range rayClusters.Items {
					env := convertRayClusterToEnvironment(&item)
					environments = append(environments, env)
				}
			}
		}
	}

	// List deployments with label rl-env=true
	deployments, err := currentClientset.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: "rl-env=true",
	})
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Failed to list environments: " + err.Error(),
		})
		return
	}

	for _, dep := range deployments.Items {
		env := Environment{
			ID:          string(dep.UID),
			Name:        dep.Name,
			Framework:   dep.Labels["rl-framework"],
			Image:       getImageFromDeployment(&dep),
			Replicas:    *dep.Spec.Replicas,
			Status:      getDeploymentStatus(&dep),
			Namespace:   dep.Namespace,
			Labels:      dep.Labels,
			Annotations: dep.Annotations,
			CreatedAt:   dep.CreationTimestamp.Time,
			UpdatedAt:   dep.CreationTimestamp.Time,
		}
		environments = append(environments, env)
	}

	respondJSON(w, http.StatusOK, environments)
}

// handleCreateEnvironment creates a new environment
func handleCreateEnvironment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if currentClientset == nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Not connected to any cluster",
		})
		return
	}

	var req CreateEnvironmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Invalid request body: " + err.Error(),
		})
		return
	}

	// Validate request
	if req.Name == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Environment name is required",
		})
		return
	}

	// Sanitize the name to be Kubernetes-compliant
	originalName := req.Name
	req.Name = sanitizeName(req.Name)
	
	if req.Name != originalName {
		log.Printf("Sanitized environment name from '%s' to '%s'", originalName, req.Name)
	}

	if req.Namespace == "" {
		req.Namespace = "default"
	}

	// Use predefined image if framework is specified
	image := req.Image
	if image == "" && req.Framework != "" {
		if predefinedImage, ok := frameworkImages[req.Framework]; ok {
			image = predefinedImage
		}
	}

	if image == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Image is required",
		})
		return
	}

	if req.Replicas <= 0 {
		req.Replicas = 1
	}

	// Prepare labels
	labels := map[string]string{
		"rl-env":       "true",
		"rl-framework": req.Framework,
		"app":          req.Name,
	}
	for k, v := range req.Labels {
		labels[k] = v
	}

	ctx := context.Background()
	
	// For Ray framework, use KubeRay RayCluster
	if req.Framework == "ray" {
		err := createRayCluster(ctx, req.Name, req.Namespace, image, req.Replicas, labels)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, map[string]string{
				"error": "Failed to create Ray cluster: " + err.Error(),
			})
			return
		}
		
		env := Environment{
			ID:        req.Name, // Use name as ID for RayCluster
			Name:      req.Name,
			Framework: req.Framework,
			Image:     image,
			Replicas:  req.Replicas,
			Status:    "pending",
			Namespace: req.Namespace,
			Labels:    labels,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		
		log.Printf("Created Ray cluster: %s in namespace %s", req.Name, req.Namespace)
		respondJSON(w, http.StatusCreated, env)
		return
	}
	
	// For other frameworks, use standard Deployment
	deployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      req.Name,
			Namespace: req.Namespace,
			Labels:    labels,
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: &req.Replicas,
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{
					"app": req.Name,
				},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: labels,
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{
						{
							Name:  req.Framework,
							Image: image,
							Ports: []corev1.ContainerPort{
								{
									ContainerPort: 8080,
									Protocol:      corev1.ProtocolTCP,
								},
							},
							Resources: corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									corev1.ResourceCPU:    resource.MustParse("100m"),
									corev1.ResourceMemory: resource.MustParse("256Mi"),
								},
								Limits: corev1.ResourceList{
									corev1.ResourceCPU:    resource.MustParse("1000m"),
									corev1.ResourceMemory: resource.MustParse("1Gi"),
								},
							},
						},
					},
				},
			},
		},
	}

	createdDep, err := currentClientset.AppsV1().Deployments(req.Namespace).Create(ctx, deployment, metav1.CreateOptions{})
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Failed to create environment: " + err.Error(),
		})
		return
	}

	env := Environment{
		ID:        string(createdDep.UID),
		Name:      createdDep.Name,
		Framework: req.Framework,
		Image:     image,
		Replicas:  req.Replicas,
		Status:    "pending",
		Namespace: req.Namespace,
		Labels:    labels,
		CreatedAt: createdDep.CreationTimestamp.Time,
		UpdatedAt: createdDep.CreationTimestamp.Time,
	}

	log.Printf("Created environment: %s in namespace %s", req.Name, req.Namespace)
	respondJSON(w, http.StatusCreated, env)
}

// handleDeleteEnvironment deletes an environment (Deployment or RayCluster)
func handleDeleteEnvironment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if currentClientset == nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Not connected to any cluster",
		})
		return
	}

	name := r.URL.Query().Get("name")
	namespace := r.URL.Query().Get("namespace")
	framework := r.URL.Query().Get("framework")
	if namespace == "" {
		namespace = "default"
	}

	if name == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Environment name is required",
		})
		return
	}

	ctx := context.Background()
	
	// If framework is Ray, delete RayCluster
	if framework == "ray" {
		if currentRestConfig == nil {
			respondJSON(w, http.StatusInternalServerError, map[string]string{
				"error": "REST config not available",
			})
			return
		}
		
		dynamicClient, err := dynamic.NewForConfig(currentRestConfig)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, map[string]string{
				"error": "Failed to create dynamic client: " + err.Error(),
			})
			return
		}
		
		rayClusterGVR := schema.GroupVersionResource{
			Group:    "ray.io",
			Version:  "v1",
			Resource: "rayclusters",
		}
		
		err = dynamicClient.Resource(rayClusterGVR).Namespace(namespace).Delete(ctx, name, metav1.DeleteOptions{})
		if err != nil {
			if errors.IsNotFound(err) {
				respondJSON(w, http.StatusNotFound, map[string]string{
					"error": "RayCluster not found",
				})
				return
			}
			respondJSON(w, http.StatusInternalServerError, map[string]string{
				"error": "Failed to delete RayCluster: " + err.Error(),
			})
			return
		}
		
		log.Printf("Deleted RayCluster: %s in namespace %s", name, namespace)
		respondJSON(w, http.StatusOK, map[string]string{
			"message": fmt.Sprintf("RayCluster %s deleted successfully", name),
		})
		return
	}
	
	// Otherwise, delete Deployment
	err := currentClientset.AppsV1().Deployments(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			respondJSON(w, http.StatusNotFound, map[string]string{
				"error": "Environment not found",
			})
			return
		}
		respondJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete environment: " + err.Error(),
		})
		return
	}

	log.Printf("Deleted environment: %s in namespace %s", name, namespace)
	respondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Environment %s deleted successfully", name),
	})
}

// handleScaleEnvironment scales an environment
func handleScaleEnvironment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if currentClientset == nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Not connected to any cluster",
		})
		return
	}

	name := r.URL.Query().Get("name")
	namespace := r.URL.Query().Get("namespace")
	if namespace == "" {
		namespace = "default"
	}

	if name == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Environment name is required",
		})
		return
	}

	var req ScaleEnvironmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Invalid request body: " + err.Error(),
		})
		return
	}

	if req.Replicas < 0 {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Replicas must be non-negative",
		})
		return
	}

	ctx := context.Background()
	deployment, err := currentClientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			respondJSON(w, http.StatusNotFound, map[string]string{
				"error": "Environment not found",
			})
			return
		}
		respondJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Failed to get environment: " + err.Error(),
		})
		return
	}

	deployment.Spec.Replicas = &req.Replicas
	_, err = currentClientset.AppsV1().Deployments(namespace).Update(ctx, deployment, metav1.UpdateOptions{})
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Failed to scale environment: " + err.Error(),
		})
		return
	}

	log.Printf("Scaled environment %s to %d replicas", name, req.Replicas)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message":  fmt.Sprintf("Environment %s scaled to %d replicas", name, req.Replicas),
		"replicas": req.Replicas,
	})
}

// Helper functions
func getImageFromDeployment(dep *appsv1.Deployment) string {
	if len(dep.Spec.Template.Spec.Containers) > 0 {
		return dep.Spec.Template.Spec.Containers[0].Image
	}
	return ""
}

func getDeploymentStatus(dep *appsv1.Deployment) string {
	if dep.Status.ReadyReplicas == *dep.Spec.Replicas {
		return "running"
	} else if dep.Status.ReadyReplicas > 0 {
		return "pending"
	}
	return "stopped"
}

// convertRayClusterToEnvironment converts a RayCluster to Environment
func convertRayClusterToEnvironment(rayCluster *unstructured.Unstructured) Environment {
	metadata, _ := rayCluster.Object["metadata"].(map[string]interface{})
	spec, _ := rayCluster.Object["spec"].(map[string]interface{})
	status, _ := rayCluster.Object["status"].(map[string]interface{})
	
	name, _ := metadata["name"].(string)
	namespace, _ := metadata["namespace"].(string)
	uid, _ := metadata["uid"].(string)
	labels, _ := metadata["labels"].(map[string]interface{})
	
	// Extract image from headGroupSpec
	image := defaultRayImage
	if headGroupSpec, ok := spec["headGroupSpec"].(map[string]interface{}); ok {
		if template, ok := headGroupSpec["template"].(map[string]interface{}); ok {
			if podSpec, ok := template["spec"].(map[string]interface{}); ok {
				if containers, ok := podSpec["containers"].([]interface{}); ok && len(containers) > 0 {
					if container, ok := containers[0].(map[string]interface{}); ok {
						if img, ok := container["image"].(string); ok {
							image = img
						}
					}
				}
			}
		}
	}
	
	// Extract worker replicas
	var replicas int32 = 0
	if workerGroupSpecs, ok := spec["workerGroupSpecs"].([]interface{}); ok && len(workerGroupSpecs) > 0 {
		if workerGroup, ok := workerGroupSpecs[0].(map[string]interface{}); ok {
			if r, ok := workerGroup["replicas"].(int64); ok {
				replicas = int32(r)
			}
		}
	}
	
	// Determine status
	envStatus := "pending"
	if status != nil {
		if state, ok := status["state"].(string); ok {
			switch state {
			case "ready":
				envStatus = "running"
			case "failed":
				envStatus = "error"
			default:
				envStatus = "pending"
			}
		}
	}
	
	// Convert labels
	labelMap := make(map[string]string)
	for k, v := range labels {
		if strVal, ok := v.(string); ok {
			labelMap[k] = strVal
		}
	}
	
	// Get creation timestamp
	createdAt := time.Now()
	if creationTimestamp, ok := metadata["creationTimestamp"].(string); ok {
		if t, err := time.Parse(time.RFC3339, creationTimestamp); err == nil {
			createdAt = t
		}
	}
	
	return Environment{
		ID:        uid,
		Name:      name,
		Framework: "ray",
		Image:     image,
		Replicas:  replicas,
		Status:    envStatus,
		Namespace: namespace,
		Labels:    labelMap,
		CreatedAt: createdAt,
		UpdatedAt: createdAt,
	}
}

// handleGetEnvironmentDetail gets detailed information about an environment
func handleGetEnvironmentDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if currentClientset == nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Not connected to any cluster",
		})
		return
	}

	name := r.URL.Query().Get("name")
	namespace := r.URL.Query().Get("namespace")
	framework := r.URL.Query().Get("framework")
	
	if namespace == "" {
		namespace = "default"
	}

	if name == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Environment name is required",
		})
		return
	}

	ctx := context.Background()

	// For Ray framework, get RayCluster details
	if framework == "ray" {
		detail, err := getRayClusterDetail(ctx, name, namespace)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, map[string]string{
				"error": "Failed to get Ray cluster details: " + err.Error(),
			})
			return
		}
		respondJSON(w, http.StatusOK, detail)
		return
	}

	// For other frameworks, get Deployment details
	deployment, err := currentClientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			respondJSON(w, http.StatusNotFound, map[string]string{
				"error": "Environment not found",
			})
			return
		}
		respondJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Failed to get environment: " + err.Error(),
		})
		return
	}

	detail := convertDeploymentToDetail(deployment)
	respondJSON(w, http.StatusOK, detail)
}

// handleGetEnvironmentStatus gets the current status of an environment
func handleGetEnvironmentStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if currentClientset == nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Not connected to any cluster",
		})
		return
	}

	name := r.URL.Query().Get("name")
	namespace := r.URL.Query().Get("namespace")
	framework := r.URL.Query().Get("framework")
	
	if namespace == "" {
		namespace = "default"
	}

	if name == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Environment name is required",
		})
		return
	}

	ctx := context.Background()

	// For Ray framework, check RayCluster status
	if framework == "ray" {
		status, err := getRayClusterStatus(ctx, name, namespace)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, map[string]string{
				"error": "Failed to get Ray cluster status: " + err.Error(),
			})
			return
		}
		respondJSON(w, http.StatusOK, map[string]string{
			"status": status,
		})
		return
	}

	// For other frameworks, check Deployment status
	deployment, err := currentClientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Failed to get environment status: " + err.Error(),
		})
		return
	}

	status := getDeploymentStatus(deployment)
	respondJSON(w, http.StatusOK, map[string]string{
		"status": status,
	})
}

// handleGetDashboardURL generates the Ray Dashboard URL
func handleGetDashboardURL(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if currentClientset == nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Not connected to any cluster",
		})
		return
	}

	name := r.URL.Query().Get("name")
	namespace := r.URL.Query().Get("namespace")
	
	if namespace == "" {
		namespace = "default"
	}

	if name == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Environment name is required",
		})
		return
	}

	ctx := context.Background()

	// Check if Ray cluster is running
	status, err := getRayClusterStatus(ctx, name, namespace)
	if err != nil {
		respondJSON(w, http.StatusOK, DashboardURLResponse{
			Available: false,
			Message:   "Failed to check cluster status: " + err.Error(),
		})
		return
	}

	if status != "running" {
		respondJSON(w, http.StatusOK, DashboardURLResponse{
			Available: false,
			Message:   fmt.Sprintf("Ray cluster is not running (status: %s)", status),
		})
		return
	}

	// Get the head service
	serviceName := name + "-head-svc"
	service, err := currentClientset.CoreV1().Services(namespace).Get(ctx, serviceName, metav1.GetOptions{})
	if err != nil {
		respondJSON(w, http.StatusOK, DashboardURLResponse{
			Available: false,
			Message:   "Dashboard service not found: " + err.Error(),
		})
		return
	}

	// Find dashboard port
	dashboardPort := ""
	for _, port := range service.Spec.Ports {
		if port.Name == "dashboard" {
			dashboardPort = fmt.Sprintf("%d", port.Port)
			break
		}
	}

	if dashboardPort == "" {
		respondJSON(w, http.StatusOK, DashboardURLResponse{
			Available: false,
			Message:   "Dashboard port not found in service",
		})
		return
	}

	// For now, return the service information
	// In production, you might want to set up port-forwarding or use an Ingress
	clusterIP := service.Spec.ClusterIP
	dashboardURL := fmt.Sprintf("http://%s:%s", clusterIP, dashboardPort)

	respondJSON(w, http.StatusOK, DashboardURLResponse{
		Available: true,
		URL:       dashboardURL,
		Message:   "Dashboard is available. Note: This is a cluster-internal URL. Use kubectl port-forward for external access.",
	})
}

// getRayClusterDetail gets detailed information about a RayCluster
func getRayClusterDetail(ctx context.Context, name, namespace string) (*EnvironmentDetail, error) {
	if currentRestConfig == nil {
		return nil, fmt.Errorf("REST config not available")
	}

	dynamicClient, err := dynamic.NewForConfig(currentRestConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	rayClusterGVR := schema.GroupVersionResource{
		Group:    "ray.io",
		Version:  "v1",
		Resource: "rayclusters",
	}

	rayCluster, err := dynamicClient.Resource(rayClusterGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	metadata, _ := rayCluster.Object["metadata"].(map[string]interface{})
	spec, _ := rayCluster.Object["spec"].(map[string]interface{})
	status, _ := rayCluster.Object["status"].(map[string]interface{})

	// Extract basic info
	uid, _ := metadata["uid"].(string)
	labels, _ := metadata["labels"].(map[string]interface{})
	rayVersion, _ := spec["rayVersion"].(string)

	// Extract image and resources from headGroupSpec
	image := defaultRayImage
	cpu := "0"
	memory := "0"
	gpu := ""
	gpuType := ""

	if headGroupSpec, ok := spec["headGroupSpec"].(map[string]interface{}); ok {
		if template, ok := headGroupSpec["template"].(map[string]interface{}); ok {
			if podSpec, ok := template["spec"].(map[string]interface{}); ok {
				if containers, ok := podSpec["containers"].([]interface{}); ok && len(containers) > 0 {
					if container, ok := containers[0].(map[string]interface{}); ok {
						if img, ok := container["image"].(string); ok {
							image = img
						}
						if resources, ok := container["resources"].(map[string]interface{}); ok {
							if limits, ok := resources["limits"].(map[string]interface{}); ok {
								if cpuLimit, ok := limits["cpu"].(string); ok {
									cpu = cpuLimit
								}
								if memLimit, ok := limits["memory"].(string); ok {
									memory = memLimit
								}
								if gpuLimit, ok := limits["nvidia.com/gpu"].(string); ok {
									gpu = gpuLimit
									gpuType = "nvidia-gpu"
								}
							}
						}
					}
				}
			}
		}
	}

	// Extract worker replicas
	var workers int32 = 0
	if workerGroupSpecs, ok := spec["workerGroupSpecs"].([]interface{}); ok && len(workerGroupSpecs) > 0 {
		if workerGroup, ok := workerGroupSpecs[0].(map[string]interface{}); ok {
			if r, ok := workerGroup["replicas"].(int64); ok {
				workers = int32(r)
			}
		}
	}

	// Determine status
	envStatus := "pending"
	if status != nil {
		if state, ok := status["state"].(string); ok {
			switch state {
			case "ready":
				envStatus = "running"
			case "failed":
				envStatus = "error"
			default:
				envStatus = "pending"
			}
		}
	}

	// Get head node IP
	headNodeIP := ""
	dashboardPort := "8265"
	clientPort := "10001"
	
	// Try to get the head service
	serviceName := name + "-head-svc"
	service, err := currentClientset.CoreV1().Services(namespace).Get(ctx, serviceName, metav1.GetOptions{})
	if err == nil {
		headNodeIP = service.Spec.ClusterIP
		for _, port := range service.Spec.Ports {
			if port.Name == "dashboard" {
				dashboardPort = fmt.Sprintf("%d", port.Port)
			} else if port.Name == "client" {
				clientPort = fmt.Sprintf("%d", port.Port)
			}
		}
	}

	// Convert labels
	labelMap := make(map[string]string)
	for k, v := range labels {
		if strVal, ok := v.(string); ok {
			labelMap[k] = strVal
		}
	}

	// Get creation timestamp
	createdAt := time.Now()
	if creationTimestamp, ok := metadata["creationTimestamp"].(string); ok {
		if t, err := time.Parse(time.RFC3339, creationTimestamp); err == nil {
			createdAt = t
		}
	}

	// Extract Python version from image tag if possible
	pythonVersion := "3.9"
	if strings.Contains(image, "py38") {
		pythonVersion = "3.8"
	} else if strings.Contains(image, "py39") {
		pythonVersion = "3.9"
	} else if strings.Contains(image, "py310") {
		pythonVersion = "3.10"
	} else if strings.Contains(image, "py311") {
		pythonVersion = "3.11"
	}

	detail := &EnvironmentDetail{
		Environment: Environment{
			ID:        uid,
			Name:      name,
			Framework: "ray",
			Image:     image,
			Replicas:  workers,
			Status:    envStatus,
			Namespace: namespace,
			Labels:    labelMap,
			CreatedAt: createdAt,
			UpdatedAt: createdAt,
		},
		RayVersion:    rayVersion,
		PythonVersion: pythonVersion,
		Resources: ResourceConfig{
			CPU:     cpu,
			Memory:  memory,
			GPU:     gpu,
			GPUType: gpuType,
		},
		Storage: StorageConfig{
			PersistentVolumePath: "/tmp/ray",
			Size:                 "10Gi",
		},
		Network: NetworkConfig{
			HeadNodeIP:    headNodeIP,
			DashboardPort: dashboardPort,
			ClientPort:    clientPort,
		},
		Nodes: NodeConfig{
			Head:    1,
			Workers: workers,
		},
	}

	return detail, nil
}

// getRayClusterStatus gets the status of a RayCluster
func getRayClusterStatus(ctx context.Context, name, namespace string) (string, error) {
	if currentRestConfig == nil {
		return "", fmt.Errorf("REST config not available")
	}

	dynamicClient, err := dynamic.NewForConfig(currentRestConfig)
	if err != nil {
		return "", fmt.Errorf("failed to create dynamic client: %w", err)
	}

	rayClusterGVR := schema.GroupVersionResource{
		Group:    "ray.io",
		Version:  "v1",
		Resource: "rayclusters",
	}

	rayCluster, err := dynamicClient.Resource(rayClusterGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}

	status, _ := rayCluster.Object["status"].(map[string]interface{})
	if status == nil {
		return "pending", nil
	}

	if state, ok := status["state"].(string); ok {
		switch state {
		case "ready":
			return "running", nil
		case "failed":
			return "error", nil
		default:
			return "pending", nil
		}
	}

	return "pending", nil
}

// convertDeploymentToDetail converts a Deployment to EnvironmentDetail
func convertDeploymentToDetail(dep *appsv1.Deployment) *EnvironmentDetail {
	cpu := "0"
	memory := "0"
	gpu := ""
	gpuType := ""

	if len(dep.Spec.Template.Spec.Containers) > 0 {
		container := dep.Spec.Template.Spec.Containers[0]
		if limits := container.Resources.Limits; limits != nil {
			if cpuLimit, ok := limits[corev1.ResourceCPU]; ok {
				cpu = cpuLimit.String()
			}
			if memLimit, ok := limits[corev1.ResourceMemory]; ok {
				memory = memLimit.String()
			}
		}
	}

	detail := &EnvironmentDetail{
		Environment: Environment{
			ID:        string(dep.UID),
			Name:      dep.Name,
			Framework: dep.Labels["rl-framework"],
			Image:     getImageFromDeployment(dep),
			Replicas:  *dep.Spec.Replicas,
			Status:    getDeploymentStatus(dep),
			Namespace: dep.Namespace,
			Labels:    dep.Labels,
			CreatedAt: dep.CreationTimestamp.Time,
			UpdatedAt: dep.CreationTimestamp.Time,
		},
		Resources: ResourceConfig{
			CPU:     cpu,
			Memory:  memory,
			GPU:     gpu,
			GPUType: gpuType,
		},
		Storage: StorageConfig{
			PersistentVolumePath: "/data",
			Size:                 "10Gi",
		},
		Network: NetworkConfig{},
		Nodes: NodeConfig{
			Head:    0,
			Workers: *dep.Spec.Replicas,
		},
	}

	return detail
}

// createRayCluster creates a KubeRay RayCluster resource using dynamic client
func createRayCluster(ctx context.Context, name, namespace, image string, workers int32, labels map[string]string) error {
	// Create dynamic client
	dynamicClient, err := dynamic.NewForConfig(currentRestConfig)
	if err != nil {
		return fmt.Errorf("failed to create dynamic client: %w", err)
	}

	// Define RayCluster GVR (GroupVersionResource)
	rayClusterGVR := schema.GroupVersionResource{
		Group:    "ray.io",
		Version:  "v1",
		Resource: "rayclusters",
	}

	// Build RayCluster spec
	rayCluster := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "ray.io/v1",
			"kind":       "RayCluster",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": namespace,
				"labels":    labels,
			},
			"spec": map[string]interface{}{
				"rayVersion": defaultRayVersion,
				"headGroupSpec": map[string]interface{}{
					"rayStartParams": map[string]interface{}{
						"dashboard-host": "0.0.0.0",
						"num-cpus":       "0",
					},
					"template": map[string]interface{}{
						"spec": map[string]interface{}{
							"securityContext": map[string]interface{}{
								"fsGroup":    int64(100),
								"runAsUser":  int64(1000),
								"runAsGroup": int64(100),
							},
							"initContainers": []map[string]interface{}{
								{
									"name":  "fix-cfs-permissions",
									"image": "busybox:latest",
									"command": []string{
										"sh",
										"-c",
										"mkdir -p /cfs/rl-data && chown -R 1000:100 /cfs/rl-data && chmod -R 755 /cfs/rl-data || true",
									},
									"volumeMounts": []map[string]interface{}{
										{
											"name":      "rl-data",
											"mountPath": CFSMountPath,
										},
									},
									"securityContext": map[string]interface{}{
										"runAsUser": int64(0),
									},
								},
							},
							"containers": []map[string]interface{}{
								{
									"name":  "ray-head",
									"image": image,
									"ports": []map[string]interface{}{
										{"containerPort": int64(6379), "name": "gcs"},
										{"containerPort": int64(8265), "name": "dashboard"},
										{"containerPort": int64(10001), "name": "client"},
									},
									"resources": map[string]interface{}{
										"requests": map[string]interface{}{
											"cpu":    "500m",
											"memory": "1Gi",
										},
										"limits": map[string]interface{}{
											"cpu":    "2000m",
											"memory": "4Gi",
										},
									},
									"volumeMounts": []map[string]interface{}{
										{
											"name":      "rl-data",
											"mountPath": CFSMountPath,
										},
									},
								},
							},
							"volumes": []map[string]interface{}{
								{
									"name": "rl-data",
									"persistentVolumeClaim": map[string]interface{}{
										"claimName": DefaultPVCName,
									},
								},
							},
						},
					},
				},
				"workerGroupSpecs": []map[string]interface{}{
					{
						"replicas":    int64(workers),
						"minReplicas": int64(0),
						"maxReplicas": int64(workers * 2),
						"groupName":   "worker-group",
						"rayStartParams": map[string]interface{}{
							"num-cpus": "1",
						},
						"template": map[string]interface{}{
							"spec": map[string]interface{}{
								"securityContext": map[string]interface{}{
									"fsGroup":    int64(100),
									"runAsUser":  int64(1000),
									"runAsGroup": int64(100),
								},
								"initContainers": []map[string]interface{}{
									{
										"name":  "fix-cfs-permissions",
										"image": "busybox:latest",
										"command": []string{
											"sh",
											"-c",
											"mkdir -p /cfs/rl-data && chown -R 1000:100 /cfs/rl-data && chmod -R 755 /cfs/rl-data || true",
										},
										"volumeMounts": []map[string]interface{}{
											{
												"name":      "rl-data",
												"mountPath": CFSMountPath,
											},
										},
										"securityContext": map[string]interface{}{
											"runAsUser": int64(0),
										},
									},
								},
								"containers": []map[string]interface{}{
									{
										"name":  "ray-worker",
										"image": image,
										"resources": map[string]interface{}{
											"requests": map[string]interface{}{
												"cpu":    "200m",
												"memory": "512Mi",
											},
											"limits": map[string]interface{}{
												"cpu":    "1000m",
												"memory": "1Gi",
											},
										},
										"volumeMounts": []map[string]interface{}{
											{
												"name":      "rl-data",
												"mountPath": CFSMountPath,
											},
										},
									},
								},
								"volumes": []map[string]interface{}{
									{
										"name": "rl-data",
										"persistentVolumeClaim": map[string]interface{}{
											"claimName": DefaultPVCName,
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}

	// Create RayCluster
	_, err = dynamicClient.Resource(rayClusterGVR).Namespace(namespace).Create(ctx, rayCluster, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("failed to create RayCluster: %w (ensure KubeRay operator is installed in the cluster)", err)
	}

	log.Printf("Successfully created RayCluster '%s' in namespace '%s' with %d workers", name, namespace, workers)
	return nil
}