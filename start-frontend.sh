#!/bin/bash

echo "=== 启动前端服务 ==="

# 清理旧进程
pkill -9 -f "vite" 2>/dev/null || true
sleep 2

# 进入前端目录
cd frontend

# 启动Vite (使用nohup避免被挂起)
nohup npm run dev > /tmp/vite-server.log 2>&1 </dev/null &

# 等待启动
sleep 5

# 检查状态
if lsof -ti:5173 > /dev/null 2>&1; then
    echo "✅ 前端服务已启动"
    echo "📍 访问地址: http://localhost:5173"
    echo "📋 日志文件: /tmp/vite-server.log"
    tail -10 /tmp/vite-server.log
else
    echo "❌ 前端服务启动失败"
    tail -20 /tmp/vite-server.log
    exit 1
fi