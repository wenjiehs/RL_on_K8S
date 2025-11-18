#!/bin/bash

# MySQL数据库初始化脚本
# 用于创建RL训练平台所需的数据库和用户

set -e

echo "=== RL Training Platform - Database Setup ==="
echo ""

# 配置变量
DB_NAME="rl_training"
DB_USER="rl_user"
DB_PASSWORD="rl_password_2025"
DB_HOST="localhost"
DB_PORT="3306"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}请输入MySQL root密码（如果是首次安装可能为空）:${NC}"
read -s MYSQL_ROOT_PASSWORD

echo ""
echo "正在连接MySQL..."

# 创建SQL脚本
SQL_SCRIPT=$(cat <<EOF
-- 创建数据库
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASSWORD}';

-- 授权
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'%';
FLUSH PRIVILEGES;

-- 显示数据库
SHOW DATABASES;

-- 使用数据库
USE ${DB_NAME};

-- 显示当前用户权限
SHOW GRANTS FOR '${DB_USER}'@'localhost';
EOF
)

# 执行SQL脚本
if [ -z "$MYSQL_ROOT_PASSWORD" ]; then
    echo "$SQL_SCRIPT" | mysql -u root
else
    echo "$SQL_SCRIPT" | mysql -u root -p"$MYSQL_ROOT_PASSWORD"
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 数据库创建成功！${NC}"
    echo ""
    echo "数据库配置信息："
    echo "  数据库名: ${DB_NAME}"
    echo "  用户名: ${DB_USER}"
    echo "  密码: ${DB_PASSWORD}"
    echo "  主机: ${DB_HOST}"
    echo "  端口: ${DB_PORT}"
    echo ""
    echo "环境变量配置："
    echo "  export DB_HOST=${DB_HOST}"
    echo "  export DB_PORT=${DB_PORT}"
    echo "  export DB_USER=${DB_USER}"
    echo "  export DB_PASSWORD=${DB_PASSWORD}"
    echo "  export DB_NAME=${DB_NAME}"
    echo ""
    echo -e "${YELLOW}请将以上环境变量添加到 ~/.zshrc 或 ~/.bashrc${NC}"
else
    echo -e "${RED}❌ 数据库创建失败${NC}"
    exit 1
fi