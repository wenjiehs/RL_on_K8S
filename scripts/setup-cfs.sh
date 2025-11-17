#!/bin/bash

set -e

echo "=== CFS Turbo Setup Script ==="
echo ""
echo "CFS Configuration:"
echo "  File System ID: cfs-483d8ea56"
echo "  Mount Point IP: 10.32.5.135"
echo "  Type: Turbo Performance"
echo ""

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "Error: kubectl not found. Please install kubectl first."
    exit 1
fi

# Check cluster connection
echo "Checking cluster connection..."
if ! kubectl cluster-info &> /dev/null; then
    echo "Error: Not connected to Kubernetes cluster."
    echo "Please run: kubectl ianvs login cls-jrnaysd3 --expired=1h"
    exit 1
fi

echo "✓ Connected to cluster"
echo ""

# Apply PV and PVC
echo "Step 1: Creating PersistentVolume and PersistentVolumeClaim..."
kubectl apply -f scripts/cfs-storage.yaml

echo ""
echo "Step 2: Waiting for PVC to be bound..."
sleep 3

# Check PVC status
PVC_STATUS=$(kubectl get pvc cfs-rl-data-pvc -n default -o jsonpath='{.status.phase}' 2>/dev/null || echo "NotFound")
echo "PVC Status: $PVC_STATUS"

if [ "$PVC_STATUS" != "Bound" ]; then
    echo ""
    echo "⚠️  PVC is not bound yet. This is normal for WaitForFirstConsumer binding mode."
    echo "   The PVC will be bound when a Pod tries to use it."
fi

echo ""
echo "Step 3: Deploying test pod to verify CFS mount..."
kubectl apply -f scripts/test-cfs-mount.yaml

echo ""
echo "Step 4: Waiting for test pod to start..."
kubectl wait --for=condition=Ready pod/cfs-test-pod -n default --timeout=60s || true

echo ""
echo "Step 5: Checking test pod logs..."
sleep 5
kubectl logs cfs-test-pod -n default || echo "Pod not ready yet"

echo ""
echo "=== Setup Summary ==="
echo ""
echo "Resources created:"
kubectl get pv,pvc -n default | grep cfs-rl-data
echo ""
kubectl get pod cfs-test-pod -n default 2>/dev/null || echo "Test pod not found"

echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Verify CFS mount:"
echo "   kubectl exec -it cfs-test-pod -n default -- ls -la /cfs/rl-data/"
echo ""
echo "2. Check test files:"
echo "   kubectl exec -it cfs-test-pod -n default -- cat /cfs/rl-data/test-exp/raw/\$(date +%Y-%m-%d)/test.txt"
echo ""
echo "3. Clean up test pod (after verification):"
echo "   kubectl delete pod cfs-test-pod -n default"
echo ""
echo "4. Update backend API to use CFS path: /cfs/rl-data"
echo ""