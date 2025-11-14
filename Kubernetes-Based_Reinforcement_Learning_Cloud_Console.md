# Kubernetes-Based Reinforcement Learning Cloud Console

## Core Features

- Kubernetes-native environment and training job management

- Elastic resource scaling and automated fault recovery

- Real-time monitoring, diagnostics, and intelligent alerting

- Integrated data lifecycle management with version control

## Tech Stack

{
  "Web": {
    "arch": "react",
    "component": "tdesign"
  },
  "Backend": "Go (Kubernetes Operator), Python (ML Services)",
  "Infrastructure": "Kubernetes, Docker, Prometheus, Grafana, Ray, MLflow, Tencent Cloud COS/CKafka"
}

## Design

A clean and practical dashboard using Material Design principles, featuring a left-sidebar navigation and a content area with cards, data tables, and interactive charts to manage complex RL workflows efficiently.

## Plan

Note: 

- [ ] is holding
- [/] is doing
- [X] is done

---

[X] Develop Kubernetes CRDs and a basic Operator in Go for `RLEnvironment` and `RLTrainingJob` to manage their lifecycles (create, delete).

[X] Implement the Environment Management module, enabling the deployment of RL environments from pre-built or custom images via the Operator.

[X] Build the core Training Management functionality, integrating the Operator with the Ray framework to orchestrate distributed training jobs on Kubernetes.

[X] Set up the monitoring pipeline with Prometheus/Grafana and develop the initial frontend dashboard in React to display environment and training job status and metrics.

[X] Implement the data collection sidecar to capture and stream interaction data to Tencent Cloud COS, and integrate MLflow for dataset versioning visible in the UI.

[X] Enhance the system with advanced features: Horizontal Pod Autoscaler (HPA) for environments and automatic checkpointing/recovery for training jobs.

[X] Develop the monitoring and diagnostics module, including anomaly detection logic and a configurable alerting system (Webhook/Email).
