# CFS Storage Integration Testing Guide

## Overview
This guide provides step-by-step instructions for testing the CFS storage integration in the Ray environment creation workflow.

## Prerequisites
- Kubernetes cluster with KubeRay Operator installed
- Tencent Cloud CFS Turbo configured (fsid: 83d8ea56)
- API server compiled (`go build -o bin/api-server ./cmd/api-server`)
- Frontend built (`cd frontend && npm run build`)

## Test Environment Setup

### 1. Start Backend API Server
```bash
cd /Users/virgilliang/codebuddy/RL_on_K8S
./bin/api-server
```

Expected output:
```
2025/01/17 21:00:00 Server starting on :8080
2025/01/17 21:00:00 Connected to Kubernetes cluster
```

### 2. Start Frontend Development Server
In a new terminal:
```bash
cd /Users/virgilliang/codebuddy/RL_on_K8S/frontend
npm run dev
```

Expected output:
```
VITE v5.4.21  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

## Test Cases

### Test Case 1: Storage Status Check

**Objective**: Verify storage API returns correct status

**Steps**:
1. Open browser to http://localhost:5173
2. Navigate to "Environments" page
3. Click "Create Environment" button
4. Observe the storage status alert at the top of the dialog

**Expected Results**:
- If PVC exists and is Bound:
  - ✅ Green success alert: "CFS Storage Ready - 100Gi available at /cfs"
  - Storage configuration details displayed
  
- If PVC doesn't exist:
  - ⚠️ Yellow warning alert: "CFS Storage Not Initialized"
  - Checkbox: "Automatically initialize storage when creating environment" (checked by default)

**API Verification**:
```bash
curl http://localhost:8080/api/storage/status?namespace=default | jq .
```

Expected response:
```json
{
  "connected": true,
  "config": {
    "storageClass": "cfs-turbo-sc",
    "fsid": "83d8ea56",
    "host": "10.32.5.135",
    "pvcName": "rl-data-storage",
    "pvcSize": "100Gi",
    "mountPath": "/cfs",
    "dataPath": "/cfs/rl-data"
  },
  "pvcStatus": "Bound",
  "mountHealthy": true
}
```

### Test Case 2: Automatic Storage Initialization

**Objective**: Verify storage is automatically initialized when creating environment

**Steps**:
1. Ensure PVC doesn't exist:
   ```bash
   kubectl delete pvc rl-data-storage -n default
   ```

2. Open Create Environment dialog
3. Verify warning alert shows "CFS Storage Not Initialized"
4. Ensure "Automatically initialize storage" checkbox is checked
5. Fill in environment details:
   - Name: `test-ray-storage`
   - Framework: `Ray`
   - Image: (use default)
   - Replicas: `1`
   - Namespace: `default`
6. Click "Create" button

**Expected Results**:
- Message appears: "Initializing storage..."
- PVC is created automatically
- Environment creation proceeds
- Success message: "Environment created successfully"

**Verification**:
```bash
# Check PVC was created
kubectl get pvc rl-data-storage -n default

# Expected output:
# NAME               STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS    AGE
# rl-data-storage    Bound    pvc-xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx     100Gi      RWX            cfs-turbo-sc    1m
```

### Test Case 3: Ray Environment with CFS Mount

**Objective**: Verify Ray environment has CFS storage mounted

**Steps**:
1. Create a Ray environment (following Test Case 2)
2. Wait for RayCluster to be ready:
   ```bash
   kubectl get raycluster -n default
   ```
3. Check Ray head pod:
   ```bash
   kubectl get pods -n default -l ray.io/node-type=head
   ```
4. Verify volume mount in pod spec:
   ```bash
   kubectl get pod <ray-head-pod-name> -n default -o yaml | grep -A 10 volumeMounts
   ```

**Expected Results**:
- RayCluster status: `ready`
- Head pod status: `Running`
- Volume mount present:
  ```yaml
  volumeMounts:
  - mountPath: /cfs
    name: cfs-storage
  ```
- Volume definition present:
  ```yaml
  volumes:
  - name: cfs-storage
    persistentVolumeClaim:
      claimName: rl-data-storage
  ```

### Test Case 4: CFS Access from Ray Pod

**Objective**: Verify Ray pod can read/write to CFS storage

**Steps**:
1. Get Ray head pod name:
   ```bash
   RAY_POD=$(kubectl get pods -n default -l ray.io/node-type=head -o jsonpath='{.items[0].metadata.name}')
   ```

2. Exec into the pod:
   ```bash
   kubectl exec -it $RAY_POD -n default -- /bin/bash
   ```

3. Inside the pod, run:
   ```bash
   # Check mount
   df -h /cfs
   
   # Create test directory
   mkdir -p /cfs/rl-data/test-exp/raw/$(date +%Y-%m-%d)
   
   # Write test file
   echo "Test from Ray pod at $(date)" > /cfs/rl-data/test-exp/raw/$(date +%Y-%m-%d)/test.txt
   
   # Read test file
   cat /cfs/rl-data/test-exp/raw/$(date +%Y-%m-%d)/test.txt
   
   # List directory
   ls -lR /cfs/rl-data/
   ```

**Expected Results**:
- `/cfs` mount shows CFS filesystem with ~35TB total
- Directory creation succeeds
- File write succeeds
- File read returns correct content
- Directory listing shows created structure

### Test Case 5: Storage Configuration Display

**Objective**: Verify storage configuration is correctly displayed in UI

**Steps**:
1. Open Create Environment dialog
2. Select Framework: `Ray`
3. Observe the storage configuration section

**Expected Results**:
Storage configuration box displays:
```
📦 Storage Configuration:
• Mount Path: /cfs
• Data Path: /cfs/rl-data
• Storage Class: cfs-turbo-sc
• Access Mode: ReadWriteMany
```

### Test Case 6: Multi-Namespace Support

**Objective**: Verify storage works across different namespaces

**Steps**:
1. Create environment in `default` namespace
2. Create environment in `rl-system` namespace
3. Verify both can access the same CFS storage

**Expected Results**:
- Both namespaces can create PVC with same StorageClass
- Both can mount and access `/cfs/rl-data`
- Data written in one namespace is visible in the other

## API Endpoint Tests

### GET /api/storage/status
```bash
# Test with default namespace
curl http://localhost:8080/api/storage/status?namespace=default

# Test with rl-system namespace
curl http://localhost:8080/api/storage/status?namespace=rl-system
```

### GET /api/storage/config
```bash
curl http://localhost:8080/api/storage/config
```

Expected response:
```json
{
  "storageClass": "cfs-turbo-sc",
  "fsid": "83d8ea56",
  "host": "10.32.5.135",
  "pvcName": "rl-data-storage",
  "pvcSize": "100Gi",
  "mountPath": "/cfs",
  "dataPath": "/cfs/rl-data"
}
```

### POST /api/storage/initialize
```bash
curl -X POST http://localhost:8080/api/storage/initialize \
  -H "Content-Type: application/json" \
  -d '{"namespace": "default"}'
```

Expected response:
```json
{
  "message": "Storage initialized successfully",
  "pvcName": "rl-data-storage",
  "namespace": "default"
}
```

## Troubleshooting

### Issue: Storage status shows "NotFound"
**Solution**: 
1. Check if StorageClass exists:
   ```bash
   kubectl get storageclass cfs-turbo-sc
   ```
2. If not, create it using `scripts/cfs-production.yaml`

### Issue: PVC stuck in "Pending"
**Solution**:
1. Check PVC events:
   ```bash
   kubectl describe pvc rl-data-storage -n default
   ```
2. Verify CSI driver is running:
   ```bash
   kubectl get pods -n kube-system | grep csi
   ```

### Issue: Ray pod can't access /cfs
**Solution**:
1. Check if volume is mounted:
   ```bash
   kubectl describe pod <ray-pod> -n default | grep -A 5 Mounts
   ```
2. Check PVC is bound:
   ```bash
   kubectl get pvc rl-data-storage -n default
   ```

### Issue: Frontend shows "Failed to fetch storage status"
**Solution**:
1. Check API server is running on port 8080
2. Check CORS configuration in main.go
3. Verify network connectivity

## Success Criteria

All tests pass when:
- ✅ Storage status API returns correct information
- ✅ PVC is automatically created when needed
- ✅ Ray environments have CFS mounted at /cfs
- ✅ Ray pods can read/write to /cfs/rl-data
- ✅ Storage configuration is displayed correctly in UI
- ✅ Multi-namespace support works
- ✅ No errors in API server logs
- ✅ No errors in browser console

## Cleanup

After testing:
```bash
# Delete test environment
kubectl delete raycluster test-ray-storage -n default

# Optionally delete PVC (will lose data)
kubectl delete pvc rl-data-storage -n default

# Stop servers
# Press Ctrl+C in API server terminal
# Press Ctrl+C in frontend terminal
```

## Next Steps

After successful testing:
1. Update plan status to "done"
2. Document any issues found
3. Proceed with training management features
4. Consider adding storage metrics monitoring