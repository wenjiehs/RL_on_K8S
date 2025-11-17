#!/bin/bash

# CFS Storage Integration Test Script
# This script tests the complete CFS storage integration workflow

set -e

echo "=========================================="
echo "CFS Storage Integration Test"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
API_SERVER="http://localhost:8080"
NAMESPACE="default"

echo "Step 1: Check API Server Status"
echo "-----------------------------------"
CLUSTER_STATUS=$(curl -s ${API_SERVER}/api/cluster/status)
echo "Cluster Status: $CLUSTER_STATUS"
echo ""

if echo "$CLUSTER_STATUS" | grep -q '"connected":true'; then
    echo -e "${GREEN}✓ API Server connected to cluster${NC}"
else
    echo -e "${RED}✗ API Server not connected to cluster${NC}"
    echo "Please connect to cluster first using the frontend UI"
    exit 1
fi

echo ""
echo "Step 2: Check CFS Storage Status"
echo "-----------------------------------"
STORAGE_STATUS=$(curl -s "${API_SERVER}/api/storage/status?namespace=${NAMESPACE}")
echo "Storage Status Response:"
echo "$STORAGE_STATUS" | jq .
echo ""

# Parse storage status
PVC_STATUS=$(echo "$STORAGE_STATUS" | jq -r '.pvcStatus')
CONNECTED=$(echo "$STORAGE_STATUS" | jq -r '.connected')

if [ "$CONNECTED" = "true" ]; then
    echo -e "${GREEN}✓ Storage API connected${NC}"
    
    if [ "$PVC_STATUS" = "Bound" ]; then
        echo -e "${GREEN}✓ CFS PVC is Bound and ready${NC}"
        
        # Show storage configuration
        echo ""
        echo "Storage Configuration:"
        echo "$STORAGE_STATUS" | jq '.config'
        
    elif [ "$PVC_STATUS" = "NotFound" ]; then
        echo -e "${YELLOW}⚠ CFS PVC not found${NC}"
        echo ""
        echo "Step 3: Initialize CFS Storage"
        echo "-----------------------------------"
        
        INIT_RESPONSE=$(curl -s -X POST ${API_SERVER}/api/storage/initialize \
            -H "Content-Type: application/json" \
            -d "{\"namespace\":\"${NAMESPACE}\"}")
        
        echo "Initialization Response:"
        echo "$INIT_RESPONSE" | jq .
        
        if echo "$INIT_RESPONSE" | grep -q "successfully"; then
            echo -e "${GREEN}✓ Storage initialized successfully${NC}"
            
            # Wait for PVC to be bound
            echo ""
            echo "Waiting for PVC to be bound..."
            for i in {1..30}; do
                sleep 2
                NEW_STATUS=$(curl -s "${API_SERVER}/api/storage/status?namespace=${NAMESPACE}")
                NEW_PVC_STATUS=$(echo "$NEW_STATUS" | jq -r '.pvcStatus')
                
                if [ "$NEW_PVC_STATUS" = "Bound" ]; then
                    echo -e "${GREEN}✓ PVC is now Bound${NC}"
                    break
                fi
                
                echo "  PVC Status: $NEW_PVC_STATUS (attempt $i/30)"
            done
        else
            echo -e "${RED}✗ Failed to initialize storage${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠ PVC Status: $PVC_STATUS${NC}"
    fi
else
    echo -e "${RED}✗ Storage API not connected${NC}"
    exit 1
fi

echo ""
echo "Step 4: Verify Kubernetes Resources"
echo "-----------------------------------"

# Check PVC
echo "PVC Status:"
kubectl get pvc -n ${NAMESPACE} | grep -E "NAME|cfs-rl-data-pvc" || echo "No CFS PVC found"

echo ""
echo "StorageClass:"
kubectl get sc | grep -E "NAME|cfs-turbo" || echo "No CFS StorageClass found"

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo ""

# Final verification
FINAL_STATUS=$(curl -s "${API_SERVER}/api/storage/status?namespace=${NAMESPACE}")
FINAL_PVC_STATUS=$(echo "$FINAL_STATUS" | jq -r '.pvcStatus')

if [ "$FINAL_PVC_STATUS" = "Bound" ]; then
    echo -e "${GREEN}✓ CFS Storage Integration: SUCCESS${NC}"
    echo ""
    echo "Storage is ready for use!"
    echo "  - Mount Path: $(echo "$FINAL_STATUS" | jq -r '.config.mountPath')"
    echo "  - Data Path: $(echo "$FINAL_STATUS" | jq -r '.config.dataPath')"
    echo "  - Storage Class: $(echo "$FINAL_STATUS" | jq -r '.config.storageClass')"
    echo ""
    echo "You can now:"
    echo "  1. Open http://localhost:5175 in your browser"
    echo "  2. Go to Environments page"
    echo "  3. Click 'Create Environment'"
    echo "  4. You should see a green success message showing CFS storage is ready"
    exit 0
else
    echo -e "${RED}✗ CFS Storage Integration: FAILED${NC}"
    echo "  PVC Status: $FINAL_PVC_STATUS"
    exit 1
fi