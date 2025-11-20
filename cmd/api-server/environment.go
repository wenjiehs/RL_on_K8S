package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strconv"
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

const (
	CFSMountPath    = "/mnt/cfs-turbo"
	DefaultPVCName   = "rl-cfs-turbo-pv"
)

// Environment represents a RL training environment
type Environment struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Framework   string            `json:"framework"` // ray, horovod, deepspeed, custom
	Image       string            `json:"image"`
	Replicas    int32             `json:"replicas"`
	CPU         int32             `json:"cpu"`
	Memory      int32             `json:"memory"`
	GPU         int32             `json:"gpu"`
	Status      string            `json:"status"` // pending, running, stopped, error
	Namespace   string            `json:"namespace"`
	Labels      map[string]string `json:"labels,omitempty" gorm:"type:text;serializer:json"`
	Annotations map[string]string `json:"annotations,omitempty" gorm:"type:text;serializer:json"`
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

// Predefined framework images - using images from training-config.yaml
var frameworkImages = map[string]string{
	"ray":       "ccr.ccs.tencentyun.com/halewang/verl:app-verl0.5-transformers4.55.4-vllm0.10.0-mcore0.13.0-te2.2-v1",  // From training-config.yaml
	"horovod":   "horovod/horovod:latest",
	"deepspeed": "deepspeed/deepspeed:latest",
}

// RayCluster configuration - using image from training-config.yaml
const (
	defaultRayVersion = "2.9.0"
	defaultRayImage   = "ccr.ccs.tencentyun.com/halewang/verl:app-verl0.5-transformers4.55.4-vllm0.10.0-mcore0.13.0-te2.2-v1"
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
		// Extract resources from deployment
		var cpu, memory, gpu int32 = 4, 16, 1 // defaults
		
		if len(dep.Spec.Template.Spec.Containers) > 0 {
			container := dep.Spec.Template.Spec.Containers[0]
			if container.Resources.Requests != nil {
				if cpuVal := container.Resources.Requests.Cpu(); cpuVal != nil {
					cpu = int32(cpuVal.Value())
				}
				if memVal := container.Resources.Requests.Memory(); memVal != nil {
					// Convert bytes to GB (approximately)
					memory = int32(memVal.Value() / (1024 * 1024 * 1024))
				}
				// Skip GPU for deployments as they are not Ray clusters
			}
		}
		
		env := Environment{
			ID:          string(dep.UID),
			Name:        dep.Name,
			Framework:   dep.Labels["rl-framework"],
			Image:       getImageFromDeployment(&dep),
			Replicas:    *dep.Spec.Replicas,
			CPU:         cpu,
			Memory:      memory,
			GPU:         gpu,
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
		// Add REST config check
		if currentRestConfig == nil {
			respondJSON(w, http.StatusInternalServerError, map[string]string{
				"error": "Kubernetes REST config is not available. Please ensure cluster connection is established.",
			})
			return
		}
		
		err := createRayCluster(ctx, req.Name, req.Namespace, image, req.Replicas, labels)
		if err != nil {
			log.Printf("Failed to create Ray cluster: %v", err)
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
	
	// Extract worker replicas and resources
	var replicas int32 = 0
	var cpu int32 = 4
	var memory int32 = 16
	var gpu int32 = 1
	
	if workerGroupSpecs, ok := spec["workerGroupSpecs"].([]interface{}); ok && len(workerGroupSpecs) > 0 {
		if workerGroup, ok := workerGroupSpecs[0].(map[string]interface{}); ok {
			if r, ok := workerGroup["replicas"].(int64); ok {
				replicas = int32(r)
			}
			
			// Extract resources from worker group template
			if template, ok := workerGroup["template"].(map[string]interface{}); ok {
				if podSpec, ok := template["spec"].(map[string]interface{}); ok {
					// Extract CPU and Memory from resources
					if containers, ok := podSpec["containers"].([]interface{}); ok && len(containers) > 0 {
						if container, ok := containers[0].(map[string]interface{}); ok {
							if containerResources, ok := container["resources"].(map[string]interface{}); ok {
								// Check limits first, then requests
								var resourcesToCheck map[string]interface{}
								if limits, ok := containerResources["limits"].(map[string]interface{}); ok {
									resourcesToCheck = limits
								} else if requests, ok := containerResources["requests"].(map[string]interface{}); ok {
									resourcesToCheck = requests
								}
								
								if cpuVal, ok := resourcesToCheck["cpu"]; ok {
									if cpuStr, ok := cpuVal.(string); ok {
										if parsedCPU, err := parseCPU(cpuStr); err == nil {
											cpu = parsedCPU
										}
									}
								}
								if memVal, ok := resourcesToCheck["memory"]; ok {
									if memStr, ok := memVal.(string); ok {
										if parsedMem, err := parseMemory(memStr); err == nil {
											memory = parsedMem
										}
									}
								}
								if gpuVal, ok := resourcesToCheck["nvidia.com/gpu"]; ok {
									// Handle different GPU value types
									switch v := gpuVal.(type) {
									case string:
										if parsedGPU, err := parseGPU(v); err == nil {
											gpu = parsedGPU
										}
									case int64:
										gpu = int32(v)
									case float64:
										gpu = int32(v)
									}
								}
							}
						}
					}
				}
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
		CPU:       cpu,
		Memory:    memory,
		GPU:       gpu,
		Status:    envStatus,
		Namespace: namespace,
		Labels:    labelMap,
		CreatedAt: createdAt,
		UpdatedAt: createdAt,
	}
}

// parseCPU parses CPU string like "4" or "4000m" to int32
func parseCPU(cpuStr string) (int32, error) {
	if strings.HasSuffix(cpuStr, "m") {
		// Millicores
		millis := strings.TrimSuffix(cpuStr, "m")
		if millis, err := strconv.Atoi(millis); err == nil {
			return int32(millis / 1000), nil
		}
	} else {
		// Cores
		if cores, err := strconv.Atoi(cpuStr); err == nil {
			return int32(cores), nil
		}
	}
	return 0, fmt.Errorf("invalid CPU format: %s", cpuStr)
}

// parseMemory parses memory string like "16Gi" to int32 (in GB)
func parseMemory(memStr string) (int32, error) {
	if strings.HasSuffix(memStr, "Gi") {
		gi := strings.TrimSuffix(memStr, "Gi")
		if gb, err := strconv.Atoi(gi); err == nil {
			return int32(gb), nil
		}
	} else if strings.HasSuffix(memStr, "G") {
		g := strings.TrimSuffix(memStr, "G")
		if gb, err := strconv.Atoi(g); err == nil {
			return int32(gb), nil
		}
	} else if strings.HasSuffix(memStr, "Mi") {
		mi := strings.TrimSuffix(memStr, "Mi")
		if mb, err := strconv.Atoi(mi); err == nil {
			return int32(mb / 1024), nil
		}
	}
	return 0, fmt.Errorf("invalid memory format: %s", memStr)
}

// parseGPU parses GPU string to int32
func parseGPU(gpuStr string) (int32, error) {
	if gpu, err := strconv.Atoi(gpuStr); err == nil {
		return int32(gpu), nil
	}
	return 0, fmt.Errorf("invalid GPU format: %s", gpuStr)
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
// Configuration based on ray-single-group in rl namespace
func createRayCluster(ctx context.Context, name, namespace, image string, workers int32, labels map[string]string) error {
	// Add nil check for REST config
	if currentRestConfig == nil {
		return fmt.Errorf("REST config is not available")
	}

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

	// Common environment variables (from ray-single-group)
	commonEnvVars := []map[string]interface{}{
		{"name": "RAY_GCS_SERVER_PORT", "value": "6379"},
		{"name": "GLOO_SOCKET_IFNAME", "value": "eth0"},
		{"name": "MASTER_ADDR", "value": "10.32.5.71"},
		{"name": "NCCL_SOCKET_IFNAME", "value": "bond0"},
		{"name": "NCCL_P2P_LEVEL", "value": "NVL"},
		{"name": "NCCL_P2P_DISABLE", "value": "0"},
		{"name": "NCCL_TIMEOUT", "value": "86400"},
		{"name": "TORCH_NCCL_HEARTBEAT_TIMEOUT_SEC", "value": "36000"},
		{"name": "NCCL_CHECK_DISABLE", "value": "1"},
		{"name": "NCCL_IB_DISABLE", "value": "0"},
		{"name": "NCCL_IB_TIMEOUT", "value": "24"},
		{"name": "NCCL_IB_GID_INDEX", "value": "3"},
		{"name": "NCCL_IB_SL", "value": "3"},
		{"name": "NCCL_IB_HCA", "value": "mlx5_bond_0"},
		{"name": "NCCL_IB_CUDA_SUPPORT", "value": "1"},
		{"name": "NCCL_IB_QPS_PER_CONNECTION", "value": "4"},
		{"name": "NCCL_IB_TC", "value": "160"},
		{"name": "NCCL_NVLS_ENABLE", "value": "0"},
		{"name": "NCCL_COLLNET_ENABLE", "value": "0"},
		{"name": "NCCL_NET_GDR_LEVEL", "value": "2"},
		{"name": "NCCL_LL_THRESHOLD", "value": "16384"},
		{"name": "NCCL_PXN_DISABLE", "value": "1"},
		{"name": "NCCL_MPI_PROFILE_PRIMS_ENABLE", "value": "0"},
		{"name": "UCX_NET_DEVICES", "value": "bond1"},
		{"name": "NVSHMEM_BOOTSTRAP_UID_SOCK_IFNAME", "value": "bond1"},
		{"name": "SHARP_COLL_ENABLE_SAT", "value": "0"},
		{"name": "NCCL_DEBUG", "value": "INFO"},
		{"name": "PYTHONPATH", "value": "/workspace/verl"},
	}

	// Common volume mounts (from ray-single-group)
	commonVolumeMounts := []map[string]interface{}{
		{"mountPath": "/mnt/cfs-turbo", "name": "cfs-turbo"},
		{"mountPath": "/dev/shm", "name": "dev-shm"},
		{"mountPath": "/usr/src", "name": "usr-src"},
		{"mountPath": "/lib/modules", "name": "lib-modules", "readOnly": true},
		{"mountPath": "/dev/infiniband", "name": "dev-infiniband"},
	}

	// Common volumes (from ray-single-group)
	commonVolumes := []map[string]interface{}{
		{
			"name": "cfs-turbo",
			"persistentVolumeClaim": map[string]interface{}{
				"claimName": "rl-cfs-turbo-pv",
			},
		},
		{
			"name": "dev-shm",
			"hostPath": map[string]interface{}{
				"path": "/dev/shm",
				"type": "Directory",
			},
		},
		{
			"name": "usr-src",
			"hostPath": map[string]interface{}{
				"path": "/usr/src",
				"type": "Directory",
			},
		},
		{
			"name": "lib-modules",
			"hostPath": map[string]interface{}{
				"path": "/lib/modules",
				"type": "Directory",
			},
		},
		{
			"name": "dev-infiniband",
			"hostPath": map[string]interface{}{
				"path": "/dev/infiniband",
				"type": "Directory",
			},
		},
	}

	// Common tolerations - 支持多种 debug 污点
	commonTolerations := []map[string]interface{}{
		{
			"effect":   "NoSchedule",
			"key":      "debug",
			"operator": "Exists", // 容忍所有 debug 相关的污点
		},
		{
			"effect":   "NoSchedule",
			"key":      "user",
			"operator": "Exists", // 容忍所有 user 相关的污点
		},
	}

	// Common node affinity - 使用偏好性而非强制性
	nodeAffinity := map[string]interface{}{
		"preferredDuringSchedulingIgnoredDuringExecution": []map[string]interface{}{
			{
				"weight": int64(100),
				"preference": map[string]interface{}{
					"matchExpressions": []map[string]interface{}{
						{
							"key":      "env",
							"operator": "In",
							"values":   []string{"debug"},
						},
					},
				},
			},
		},
	}

	// Build RayCluster spec with ray-single-group configuration
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
				"headGroupSpec": map[string]interface{}{
					"rayStartParams": map[string]interface{}{
						"dashboard-host": "0.0.0.0",
					},
					"serviceType": "ClusterIP",
					"template": map[string]interface{}{
						"metadata": map[string]interface{}{
							"labels": map[string]string{
								"app":  "lws-new",
								"env":  "debug",
								"role": "leader",
							},
						},
						"spec": map[string]interface{}{
							"affinity": map[string]interface{}{
								"nodeAffinity": nodeAffinity,
							},
							"tolerations": commonTolerations,
							"hostNetwork": true,
							"hostIPC":     true,
							"hostPID":     true,
							"dnsPolicy":   "ClusterFirstWithHostNet",
							"restartPolicy": "Always",
							"containers": []map[string]interface{}{
								{
									"name":            "ray-head",
									"image":           image,
									"imagePullPolicy": "IfNotPresent",
									"env":             commonEnvVars,
									"ports": []map[string]interface{}{
										{"containerPort": int64(6379)},
										{"containerPort": int64(8265)},
										{"containerPort": int64(10001)},
									},
									"resources": map[string]interface{}{
										"requests": map[string]interface{}{
											"cpu":            "32",
											"memory":         "128Gi",
											"nvidia.com/gpu": "8",
										},
										"limits": map[string]interface{}{
											"cpu":            "32",
											"memory":         "1000Gi",
											"nvidia.com/gpu": "8",
										},
									},
									"securityContext": map[string]interface{}{
										"privileged": true,
										"capabilities": map[string]interface{}{
											"add": []string{"IPC_LOCK"},
										},
									},
									"volumeMounts": commonVolumeMounts,
								},
							},
							"volumes": commonVolumes,
						},
					},
				},
				"workerGroupSpecs": []map[string]interface{}{
					{
						"replicas":    int64(workers),
						"minReplicas": int64(1),
						"maxReplicas": int64(1),
						"groupName":   "default-group",
						"rayStartParams": map[string]interface{}{},
						"template": map[string]interface{}{
							"metadata": map[string]interface{}{
								"labels": map[string]string{
									"app":  "lws-new",
									"env":  "debug",
									"role": "worker",
								},
							},
							"spec": map[string]interface{}{
								"affinity": map[string]interface{}{
									"nodeAffinity": nodeAffinity,
								},
								"tolerations": commonTolerations,
								"hostNetwork": true,
								"hostIPC":     true,
								"hostPID":     true,
								"dnsPolicy":   "ClusterFirstWithHostNet",
								"restartPolicy": "Always",
								"containers": []map[string]interface{}{
									{
										"name":            "ray-worker",
										"image":           image,
										"imagePullPolicy": "IfNotPresent",
										"env":             commonEnvVars,
										"resources": map[string]interface{}{
											"requests": map[string]interface{}{
												"cpu":            "32",
												"memory":         "128Gi",
												"nvidia.com/gpu": int64(8),
											},
											"limits": map[string]interface{}{
												"cpu":            "32",
												"memory":         "1000Gi",
												"nvidia.com/gpu": int64(8),
											},
										},
										"securityContext": map[string]interface{}{
											"privileged": true,
											"capabilities": map[string]interface{}{
												"add": []string{"IPC_LOCK"},
											},
										},
										"volumeMounts": commonVolumeMounts,
									},
								},
								"volumes": commonVolumes,
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

	log.Printf("Successfully created RayCluster '%s' in namespace '%s' with %d workers (based on ray-single-group configuration)", name, namespace, workers)
	return nil
}