#!/bin/bash

# 一键启动所有服务

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== RL Training Platform - Starting All Services ===${NC}"
echo ""

# 检查MySQL
echo -e "${BLUE}检查MySQL服务...${NC}"
if ! pgrep -x "mysqld" > /dev/null; then
    echo -e "${YELLOW}MySQL未运行，正在启动...${NC}"
    brew services start mysql@8.0
    sleep 3
fi

if pgrep -x "mysqld" > /dev/null; then
    echo -e "${GREEN}✅ MySQL运行中${NC}"
else
    echo -e "${RED}❌ MySQL启动失败${NC}"
    exit 1
fi

# 检查数据库连接
echo ""
echo -e "${BLUE}检查数据库连接...${NC}"
if ./scripts/test-database.sh > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 数据库连接正常${NC}"
else
    echo -e "${RED}❌ 数据库连接失败${NC}"
    echo "请先运行: ./scripts/setup-database.sh"
    exit 1
fi

# 启动后端
echo ""
echo -e "${BLUE}启动后端服务...${NC}"
cd cmd/api-server

# 检查是否已编译
if [ ! -f "api-server" ]; then
    echo "编译后端..."
    go build -o api-server
fi

# 后台启动
nohup ./api-server > ../../logs/api-server.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../../logs/api-server.pid

sleep 2

# 检查后端是否运行
if ps -p $BACKEND_PID > /dev/null; then
    echo -e "${GREEN}✅ 后端服务已启动 (PID: $BACKEND_PID)${NC}"
    echo "   日志: logs/api-server.log"
else
    echo -e "${RED}❌ 后端服务启动失败${NC}"
    cat ../../logs/api-server.log
    exit 1
fi

cd ../..

# 启动前端
echo ""
echo -e "${BLUE}启动前端服务...${NC}"
cd frontend

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    npm install
fi

# 后台启动
nohup npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../logs/frontend.pid

sleep 3

# 检查前端是否运行
if ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${GREEN}✅ 前端服务已启动 (PID: $FRONTEND_PID)${NC}"
    echo "   日志: logs/frontend.log"
else
    echo -e "${RED}❌ 前端服务启动失败${NC}"
    cat ../logs/frontend.log
    exit 1
fi

cd ..

# 创建日志目录
mkdir -p logs

echo ""
echo -e "${GREEN}=== 所有服务已启动 ===${NC}"
echo ""
echo "服务信息:"
echo "  后端API: http://localhost:8080"
echo "  前端UI:  http://localhost:5173"
echo ""
echo "进程ID:"
echo "  后端: $BACKEND_PID"
echo "  前端: $FRONTEND_PID"
echo ""
echo "日志文件:"
echo "  后端: logs/api-server.log"
echo "  前端: logs/frontend.log"
echo ""
echo "停止服务:"
echo "  ./scripts/stop-all.sh"
echo ""
echo -e "${YELLOW}提示: 使用 tail -f logs/*.log 查看实时日志${NC}"