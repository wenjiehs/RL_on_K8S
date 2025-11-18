#!/bin/bash

# 停止所有服务

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Stopping All Services ===${NC}"
echo ""

# 停止后端
if [ -f "logs/api-server.pid" ]; then
    BACKEND_PID=$(cat logs/api-server.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo "停止后端服务 (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
        echo -e "${GREEN}✅ 后端服务已停止${NC}"
    else
        echo "后端服务未运行"
    fi
    rm logs/api-server.pid
fi

# 停止前端
if [ -f "logs/frontend.pid" ]; then
    FRONTEND_PID=$(cat logs/frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo "停止前端服务 (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
        echo -e "${GREEN}✅ 前端服务已停止${NC}"
    else
        echo "前端服务未运行"
    fi
    rm logs/frontend.pid
fi

# 清理可能残留的进程
pkill -f "api-server" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

echo ""
echo -e "${GREEN}所有服务已停止${NC}"