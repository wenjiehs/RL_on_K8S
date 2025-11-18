#!/bin/bash

# 启动API服务器脚本
# 确保使用正确的kubeconfig连接到Kubernetes集群

set -e

echo "🚀 启动强化学习云控制台API服务器..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
KUBECONFIG_PATH="/Users/virgilliang/Downloads/cls-jrnaysd3-config"
API_SERVER_BIN="./bin/api-server"
LOG_FILE="api-server.log"
PORT="8080"

echo ""
echo "📋 启动配置:"
echo "  Kubeconfig: $KUBECONFIG_PATH"
echo "  API服务器: $API_SERVER_BIN"
echo "  日志文件: $LOG_FILE"
echo "  端口: $PORT"
echo ""

# 检查kubeconfig文件
echo "1️⃣ 检查kubeconfig文件..."
if [ ! -f "$KUBECONFIG_PATH" ]; then
    echo -e "${RED}❌ Kubeconfig文件不存在: $KUBECONFIG_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Kubeconfig文件存在${NC}"

# 验证kubeconfig连接
echo "2️⃣ 验证kubeconfig连接..."
if kubectl --kubeconfig="$KUBECONFIG_PATH" cluster-info >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Kubeconfig连接正常${NC}"
else
    echo -e "${RED}❌ Kubeconfig连接失败${NC}"
    exit 1
fi

# 检查API服务器二进制文件
echo "3️⃣ 检查API服务器..."
if [ ! -f "$API_SERVER_BIN" ]; then
    echo -e "${YELLOW}⚠️ API服务器不存在，正在构建...${NC}"
    go build -o "$API_SERVER_BIN" cmd/api-server/*.go
    echo -e "${GREEN}✅ API服务器构建完成${NC}"
else
    echo -e "${GREEN}✅ API服务器存在${NC}"
fi

# 停止现有的API服务器
echo "4️⃣ 停止现有的API服务器..."
if pgrep -f "api-server" >/dev/null; then
    echo "停止现有进程..."
    pkill -f "api-server"
    sleep 2
    echo -e "${GREEN}✅ 现有API服务器已停止${NC}"
else
    echo -e "${GREEN}✅ 没有运行中的API服务器${NC}"
fi

# 启动API服务器
echo "5️⃣ 启动API服务器..."
export KUBECONFIG="$KUBECONFIG_PATH"

echo "启动命令: $API_SERVER_BIN"
echo "环境变量: KUBECONFIG=$KUBECONFIG_PATH"
echo "日志输出: $LOG_FILE"

nohup "$API_SERVER_BIN" > "$LOG_FILE" 2>&1 &
API_PID=$!

echo "API服务器PID: $API_PID"

# 等待API服务器启动
echo "等待API服务器启动..."
for i in {1..10}; do
    if curl -s "http://localhost:$PORT/api/cluster/status" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ API服务器启动成功${NC}"
        break
    fi
    sleep 1
    echo "  等待中... ($i/10)"
done

# 验证API服务器状态
echo ""
echo "6️⃣ 验证API服务器状态..."

# 检查集群连接
CLUSTER_STATUS=$(curl -s "http://localhost:$PORT/api/cluster/status" 2>/dev/null || echo '{"connected": false}')
if echo "$CLUSTER_STATUS" | jq -e '.connected' >/dev/null 2>&1; then
    echo -e "${GREEN}✅ 集群连接正常${NC}"
    CONTEXT=$(echo "$CLUSTER_STATUS" | jq -r '.context // "unknown"')
    echo "  当前上下文: $CONTEXT"
else
    echo -e "${RED}❌ 集群连接失败${NC}"
    echo "  响应: $CLUSTER_STATUS"
fi

# 检查环境管理API
if curl -s "http://localhost:$PORT/api/environments" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ 环境管理API正常${NC}"
else
    echo -e "${RED}❌ 环境管理API异常${NC}"
fi

# 检查数据管理API
if curl -s "http://localhost:$PORT/api/datasets" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ 数据管理API正常${NC}"
else
    echo -e "${RED}❌ 数据管理API异常${NC}"
fi

echo ""
echo "🎉 API服务器启动完成！"
echo ""
echo "📊 服务信息:"
echo "  🌐 API地址: http://localhost:$PORT"
echo "  📝 日志文件: $LOG_FILE"
echo "  🔧 进程ID: $API_PID"
echo "  🏷️  集群上下文: $CONTEXT"
echo ""
echo "🔍 常用API端点:"
echo "  集群状态: http://localhost:$PORT/api/cluster/status"
echo "  环境列表: http://localhost:$PORT/api/environments"
echo "  数据集列表: http://localhost:$PORT/api/datasets"
echo "  存储状态: http://localhost:$PORT/api/storage/status"
echo ""
echo "📝 查看日志: tail -f $LOG_FILE"
echo "🛑 停止服务: pkill -f api-server"
echo ""