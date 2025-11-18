#!/bin/bash

# CFS存储卷挂载测试脚本
# 用于快速验证Ray环境的CFS挂载功能

set -e

echo "🚀 开始CFS存储卷挂载测试..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试配置
NAMESPACE="default"
CLUSTER_NAME="cfs-test-$(date +%s)"
RAY_IMAGE="rayproject/ray:latest"

echo -e "${BLUE}📋 测试配置:${NC}"
echo "  Namespace: $NAMESPACE"
echo "  Cluster Name: $CLUSTER_NAME"
echo "  Ray Image: $RAY_IMAGE"
echo ""

# 检查前置条件
echo -e "${BLUE}🔍 检查前置条件...${NC}"

# 检查kubectl
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl 未安装${NC}"
    exit 1
fi

# 检查集群连接
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}❌ 无法连接到Kubernetes集群${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Kubernetes集群连接正常${NC}"

# 检查API服务器
if ! curl -s "http://localhost:8080/api/storage/status?namespace=default" &> /dev/null; then
    echo -e "${RED}❌ API服务器未运行${NC}"
    exit 1
fi

echo -e "${GREEN}✅ API服务器运行正常${NC}"

# 检查前端服务
if ! lsof -ti:5173,5174,5175 &> /dev/null; then
    echo -e "${RED}❌ 前端服务未运行${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 前端服务运行正常${NC}"
echo ""

# 获取存储状态
echo -e "${BLUE}📊 检查CFS存储状态...${NC}"
STORAGE_STATUS=$(curl -s "http://localhost:8080/api/storage/status?namespace=default" 2>/dev/null || echo "{}")
echo "存储状态: $STORAGE_STATUS"

if echo "$STORAGE_STATUS" | grep -q "connected"; then
    echo -e "${GREEN}✅ CFS存储已连接${NC}"
else
    echo -e "${YELLOW}⚠️ CFS存储状态未知，继续测试...${NC}"
fi
echo ""

# 创建Ray环境
echo -e "${BLUE}🏗️ 创建Ray环境...${NC}"
CREATE_RESPONSE=$(curl -s -X POST http://localhost:8080/api/environments/create \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"$CLUSTER_NAME\",
        \"framework\": \"ray\",
        \"namespace\": \"$NAMESPACE\",
        \"image\": \"$RAY_IMAGE\",
        \"replicas\": 1
    }" 2>/dev/null)

if echo "$CREATE_RESPONSE" | grep -q "success\|created"; then
    echo -e "${GREEN}✅ Ray环境创建请求已提交${NC}"
else
    echo -e "${RED}❌ Ray环境创建失败${NC}"
    echo "响应: $CREATE_RESPONSE"
    exit 1
fi
echo ""

# 等待环境就绪
echo -e "${BLUE}⏳ 等待环境就绪...${NC}"
for i in {1..30}; do
    STATUS=$(kubectl get raycluster "$CLUSTER_NAME" -n "$NAMESPACE" -o jsonpath='{.status.state}' 2>/dev/null || echo "NotFound")
    
    if [ "$STATUS" = "ready" ]; then
        echo -e "${GREEN}✅ 环境已就绪${NC}"
        break
    elif [ "$STATUS" = "NotFound" ]; then
        echo -e "${YELLOW}⏳ 等待RayCluster创建... ($i/30)${NC}"
    else
        echo -e "${YELLOW}⏳ 当前状态: $STATUS ($i/30)${NC}"
    fi
    
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ 环境创建超时${NC}"
        exit 1
    fi
    
    sleep 5
done
echo ""

# 获取Pod名称
HEAD_POD=$(kubectl get pods -n "$NAMESPACE" -l ray.io/cluster="$CLUSTER_NAME",ray.io/node-type=head -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
WORKER_POD=$(kubectl get pods -n "$NAMESPACE" -l ray.io/cluster="$CLUSTER_NAME",ray.io/node-type=worker -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [ -z "$HEAD_POD" ]; then
    echo -e "${RED}❌ 未找到Head Pod${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Head Pod: $HEAD_POD${NC}"
if [ -n "$WORKER_POD" ]; then
    echo -e "${GREEN}✅ Worker Pod: $WORKER_POD${NC}"
fi
echo ""

# 测试CFS挂载
echo -e "${BLUE}🔍 测试CFS挂载...${NC}"

# 测试Head节点
echo -e "${BLUE}📋 Head节点测试:${NC}"
if kubectl exec "$HEAD_POD" -n "$NAMESPACE" -- ls -la /mnt/cfs &> /dev/null; then
    echo -e "${GREEN}✅ /mnt/cfs 目录可访问${NC}"
else
    echo -e "${RED}❌ /mnt/cfs 目录不可访问${NC}"
fi

if kubectl exec "$HEAD_POD" -n "$NAMESPACE" -- ls -la /mnt/cfs/rl-data &> /dev/null; then
    echo -e "${GREEN}✅ /mnt/cfs/rl-data 目录可访问${NC}"
else
    echo -e "${YELLOW}⚠️ /mnt/cfs/rl-data 目录不存在，尝试创建...${NC}"
    kubectl exec "$HEAD_POD" -n "$NAMESPACE" -- mkdir -p /mnt/cfs/rl-data || echo "创建失败"
fi

# 测试写入权限
TEST_FILE="/mnt/cfs/rl-data/cfs-test-$(date +%Y%m%d-%H%M%S).txt"
TEST_CONTENT="CFS mount test from $CLUSTER_NAME at $(date)"

if kubectl exec "$HEAD_POD" -n "$NAMESPACE" -- sh -c "echo '$TEST_CONTENT' > $TEST_FILE" &> /dev/null; then
    echo -e "${GREEN}✅ 文件写入成功${NC}"
    
    # 验证文件内容
    READ_CONTENT=$(kubectl exec "$HEAD_POD" -n "$NAMESPACE" -- cat "$TEST_FILE" 2>/dev/null || echo "")
    if [ "$READ_CONTENT" = "$TEST_CONTENT" ]; then
        echo -e "${GREEN}✅ 文件读取验证成功${NC}"
    else
        echo -e "${RED}❌ 文件读取验证失败${NC}"
    fi
else
    echo -e "${RED}❌ 文件写入失败${NC}"
fi

# 检查磁盘空间
DISK_INFO=$(kubectl exec "$HEAD_POD" -n "$NAMESPACE" -- df -h /mnt/cfs 2>/dev/null || echo "无法获取磁盘信息")
echo -e "${BLUE}💾 磁盘信息:${NC}"
echo "$DISK_INFO"

# 检查挂载信息
MOUNT_INFO=$(kubectl exec "$HEAD_POD" -n "$NAMESPACE" -- mount | grep cfs 2>/dev/null || echo "无挂载信息")
echo -e "${BLUE}🔗 挂载信息:${NC}"
echo "$MOUNT_INFO"
echo ""

# 测试Worker节点（如果存在）
if [ -n "$WORKER_POD" ]; then
    echo -e "${BLUE}📋 Worker节点测试:${NC}"
    
    if kubectl exec "$WORKER_POD" -n "$NAMESPACE" -- ls -la /mnt/cfs/rl-data &> /dev/null; then
        echo -e "${GREEN}✅ Worker节点可访问CFS${NC}"
        
        # 验证共享文件
        if kubectl exec "$WORKER_POD" -n "$NAMESPACE" -- cat "$TEST_FILE" &> /dev/null; then
            echo -e "${GREEN}✅ Worker节点可访问Head节点创建的文件${NC}"
        else
            echo -e "${YELLOW}⚠️ Worker节点无法访问共享文件${NC}"
        fi
    else
        echo -e "${RED}❌ Worker节点无法访问CFS${NC}"
    fi
    echo ""
fi

# 清理测试环境
echo -e "${BLUE}🧹 清理测试环境...${NC}"
if kubectl delete raycluster "$CLUSTER_NAME" -n "$NAMESPACE" &> /dev/null; then
    echo -e "${GREEN}✅ RayCluster已删除${NC}"
else
    echo -e "${YELLOW}⚠️ RayCluster删除失败或不存在${NC}"
fi

# 清理测试文件（可选）
echo -e "${BLUE}🗑️ 清理测试文件...${NC}"
kubectl exec "$HEAD_POD" -n "$NAMESPACE" -- rm -f "$TEST_FILE" 2>/dev/null || echo "测试文件清理失败"
echo ""

# 测试总结
echo -e "${BLUE}📊 测试总结:${NC}"
echo -e "${GREEN}✅ CFS存储卷挂载功能测试完成${NC}"
echo -e "${BLUE}📝 详细日志请查看上方输出${NC}"
echo ""
echo -e "${BLUE}🌐 前端访问地址: http://localhost:5175${NC}"
echo -e "${BLUE}🔧 后端API地址: http://localhost:8080${NC}"
echo ""
echo -e "${GREEN}🎉 测试完成！${NC}"