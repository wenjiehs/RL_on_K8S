package main

const (
	// API响应状态
	StatusSuccess = "success"
	StatusError   = "error"
	StatusPending = "pending"
	StatusRunning = "running"
	StatusStopped = "stopped"
	StatusPaused  = "paused"
	StatusFailed  = "failed"
	
	// 训练任务状态
	JobStatusCreated  = "created"
	JobStatusPending  = "pending"
	JobStatusRunning  = "running"
	JobStatusPaused   = "paused"
	JobStatusStopped  = "stopped"
	JobStatusFailed   = "failed"
	JobStatusSucceeded = "succeeded"
	JobStatusUnknown  = "unknown"
	
	// 算法类型
	AlgorithmPPO  = "ppo"
	AlgorithmDQN  = "dqn"
	AlgorithmSAC  = "sac"
	AlgorithmA3C  = "a3c"
	AlgorithmTD3  = "td3"
)