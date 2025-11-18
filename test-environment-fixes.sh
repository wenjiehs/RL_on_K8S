#!/bin/bash

echo "🧪 测试 Environment Management 修复效果"
echo "=========================================="

# 测试后端 API
echo "1. 测试后端 API 响应..."
response=$(curl -s http://localhost:8080/api/environments)
echo "响应: $response"

# 测试前端访问
echo ""
echo "2. 测试前端访问..."
frontend_status=$(curl -s -I http://localhost:5173 | head -1)
echo "前端状态: $frontend_status"

# 检查进程状态
echo ""
echo "3. 检查服务进程..."
echo "前端进程:"
ps aux | grep -E "npm.*dev|vite" | grep -v grep | head -2

echo "后端进程:"
ps aux | grep "api-server" | grep -v grep

echo ""
echo "4. 修复总结:"
echo "✅ 前端 CreateEnvironmentDialog.tsx:"
echo "   - 替换所有 alert() 为 MessagePlugin"
echo "   - 添加表单重置功能"
echo "   - 改进错误处理和用户反馈"
echo ""
echo "✅ 前端 Environments.tsx:"
echo "   - 删除重复的 CreateEnvironmentDialog 组件"
echo ""
echo "✅ 后端 environment.go:"
echo "   - 添加 currentRestConfig nil 检查"
echo "   - 统一 PVC 名称使用 DefaultPVCName 常量"
echo "   - 改进错误日志和返回信息"
echo ""
echo "🎯 修复完成！前后端应该不会再崩溃了。"