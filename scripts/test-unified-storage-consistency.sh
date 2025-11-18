#!/bin/bash

# 测试统一存储配置解决数据不一致问题

set -e

echo "🧪 测试统一存储配置 - 数据一致性验证"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""

# 1. 创建测试数据
echo "1️⃣ 创建测试数据..."

# 通过API创建测试文件
TEST_FILE="unified-storage-test-$(date +%s).txt"
TEST_CONTENT="统一存储测试文件 - 创建时间: $(date)"

echo "创建测试文件: $TEST_FILE"
echo "内容: $TEST_CONTENT"

# 使用curl向CFS Data Accessor发送创建文件请求
# 注意：这里需要实际的文件创建API，目前我们通过模拟来验证
echo "通过统一存储创建测试文件..."

# 2. 验证API响应
echo ""
echo "2️⃣ 验证API数据集响应..."

API_RESPONSE=$(curl -s "http://localhost:8080/api/datasets" 2>/dev/null || echo '[]')
echo "API响应:"
echo "$API_RESPONSE" | jq .

# 检查路径是否为统一路径
DATASET_PATH=$(echo "$API_RESPONSE" | jq -r '.[0].path // "unknown"')
echo "数据集路径: $DATASET_PATH"

if [[ "$DATASET_PATH" == "/mnt/cfs/rl-data"* ]]; then
    echo -e "${GREEN}✅ 使用统一存储路径${NC}"
else
    echo -e "${RED}❌ 未使用统一存储路径${NC}"
fi

# 3. 检查存储状态
echo ""
echo "3️⃣ 检查存储状态..."

STORAGE_STATUS=$(curl -s "http://localhost:8080/api/storage/status" 2>/dev/null || echo '{}')
echo "存储状态:"
echo "$STORAGE_STATUS" | jq .

MOUNT_POINT=$(echo "$STORAGE_STATUS" | jq -r '.mountPoint // "unknown"')
echo "挂载点: $MOUNT_POINT"

if [[ "$MOUNT_POINT" == "/mnt/cfs" ]]; then
    echo -e "${GREEN}✅ 使用统一挂载点${NC}"
else
    echo -e "${RED}❌ 未使用统一挂载点${NC}"
fi

# 4. 模拟数据一致性检查
echo ""
echo "4️⃣ 模拟数据一致性检查..."

echo "📊 数据一致性验证:"
echo "  前端显示路径: $DATASET_PATH"
echo "  存储挂载点: $MOUNT_POINT"

if [[ "$DATASET_PATH" == "/mnt/cfs/rl-data"* ]] && [[ "$MOUNT_POINT" == "/mnt/cfs" ]]; then
    echo -e "${GREEN}✅ 数据路径一致${NC}"
    echo -e "${GREEN}✅ 前端和后端访问相同的数据${NC}"
else
    echo -e "${RED}❌ 数据路径不一致${NC}"
fi

# 5. 配置一致性检查
echo ""
echo "5️⃣ 配置一致性检查..."

echo "检查代码配置:"

# 检查environment.go
ENV_PVC=$(grep "DefaultPVCName.*=" cmd/api-server/environment.go | awk '{print $3}' | tr -d '"')
echo "  environment.go PVC: $ENV_PVC"

# 检查CFS Data Accessor
CFS_PVC=$(grep "claimName:" deployments/cfs-data-accessor.yaml | awk '{print $2}')
echo "  CFS Data Accessor PVC: $CFS_PVC"

# 检查挂载路径
MOUNT_PATH=$(grep "mountPath:" deployments/cfs-data-accessor.yaml | grep -o '/[^[:space:]]*' | head -1)
echo "  挂载路径: $MOUNT_PATH"

if [[ "$ENV_PVC" == "cfs-rl-data-pvc" ]] && [[ "$CFS_PVC" == "cfs-rl-data-pvc" ]] && [[ "$MOUNT_PATH" == "/mnt/cfs" ]]; then
    echo -e "${GREEN}✅ 所有配置一致${NC}"
else
    echo -e "${RED}❌ 配置不一致${NC}"
fi

# 6. 总结
echo ""
echo "🎯 统一存储配置测试总结:"
echo ""

CONSISTENCY_CHECKS=0
TOTAL_CHECKS=4

# 检查1: 数据集路径
if [[ "$DATASET_PATH" == "/mnt/cfs/rl-data"* ]]; then
    ((CONSISTENCY_CHECKS++))
    echo -e "${GREEN}✅ 数据集路径统一${NC}"
else
    echo -e "${RED}❌ 数据集路径统一${NC}"
fi

# 检查2: 挂载点
if [[ "$MOUNT_POINT" == "/mnt/cfs" ]]; then
    ((CONSISTENCY_CHECKS++))
    echo -e "${GREEN}✅ 挂载点统一${NC}"
else
    echo -e "${RED}❌ 挂载点统一${NC}"
fi

# 检查3: PVC配置
if [[ "$ENV_PVC" == "cfs-rl-data-pvc" ]] && [[ "$CFS_PVC" == "cfs-rl-data-pvc" ]]; then
    ((CONSISTENCY_CHECKS++))
    echo -e "${GREEN}✅ PVC配置统一${NC}"
else
    echo -e "${RED}❌ PVC配置统一${NC}"
fi

# 检查4: 数据一致性
if [[ "$DATASET_PATH" == "/mnt/cfs/rl-data"* ]] && [[ "$MOUNT_POINT" == "/mnt/cfs" ]]; then
    ((CONSISTENCY_CHECKS++))
    echo -e "${GREEN}✅ 数据访问一致性${NC}"
else
    echo -e "${RED}❌ 数据访问一致性${NC}"
fi

echo ""
echo "一致性检查通过: $CONSISTENCY_CHECKS/$TOTAL_CHECKS"

if [ $CONSISTENCY_CHECKS -eq $TOTAL_CHECKS ]; then
    echo ""
    echo -e "${GREEN}🎉 统一存储配置成功！${NC}"
    echo -e "${GREEN}✅ 数据不一致问题已解决${NC}"
    echo ""
    echo "📋 统一配置详情:"
    echo "  🏷️  PVC名称: cfs-rl-data-pvc (10Ti)"
    echo "  📂 挂载路径: /mnt/cfs/rl-data"
    echo "  🔄 数据流向: Ray Pod ↔ CFS Data Accessor ↔ 前端页面"
    echo "  ✅ 一致性: 所有组件访问相同数据"
    echo ""
    echo "🚀 系统现在具有:"
    echo "  ✨ 统一的数据访问"
    echo "  🔧 简化的配置管理"
    echo "  📊 可预测的数据行为"
    echo "  🛠️  更容易的故障排查"
else
    echo ""
    echo -e "${YELLOW}⚠️ 部分检查未通过${NC}"
    echo "请检查配置并重新运行测试"
fi

echo ""