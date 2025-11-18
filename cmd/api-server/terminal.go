package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"
)

// WebSocket upgrader configuration
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow connections from frontend origins
		origin := r.Header.Get("Origin")
		// Also allow empty origin for some WebSocket clients
		if origin == "" {
			return true
		}
		return origin == "http://localhost:5173" || 
		       origin == "http://localhost:5174" || 
		       origin == "http://localhost:5175" ||
		       origin == "http://localhost:3000" // Additional common dev port
	},
}

// TerminalMessage represents messages sent between client and server
type TerminalMessage struct {
	Type      string `json:"type"`      // "input", "resize", "command", "output", "error", "status"
	Data      string `json:"data"`      // terminal input/output
	Command   string `json:"command"`   // for command type
	Timestamp int64  `json:"timestamp"` // for command tracking
	Rows      uint16 `json:"rows,omitempty"`
	Cols      uint16 `json:"cols,omitempty"`
}

// TerminalSession represents a terminal session
type TerminalSession struct {
	wsConn    *websocket.Conn
	sizeChan  chan remotecommand.TerminalSize
	doneChan  chan struct{}
	sessionID string
	podName   string
	namespace string
	envName   string
	writeMutex sync.Mutex // Add mutex for thread-safe writes
}

// SessionManager manages active terminal sessions
type SessionManager struct {
	sessions map[string]*TerminalSession
	mutex    sync.RWMutex
}

var sessionManager = &SessionManager{
	sessions: make(map[string]*TerminalSession),
}

// Read implements the io.Reader interface for terminal input
func (t *TerminalSession) Read(p []byte) (int, error) {
	for {
		_, message, err := t.wsConn.ReadMessage()
		if err != nil {
			return 0, err
		}

		var msg TerminalMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Failed to unmarshal message: %v", err)
			continue // Try next message instead of returning error
		}

		// Handle different message types
		switch msg.Type {
		case "input", "command":
			if len(msg.Data) > 0 {
				copy(p, msg.Data)
				return len(msg.Data), nil
			}
		case "resize":
			// Send resize event
			select {
			case t.sizeChan <- remotecommand.TerminalSize{
				Width:  msg.Cols,
				Height: msg.Rows,
			}:
			default:
			}
			// Continue reading for input data
		default:
			log.Printf("Unknown message type: %s", msg.Type)
			// Continue reading for valid messages
		}
	}
}

// Write implements the io.Writer interface for terminal output
func (t *TerminalSession) Write(p []byte) (int, error) {
	if len(p) == 0 {
		return 0, nil
	}
	
	// Use mutex to prevent concurrent writes
	t.writeMutex.Lock()
	defer t.writeMutex.Unlock()
	
	output := string(p)
	
	// Send raw output directly without JSON wrapping for better terminal compatibility
	// This allows xterm.js to properly handle ANSI escape sequences
	err := t.wsConn.WriteMessage(websocket.TextMessage, []byte(output))
	if err != nil {
		return 0, err
	}
	return len(p), nil
}

// cleanANSIEscapeSequences removes ANSI escape sequences from terminal output
func cleanANSIEscapeSequences(input string) string {
	// Simple approach: remove common ANSI patterns that cause display issues
	// Remove common ANSI escape sequences
	replacements := []struct{
		pattern     string
		replacement string
	}{
		{"\x1b", ""},           // ESC [
		{"\x1b[0m", ""},          // Reset colors
		{"\x1b[1m", ""},          // Set foreground color
		{"\x1b[36m", ""},         // Set background color
		{"\x1b[4m", ""},           // Underline
		{"\x1b[24m", ""},          // Blink
		{"\x08", ""},             // Backspace
		{"\x07", ""},             // Bell
	}
	
	result := input
	for _, repl := range replacements {
		result = strings.ReplaceAll(result, repl.pattern, repl.replacement)
	}
	
	return result
}

// Next implements the TerminalSizeQueue interface
func (t *TerminalSession) Next() *remotecommand.TerminalSize {
	select {
	case size := <-t.sizeChan:
		return &size
	case <-t.doneChan:
		return nil
	}
}

// Close closes the terminal session
func (t *TerminalSession) Close() error {
	close(t.doneChan)
	
	// Remove from session manager
	sessionManager.mutex.Lock()
	delete(sessionManager.sessions, t.sessionID)
	sessionManager.mutex.Unlock()
	
	return t.wsConn.Close()
}

// generateSessionID generates a unique session ID
func generateSessionID() string {
	return strconv.FormatInt(time.Now().UnixNano(), 36)
}

// handleTerminalConnect handles WebSocket connections for terminal access
func handleTerminalConnect(w http.ResponseWriter, r *http.Request) {
	if currentClientset == nil || currentRestConfig == nil {
		http.Error(w, "Not connected to any cluster", http.StatusBadRequest)
		return
	}

	// Handle WebSocket upgrade first for direct connections
	if websocket.IsWebSocketUpgrade(r) {
		handleWebSocketTerminal(w, r)
		return
	}

	// Handle REST API for session creation
	if r.Method == "POST" {
		handleCreateTerminalSession(w, r)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// handleWebSocketTerminal handles direct WebSocket connections
func handleWebSocketTerminal(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	envName := query.Get("environment")
	namespace := query.Get("namespace")
	sessionID := query.Get("session")
	
	// Support both 'environment' and 'name' parameters for compatibility
	if envName == "" {
		envName = query.Get("name")
	}
	
	if namespace == "" {
		namespace = "default"
	}

	if envName == "" && sessionID == "" {
		http.Error(w, "Environment name or session ID is required", http.StatusBadRequest)
		return
	}

	// Upgrade HTTP connection to WebSocket
	wsConn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade to WebSocket: %v", err)
		return
	}
	defer wsConn.Close()

	var session *TerminalSession
	
	if sessionID != "" {
		// Reconnect to existing session
		sessionManager.mutex.RLock()
		s, exists := sessionManager.sessions[sessionID]
		sessionManager.mutex.RUnlock()
		
		if exists {
			session = s
			session.wsConn = wsConn
			log.Printf("Reconnected to session %s for environment: %s", sessionID, session.envName)
		} else {
			wsConn.WriteMessage(websocket.TextMessage, []byte(`{"type":"error","content":"Session not found"}`))
			return
		}
	} else {
		// Create new session
		podName, err := findRayHeadPod(context.Background(), envName, namespace)
		if err != nil {
			errMsg := fmt.Sprintf(`{"type":"error","content":"Failed to find Ray head pod: %v"}`, err)
			wsConn.WriteMessage(websocket.TextMessage, []byte(errMsg))
			return
		}

		sessionID = generateSessionID()
		session = &TerminalSession{
			wsConn:    wsConn,
			sizeChan:  make(chan remotecommand.TerminalSize, 1),
			doneChan:  make(chan struct{}),
			sessionID: sessionID,
			podName:   podName,
			namespace: namespace,
			envName:   envName,
		}

		// Add to session manager
		sessionManager.mutex.Lock()
		sessionManager.sessions[sessionID] = session
		sessionManager.mutex.Unlock()

		log.Printf("Created new session %s for environment: %s in namespace: %s (pod: %s)", 
			sessionID, envName, namespace, podName)
	}

	// Send session info
	sessionInfo := fmt.Sprintf(`{"type":"status","content":"Connected to session %s"}`, session.sessionID)
	wsConn.WriteMessage(websocket.TextMessage, []byte(sessionInfo))

	// Set initial terminal size
	session.sizeChan <- remotecommand.TerminalSize{
		Width:  80,
		Height: 24,
	}

	// Execute command in pod
	req := currentClientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(session.podName).
		Namespace(session.namespace).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: "ray-head",
			Command:   []string{"/bin/bash"},
			Stdin:     true,
			Stdout:    true,
			Stderr:    true,
			TTY:       true,
		}, scheme.ParameterCodec)

	executor, err := remotecommand.NewSPDYExecutor(currentRestConfig, "POST", req.URL())
	if err != nil {
		errMsg := fmt.Sprintf(`{"type":"error","content":"Failed to create executor: %v"}`, err)
		wsConn.WriteMessage(websocket.TextMessage, []byte(errMsg))
		return
	}

	// Start: exec stream
	ctx := context.Background()
	err = executor.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdin:             session,
		Stdout:            session,
		Stderr:            session,
		Tty:               true,
		TerminalSizeQueue:   session,
	})

	if err != nil {
		errMsg := fmt.Sprintf(`{"type":"error","content":"Stream error: %v"}`, err)
		wsConn.WriteMessage(websocket.TextMessage, []byte(errMsg))
		return
	}

	log.Printf("Terminal session %s ended for pod: %s", session.sessionID, session.podName)
}

// handleCreateTerminalSession creates a new terminal session via REST API
func handleCreateTerminalSession(w http.ResponseWriter, r *http.Request) {
	var request struct {
		EnvironmentName string `json:"environmentName"`
		Namespace      string `json:"namespace"`
		Pod            string `json:"pod,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if request.Namespace == "" {
		request.Namespace = "default"
	}

	// Find Ray head pod
	podName := request.Pod
	if podName == "" {
		var err error
		podName, err = findRayHeadPod(context.Background(), request.EnvironmentName, request.Namespace)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to find Ray head pod: %v", err), http.StatusBadRequest)
			return
		}
	}

	// Generate session ID
	sessionID := generateSessionID()

	// Create session (without WebSocket connection)
	session := &TerminalSession{
		wsConn:    nil, // Will be set when WebSocket connects
		sizeChan:  make(chan remotecommand.TerminalSize, 1),
		doneChan:  make(chan struct{}),
		sessionID: sessionID,
		podName:   podName,
		namespace: request.Namespace,
		envName:   request.EnvironmentName,
	}

	// Add to session manager
	sessionManager.mutex.Lock()
	sessionManager.sessions[sessionID] = session
	sessionManager.mutex.Unlock()

	response := map[string]interface{}{
		"sessionId": sessionID,
		"pod":      podName,
		"namespace": request.Namespace,
		"environment": request.EnvironmentName,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handleTerminalSession handles session-specific operations
func handleTerminalSession(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("id")
	if sessionID == "" {
		http.Error(w, "Session ID is required", http.StatusBadRequest)
		return
	}

	sessionManager.mutex.RLock()
	session, exists := sessionManager.sessions[sessionID]
	sessionManager.mutex.RUnlock()

	if !exists {
		http.Error(w, "Session not found", http.StatusNotFound)
		return
	}

	// Handle different operations
	switch r.Method {
	case "POST":
		// Disconnect session
		if r.URL.Path == "/disconnect" {
			if session.wsConn != nil {
				session.wsConn.Close()
			}
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]string{"status": "disconnected"})
		}
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleTerminalConnectToPod handles direct pod connection
func handleTerminalConnectToPod(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		EnvironmentName string `json:"environmentName"`
		Namespace      string `json:"namespace"`
		Pod            string `json:"pod"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if request.Namespace == "" {
		request.Namespace = "default"
	}

	// Verify pod exists
	ctx := context.Background()
	pod, err := currentClientset.CoreV1().Pods(request.Namespace).Get(ctx, request.Pod, metav1.GetOptions{})
	if err != nil {
		http.Error(w, fmt.Sprintf("Pod not found: %v", err), http.StatusNotFound)
		return
	}

	// Check if it's a Ray head pod
	if !isRayHeadPod(pod) {
		http.Error(w, "Pod is not a Ray head pod", http.StatusBadRequest)
		return
	}

	// Create session
	sessionID := generateSessionID()
	session := &TerminalSession{
		wsConn:    nil,
		sizeChan:  make(chan remotecommand.TerminalSize, 1),
		doneChan:  make(chan struct{}),
		sessionID: sessionID,
		podName:   request.Pod,
		namespace: request.Namespace,
		envName:   request.EnvironmentName,
	}

	sessionManager.mutex.Lock()
	sessionManager.sessions[sessionID] = session
	sessionManager.mutex.Unlock()

	response := map[string]interface{}{
		"success":   true,
		"sessionId": sessionID,
		"pod":       request.Pod,
		"namespace": request.Namespace,
		"environment": request.EnvironmentName,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// findRayHeadPod finds the Ray head pod for a given environment
func findRayHeadPod(ctx context.Context, envName, namespace string) (string, error) {
	// List pods with label selector for Ray head
	labelSelector := fmt.Sprintf("ray.io/cluster=%s,ray.io/node-type=head", envName)
	
	pods, err := currentClientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	
	if err != nil {
		return "", fmt.Errorf("failed to list pods: %w", err)
	}

	if len(pods.Items) == 0 {
		return "", fmt.Errorf("no Ray head pod found for environment: %s", envName)
	}

	// Find a running pod
	for _, pod := range pods.Items {
		if pod.Status.Phase == corev1.PodRunning {
			// Check if all containers are ready
			allReady := true
			for _, containerStatus := range pod.Status.ContainerStatuses {
				if !containerStatus.Ready {
					allReady = false
					break
				}
			}
			if allReady {
				return pod.Name, nil
			}
		}
	}

	// If no running pod found, return the first one
	return pods.Items[0].Name, nil
}

// isRayHeadPod checks if a pod is a Ray head pod
func isRayHeadPod(pod *corev1.Pod) bool {
	// Check labels
	if pod.Labels != nil {
		if nodeType, exists := pod.Labels["ray.io/node-type"]; exists && nodeType == "head" {
			return true
		}
		if _, exists := pod.Labels["app.kubernetes.io/instance"]; exists {
			// Check if pod name ends with -head
			return len(pod.Name) > 5 && pod.Name[len(pod.Name)-5:] == "-head"
		}
	}
	
	// Check container names
	for _, container := range pod.Spec.Containers {
		if container.Name == "ray-head" {
			return true
		}
	}
	
	return false
}