#!/bin/bash

# Quick Storage Integration Test Script
# This script performs automated tests of the CFS storage integration

set -e

echo "🧪 CFS Storage Integration Quick Test"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="http://localhost:8080"
NAMESPACE="default"
TEST_ENV_NAME="test-storage-$(date +%s)"

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl not found${NC}"
    exit 1
fi

if ! command -v curl &> /dev/null; then
    echo -e "${RED}❌ curl not found${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ jq not found (optional but recommended)${NC}"
fi

echo -e "${GREEN}✅ Prerequisites OK${NC}"
echo ""

# Test 1: Check API server
echo "🔍 Test 1: API Server Health Check"
if curl -s -f "${API_URL}/api/contexts" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API server is running${NC}"
else
    echo -e "${RED}❌ API server is not responding${NC}"
    echo "   Please start the API server: ./bin/api-server"
    exit 1
fi
echo ""

# Test 2: Storage Status API
echo "🔍 Test 2: Storage Status API"
STORAGE_STATUS=$(curl -s "${API_URL}/api/storage/status?namespace=${NAMESPACE}")
echo "Response: $STORAGE_STATUS"

if echo "$STORAGE_STATUS" | jq -e '.connected' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Storage status API working${NC}"
    
    PVC_STATUS=$(echo "$STORAGE_STATUS" | jq -r '.pvcStatus')
    echo "   PVC Status: $PVC_STATUS"
    
    if [ "$PVC_STATUS" = "Bound" ]; then
        echo -e "${GREEN}✅ Storage is ready${NC}"
    elif [ "$PVC_STATUS" = "NotFound" ]; then
        echo -e "${YELLOW}⚠️  Storage not initialized${NC}"
    else
        echo -e "${YELLOW}⚠️  Storage status: $PVC_STATUS${NC}"
    fi
else
    echo -e "${RED}❌ Storage status API failed${NC}"
fi
echo ""

# Test 3: Storage Config API
echo "🔍 Test 3: Storage Config API"
STORAGE_CONFIG=$(curl -s "${API_URL}/api/storage/config")
echo "Response: $STORAGE_CONFIG"

if echo "$STORAGE_CONFIG" | jq -e '.storageClass' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Storage config API working${NC}"
    
    STORAGE_CLASS=$(echo "$STORAGE_CONFIG" | jq -r '.storageClass')
    MOUNT_PATH=$(echo "$STORAGE_CONFIG" | jq -r '.mountPath')
    DATA_PATH=$(echo "$STORAGE_CONFIG" | jq -r '.dataPath')
    
    echo "   Storage Class: $STORAGE_CLASS"
    echo "   Mount Path: $MOUNT_PATH"
    echo "   Data Path: $DATA_PATH"
else
    echo -e "${RED}❌ Storage config API failed${NC}"
fi
echo ""

# Test 4: Check StorageClass
echo "🔍 Test 4: Kubernetes StorageClass"
if kubectl get storageclass cfs-turbo-sc > /dev/null 2>&1; then
    echo -e "${GREEN}✅ StorageClass 'cfs-turbo-sc' exists${NC}"
else
    echo -e "${RED}❌ StorageClass 'cfs-turbo-sc' not found${NC}"
    echo "   Please create it using: kubectl apply -f scripts/cfs-production.yaml"
fi
echo ""

# Test 5: Check PVC
echo "🔍 Test 5: PersistentVolumeClaim"
if kubectl get pvc rl-data-storage -n ${NAMESPACE} > /dev/null 2>&1; then
    PVC_STATUS=$(kubectl get pvc rl-data-storage -n ${NAMESPACE} -o jsonpath='{.status.phase}')
    echo -e "${GREEN}✅ PVC 'rl-data-storage' exists${NC}"
    echo "   Status: $PVC_STATUS"
    
    if [ "$PVC_STATUS" = "Bound" ]; then
        CAPACITY=$(kubectl get pvc rl-data-storage -n ${NAMESPACE} -o jsonpath='{.status.capacity.storage}')
        echo "   Capacity: $CAPACITY"
    fi
else
    echo -e "${YELLOW}⚠️  PVC 'rl-data-storage' not found${NC}"
    echo "   It will be created automatically when you create an environment"
fi
echo ""

# Test 6: Initialize Storage (if needed)
if [ "$PVC_STATUS" != "Bound" ]; then
    echo "🔍 Test 6: Storage Initialization"
    read -p "Do you want to initialize storage now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        INIT_RESPONSE=$(curl -s -X POST "${API_URL}/api/storage/initialize" \
            -H "Content-Type: application/json" \
            -d "{\"namespace\": \"${NAMESPACE}\"}")
        
        echo "Response: $INIT_RESPONSE"
        
        if echo "$INIT_RESPONSE" | jq -e '.message' > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Storage initialization requested${NC}"
            
            echo "   Waiting for PVC to be bound..."
            for i in {1..30}; do
                sleep 2
                PVC_STATUS=$(kubectl get pvc rl-data-storage -n ${NAMESPACE} -o jsonpath='{.status.phase}' 2>/dev/null || echo "NotFound")
                if [ "$PVC_STATUS" = "Bound" ]; then
                    echo -e "${GREEN}✅ PVC is now bound${NC}"
                    break
                fi
                echo -n "."
            done
            echo ""
        else
            echo -e "${RED}❌ Storage initialization failed${NC}"
        fi
    fi
fi
echo ""

# Test 7: Check existing Ray environments
echo "🔍 Test 7: Existing Ray Environments"
RAY_CLUSTERS=$(kubectl get raycluster -n ${NAMESPACE} -o json 2>/dev/null || echo '{"items":[]}')
RAY_COUNT=$(echo "$RAY_CLUSTERS" | jq '.items | length')

if [ "$RAY_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Found $RAY_COUNT Ray cluster(s)${NC}"
    
    # Check if any has CFS mounted
    for cluster in $(echo "$RAY_CLUSTERS" | jq -r '.items[].metadata.name'); do
        echo "   Checking cluster: $cluster"
        
        # Get head pod
        HEAD_POD=$(kubectl get pods -n ${NAMESPACE} -l "ray.io/cluster=$cluster,ray.io/node-type=head" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
        
        if [ -n "$HEAD_POD" ]; then
            # Check for CFS volume mount
            HAS_CFS=$(kubectl get pod "$HEAD_POD" -n ${NAMESPACE} -o json | jq -r '.spec.volumes[] | select(.name=="cfs-storage") | .name' 2>/dev/null || echo "")
            
            if [ -n "$HAS_CFS" ]; then
                echo -e "   ${GREEN}✅ Has CFS storage mounted${NC}"
            else
                echo -e "   ${YELLOW}⚠️  No CFS storage mounted${NC}"
            fi
        fi
    done
else
    echo -e "${YELLOW}⚠️  No Ray clusters found${NC}"
    echo "   Create one through the UI to test storage mounting"
fi
echo ""

# Summary
echo "======================================"
echo "📊 Test Summary"
echo "======================================"
echo ""
echo "API Server:        $(curl -s -f "${API_URL}/api/contexts" > /dev/null 2>&1 && echo -e "${GREEN}✅ Running${NC}" || echo -e "${RED}❌ Not running${NC}")"
echo "Storage API:       $(echo "$STORAGE_STATUS" | jq -e '.connected' > /dev/null 2>&1 && echo -e "${GREEN}✅ Working${NC}" || echo -e "${RED}❌ Failed${NC}")"
echo "StorageClass:      $(kubectl get storageclass cfs-turbo-sc > /dev/null 2>&1 && echo -e "${GREEN}✅ Exists${NC}" || echo -e "${RED}❌ Missing${NC}")"
echo "PVC Status:        $(kubectl get pvc rl-data-storage -n ${NAMESPACE} -o jsonpath='{.status.phase}' 2>/dev/null || echo -e "${YELLOW}NotFound${NC}")"
echo "Ray Clusters:      $RAY_COUNT"
echo ""

echo "🎯 Next Steps:"
echo "1. Open http://localhost:5173 in your browser"
echo "2. Navigate to Environments page"
echo "3. Click 'Create Environment'"
echo "4. Verify storage status is displayed"
echo "5. Create a Ray environment and verify CFS is mounted"
echo ""
echo "For detailed testing, see: docs/STORAGE_INTEGRATION_TEST.md"