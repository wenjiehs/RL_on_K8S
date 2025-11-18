#!/bin/bash

# 测试数据库连接脚本

set -e

echo "=== Testing Database Connection ==="
echo ""

# 从环境变量读取配置
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-3306}
DB_USER=${DB_USER:-rl_user}
DB_PASSWORD=${DB_PASSWORD:-rl_password_2025}
DB_NAME=${DB_NAME:-rl_training}

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "连接配置："
echo "  Host: ${DB_HOST}"
echo "  Port: ${DB_PORT}"
echo "  User: ${DB_USER}"
echo "  Database: ${DB_NAME}"
echo ""

# 测试连接
echo "正在测试连接..."
mysql -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p${DB_PASSWORD} -e "SELECT 1;" ${DB_NAME} > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 数据库连接成功！${NC}"
    echo ""
    
    # 显示表信息
    echo "数据库表列表："
    mysql -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p${DB_PASSWORD} -e "SHOW TABLES;" ${DB_NAME}
    
    echo ""
    echo -e "${GREEN}数据库配置正确，可以启动API服务器${NC}"
else
    echo -e "${RED}❌ 数据库连接失败${NC}"
    echo ""
    echo "请检查："
    echo "1. MySQL服务是否运行: brew services list | grep mysql"
    echo "2. 环境变量是否正确设置"
    echo "3. 数据库和用户是否已创建"
    exit 1
fi