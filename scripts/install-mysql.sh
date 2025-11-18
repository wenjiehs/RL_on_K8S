#!/bin/bash

# MySQL自动安装脚本（macOS）

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== RL Training Platform - MySQL Installation ===${NC}"
echo ""

# 检查是否已安装Homebrew
if ! command -v brew &> /dev/null; then
    echo -e "${RED}❌ Homebrew未安装${NC}"
    echo "请先安装Homebrew: https://brew.sh"
    exit 1
fi

echo -e "${GREEN}✅ Homebrew已安装${NC}"

# 检查是否已安装MySQL
if command -v mysql &> /dev/null; then
    echo -e "${YELLOW}⚠️  MySQL已安装${NC}"
    mysql --version
    echo ""
    read -p "是否继续安装/重新安装? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

echo ""
echo -e "${BLUE}步骤1: 安装MySQL 8.0${NC}"
brew install mysql@8.0

echo ""
echo -e "${BLUE}步骤2: 启动MySQL服务${NC}"
brew services start mysql@8.0

echo ""
echo -e "${BLUE}步骤3: 配置PATH环境变量${NC}"

# 检测shell类型
if [ -n "$ZSH_VERSION" ]; then
    SHELL_RC="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_RC="$HOME/.bashrc"
else
    SHELL_RC="$HOME/.profile"
fi

# 添加MySQL到PATH
if ! grep -q "mysql@8.0/bin" "$SHELL_RC"; then
    echo 'export PATH="/opt/homebrew/opt/mysql@8.0/bin:$PATH"' >> "$SHELL_RC"
    echo -e "${GREEN}✅ PATH已添加到 $SHELL_RC${NC}"
else
    echo -e "${YELLOW}⚠️  PATH已存在于 $SHELL_RC${NC}"
fi

# 临时设置PATH
export PATH="/opt/homebrew/opt/mysql@8.0/bin:$PATH"

echo ""
echo -e "${BLUE}步骤4: 等待MySQL启动${NC}"
sleep 5

# 验证MySQL是否运行
if pgrep -x "mysqld" > /dev/null; then
    echo -e "${GREEN}✅ MySQL服务运行中${NC}"
else
    echo -e "${RED}❌ MySQL服务未运行${NC}"
    echo "请手动启动: brew services start mysql@8.0"
    exit 1
fi

echo ""
echo -e "${GREEN}=== MySQL安装完成 ===${NC}"
echo ""
echo "MySQL版本:"
mysql --version

echo ""
echo -e "${YELLOW}下一步操作:${NC}"
echo "1. 重新加载shell配置:"
echo "   source $SHELL_RC"
echo ""
echo "2. 设置MySQL root密码（可选但推荐）:"
echo "   mysql_secure_installation"
echo ""
echo "3. 运行数据库初始化脚本:"
echo "   ./scripts/setup-database.sh"
echo ""
echo "4. 测试数据库连接:"
echo "   ./scripts/test-database.sh"