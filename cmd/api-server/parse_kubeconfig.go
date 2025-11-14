package main

import (
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"

	"k8s.io/client-go/tools/clientcmd"
)

type ParseKubeconfigRequest struct {
	KubeConfig string `json:"kubeConfig"` // Base64 encoded kubeconfig file content
}

func handleParseKubeconfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ParseKubeconfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Invalid request body: " + err.Error(),
		})
		return
	}

	// Decode base64 kubeconfig
	kubeconfigData, err := base64.StdEncoding.DecodeString(req.KubeConfig)
	if err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Failed to decode kubeconfig: " + err.Error(),
		})
		return
	}

	// Parse kubeconfig
	apiConfig, err := clientcmd.Load(kubeconfigData)
	if err != nil {
		log.Printf("Failed to load kubeconfig: %v", err)
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Failed to parse kubeconfig: " + err.Error(),
		})
		return
	}

	// Extract contexts
	var contexts []ContextInfo
	for name, ctx := range apiConfig.Contexts {
		contexts = append(contexts, ContextInfo{
			Name:    name,
			Cluster: ctx.Cluster,
			User:    ctx.AuthInfo,
		})
		log.Printf("Found context: %s (cluster: %s, user: %s)", name, ctx.Cluster, ctx.AuthInfo)
	}

	log.Printf("Current context from kubeconfig: %s", apiConfig.CurrentContext)
	log.Printf("Total contexts found: %d", len(contexts))

	// Validate current context exists, if not use first available
	currentCtx := apiConfig.CurrentContext
	if _, ok := apiConfig.Contexts[currentCtx]; !ok && len(contexts) > 0 {
		currentCtx = contexts[0].Name
		log.Printf("WARNING: Current context '%s' not found, using first available: '%s'", apiConfig.CurrentContext, currentCtx)
	}

	info := KubeConfigInfo{
		Contexts:       contexts,
		CurrentContext: currentCtx,
	}

	respondJSON(w, http.StatusOK, info)
}