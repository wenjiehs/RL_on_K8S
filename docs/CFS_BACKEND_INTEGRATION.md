# CFS Backend Integration Guide

## Overview

This document describes the CFS (Cloud File Storage) backend integration for the RL Console platform. The integration provides persistent storage for training data, models, and experiment results using Tencent Cloud CFS Turbo.

## Architecture

### Storage Configuration

- **Storage Type**: Tencent Cloud CFS Turbo
- **Filesystem ID**: 83d8ea56
- **Mount Point**: 10.32.5.135
- **Total Capacity**: 35TB
- **CSI Driver**: com.tencent.cloud.csi.cfsturbo
- **StorageClass**: cfs-turbo-sc
- **Access Mode**: ReadWriteMany (RWX)

### Directory Structure

```
/cfs/rl-data/
├── {experiment_id}/
│   ├── raw/
│   │   └── {date}/
│   ├── train/
│   │   └── {date}/
│   ├── eval/
│   │   └── {date}/
│   └── model/
│       └── {date}/
```

## Backend Components

### 1. Storage Configuration Module (`storage_config.go`)

Manages CFS storage configuration and PVC lifecycle.

#### Key Functions

- `GetDefaultCFSConfig()`: Returns default CFS configuration
- `EnsureStorageClass(ctx)`: Creates StorageClass if not exists
- `EnsurePVC(ctx, namespace)`: Creates PVC if not exists
- `GetPVCStatus(ctx, namespace)`: Returns PVC status
- `VerifyCFSMount()`: Verifies CFS mount accessibility
- `CreateCFSVolumeMount(subPath)`: Creates volume mount configuration

#### Constants

```go
const (
    CFSStorageClass = "cfs-turbo-sc"
    CFSFsID         = "83d8ea56"
    CFSHost         = "10.32.5.135"
    CFSProvisioner  = "com.tencent.cloud.csi.cfsturbo"
    DefaultPVCName  = "rl-data-storage"
    DefaultPVCSize  = "100Gi"
    CFSMountPath    = "/cfs"
    CFSDataPath     = "/cfs/rl-data"
)
```

### 2. Storage Handler Module (`storage_handler.go`)

Provides HTTP API endpoints for storage management.

#### API Endpoints

##### GET /api/storage/status

Returns current CFS storage status.

**Query Parameters:**
- `namespace` (optional): Kubernetes namespace (default: "default")

**Response:**
```json
{
  "connected": true,
  "config": {
    "storageClass": "cfs-turbo-sc",
    "fsid": "83d8ea56",
    "host": "10.32.5.135",
    "provisioner": "com.tencent.cloud.csi.cfsturbo",
    "pvcName": "rl-data-storage",
    "pvcSize": "100Gi",
    "mountPath": "/cfs",
    "dataPath": "/cfs/rl-data"
  },
  "pvcStatus": "Bound",
  "mountHealthy": true
}
```

##### GET /api/storage/config

Returns CFS storage configuration.

**Response:**
```json
{
  "storageClass": "cfs-turbo-sc",
  "fsid": "83d8ea56",
  "host": "10.32.5.135",
  "provisioner": "com.tencent.cloud.csi.cfsturbo",
  "pvcName": "rl-data-storage",
  "pvcSize": "100Gi",
  "mountPath": "/cfs",
  "dataPath": "/cfs/rl-data"
}
```

##### POST /api/storage/initialize

Initializes CFS storage (creates StorageClass and PVC).

**Request Body:**
```json
{
  "namespace": "default"
}
```

**Response:**
```json
{
  "message": "Storage initialized successfully",
  "namespace": "default",
  "pvcName": "rl-data-storage"
}
```

### 3. Environment Integration

Ray environments automatically mount CFS storage when created.

#### RayCluster Configuration

The `createRayCluster` function in `environment.go` has been updated to include CFS volume mounts:

**Head Node:**
```yaml
spec:
  headGroupSpec:
    template:
      spec:
        containers:
        - name: ray-head
          volumeMounts:
          - name: rl-data
            mountPath: /cfs
        volumes:
        - name: rl-data
          persistentVolumeClaim:
            claimName: rl-data-storage
```

**Worker Nodes:**
```yaml
spec:
  workerGroupSpecs:
  - template:
      spec:
        containers:
        - name: ray-worker
          volumeMounts:
          - name: rl-data
            mountPath: /cfs
        volumes:
        - name: rl-data
          persistentVolumeClaim:
            claimName: rl-data-storage
```

## Usage

### 1. Initialize Storage

Before creating environments, initialize the CFS storage:

```bash
curl -X POST http://localhost:8080/api/storage/initialize \
  -H "Content-Type: application/json" \
  -d '{"namespace":"default"}'
```

### 2. Check Storage Status

```bash
curl http://localhost:8080/api/storage/status?namespace=default
```

### 3. Create Environment with CFS

When you create a Ray environment, CFS will be automatically mounted:

```bash
curl -X POST http://localhost:8080/api/environments/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-ray-env",
    "framework": "ray",
    "image": "rayproject/ray:2.9.0-py310",
    "replicas": 2,
    "namespace": "default"
  }'
```

### 4. Access CFS from Ray

Inside Ray pods, access CFS at `/cfs/rl-data`:

```python
import os

# Write data
with open('/cfs/rl-data/experiment-1/raw/2025-01-17/data.txt', 'w') as f:
    f.write('training data')

# Read data
with open('/cfs/rl-data/experiment-1/raw/2025-01-17/data.txt', 'r') as f:
    data = f.read()
```

## Testing

### Automated Test Script

Run the integration test script:

```bash
./scripts/test-cfs-integration.sh
```

This script will:
1. Test storage API endpoints
2. Initialize storage (create PVC)
3. Create a test Ray environment
4. Verify CFS mount in Ray pods
5. Test write access to CFS

### Manual Testing

1. **Check PVC Status:**
```bash
kubectl get pvc -n default rl-data-storage
```

2. **Check StorageClass:**
```bash
kubectl get storageclass cfs-turbo-sc
```

3. **Verify Mount in Pod:**
```bash
# Get Ray head pod name
POD=$(kubectl get pods -n default -l ray.io/node-type=head -o jsonpath='{.items[0].metadata.name}')

# Check mount
kubectl exec -n default $POD -- df -h | grep cfs

# Test write
kubectl exec -n default $POD -- sh -c "echo 'test' > /cfs/rl-data/test.txt"
kubectl exec -n default $POD -- cat /cfs/rl-data/test.txt
```

## Troubleshooting

### PVC Not Binding

If PVC stays in "Pending" state:

1. Check if StorageClass exists:
```bash
kubectl get storageclass cfs-turbo-sc
```

2. Check CSI driver is installed:
```bash
kubectl get pods -n kube-system | grep csi
```

3. Check PVC events:
```bash
kubectl describe pvc -n default rl-data-storage
```

### Mount Failures

If CFS is not mounted in pods:

1. Check PVC is bound:
```bash
kubectl get pvc -n default rl-data-storage
```

2. Check pod events:
```bash
kubectl describe pod <pod-name>
```

3. Verify CSI driver logs:
```bash
kubectl logs -n kube-system <csi-driver-pod>
```

### Permission Issues

If you get permission denied errors:

1. Check directory permissions:
```bash
kubectl exec -n default $POD -- ls -la /cfs/rl-data
```

2. Create directory if needed:
```bash
kubectl exec -n default $POD -- mkdir -p /cfs/rl-data
```

## Best Practices

1. **Always initialize storage before creating environments**
2. **Use consistent namespace for PVC and environments**
3. **Monitor PVC usage to avoid running out of space**
4. **Implement proper error handling for storage operations**
5. **Use subPaths for environment isolation if needed**

## Future Enhancements

- [ ] Automatic PVC creation when environment is created
- [ ] Storage quota management per experiment
- [ ] Automatic cleanup of old data
- [ ] Storage usage monitoring and alerts
- [ ] Support for multiple storage backends
- [ ] Data versioning and snapshots