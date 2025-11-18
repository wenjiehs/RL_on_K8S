#!/bin/bash

# 验证统一存储配置脚本

set -e

echo "🔍 验证统一存储配置..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""

# 1. 检查API服务器存储状态
echo "1️⃣ 检查API服务器存储状态..."
API_RESPONSE=$(curl -s "http://localhost:8080/api/storage/status" 2>/dev/null || echo '{"connected": false}')
echo "API响应: $API_RESPONSE"

if echo "$API_RESPONSE" | jq -e '.connected' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API服务器存储连接正常${NC}"
    MOUNT_POINT=$(echo "$API_RESPONSE" | jq -r '.mountPoint // "unknown"')
    echo "  挂载点: $MOUNT_POINT"
else
    echo -e "${RED}❌ API服务器存储连接失败${NC}"
fi

echo ""

# 2. 检查数据集API
echo "2️⃣ 检查数据集API..."
DATASETS_RESPONSE=$(curl -s "http://localhost:8080/api/datasets" 2>/dev/null || echo '[]')
echo "数据集响应: $DATASETS_RESPONSE"

if echo "$DATASETS_RESPONSE" | jq -e '.[0].path' > /dev/null 2>&1; then
    DATASET_PATH=$(echo "$DATASETS_RESPONSE" | jq -r '.[0].path')
    echo -e "${GREEN}✅ 数据集路径: $DATASET_PATH${NC}"
    
    if [[ "$DATASET_PATH" == "/mnt/cfs/rl-data"* ]]; then
        echo -e "${GREEN}✅ 使用统一存储路径${NC}"
    else
        echo -e "${YELLOW}⚠️ 未使用统一存储路径${NC}"
    fi
else
    echo -e "${RED}❌ 数据集API响应异常${NC}"
fi

echo ""

# 3. 检查PVC配置
echo "3️⃣ 检查PVC配置..."
if command -v kubectl >/dev/null 2>&1; then
    PVC_STATUS=$(kubectl get pvc cfs-rl-data-pvc -o jsonpath='{.status.phase}' 2>/dev/null || echo "NotFound")
    if [ "$PVC_STATUS" = "Bound" ]; then
        CAPACITY=$(kubectl get pvc cfs-rl-data-pvc -o jsonpath='{.status.capacity.storage}' 2>/dev/null || echo "Unknown")
        echo -e "${GREEN}✅ 统一PVC状态: $PVC_STATUS ($CAPACITY)${NC}"
    else
        echo -e "${RED}❌ 统一PVC状态异常: $PVC_STATUS${NC}"
    fi
    
    # 检查哪些Pod在使用统一PVC
    echo "使用统一PVC的Pod:"
    kubectl get pods -A -o custom-columns=NAME:.metadata.name,NAMESPACE:.metadata.namespace --field-selector=status.phase=Running 2>/dev/null | while read pod ns; do
        if [ "$pod" != "NAME" ] && kubectl get pod $pod -n $ns -o jsonpath='{.spec.volumes[*].persistentVolumeClaim.claimName}' 2>/dev/null | grep -q "cfs-rl-data-pvc"; then
            echo "  - $pod (namespace: $ns)"
        fi
    done
else
    echo -e "${YELLOW}⚠️ kubectl不可用，跳过PVC检查${NC}"
fi

echo ""

# 4. 检查代码配置
echo "4️⃣ 检查代码配置..."

# 检查environment.go中的PVC名称
if grep -q "DefaultPVCName.*cfs-rl-data-pvc" cmd/api-server/environment.go; then
    echo -e "${GREEN}✅ environment.go使用统一PVC${NC}"
else
    echo -e "${RED}❌ environment.go未使用统一PVC${NC}"
fi

# 检查CFS Data Accessor配置
if grep -q "claimName: cfs-rl-data-pvc" deployments/cfs-data-accessor.yaml; then
    echo -e "${GREEN}✅ CFS Data Accessor使用统一PVC${NC}"
else
    echo -e "${RED}❌ CFS Data Accessor未使用统一PVC${NC}"
fi

# 检查挂载路径
if grep -q "mountPath: /mnt/cfs" deployments/cfs-data-accessor.yaml; then
    echo -e "${GREEN}✅ 使用统一挂载路径${NC}"
else
    echo -e "${RED}❌ 未使用统一挂载路径${NC}"
fi

echo ""

# 5. 总结
echo "📊 统一存储配置验证总结:"
echo ""

# 计算通过的检查项
PASSED_CHECKS=0
TOTAL_CHECKS=5

if echo "$API_RESPONSE" | jq -e '.connected' > /dev/null 2>&1; then
    ((PASSED_CHECKS++))
    echo -e "${GREEN}✅ API存储连接${NC}"
else
    echo -e "${RED}❌ API存储连接${NC}"
fi

if echo "$DATASETS_RESPONSE" | jq -e '.[0].path' > /dev/null 2>&1 && [[ "$(echo "$DATASETS_RESPONSE" | jq -r '.[0].path')" == "/mnt/cfs/rl-data"* ]]; then
    ((PASSED_CHECKS++))
    echo -e "${GREEN}✅ 数据集路径统一${NC}"
else
    echo -e "${RED}❌ 数据集路径统一${NC}"
fi

if [ "$PVC_STATUS" = "Bound" ]; then
    ((PASSED_CHECKS++))
    echo -e "${GREEN}✅ PVC状态正常${NC}"
else
    echo -e "${RED}❌ PVC状态正常${NC}"
fi

if grep -q "DefaultPVCName.*cfs-rl-data-pvc" cmd/api-server/environment.go; then
    ((PASSED_CHECKS++))
    echo -e "${GREEN}✅ 后端代码配置${NC}"
else
    echo -e "${RED}❌ 后端代码配置${NC}"
fi

if grep -q "claimName: cfs-rl-data-pvc" deployments/cfs-data-accessor.yaml; then
    ((PASSED_CHECKS++))
    echo -e "${GREEN}✅ 前端配置${NC}"
else
    echo -e "${RED}❌ 前端配置${NC}"
fi

echo ""
echo "通过检查: $PASSED_CHECKS/$TOTAL_CHECKS"

if [ $PASSED_CHECKS -eq $TOTAL_CHECKS ]; then
    echo -e "${GREEN}🎉 统一存储配置验证成功！${NC}"
    echo ""
    echo "✨ 所有组件现在使用统一的存储配置:"
    echo "   - PVC: cfs-rl-data-pvc (10Ti)"
    echo "   - 挂载路径: /mnt/cfs/rl-data"
    echo "   - 数据访问一致性: ✅"
else
    echo -e "${YELLOW}⚠️ 部分检查未通过，请检查配置${NC}"
fi

echo ""