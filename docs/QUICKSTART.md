# 快速启动指南

## 前置条件

- macOS系统
- Homebrew已安装
- Go 1.21+
- Node.js 18+

## 步骤1: 安装MySQL

### 使用Homebrew安装MySQL

```bash
# 安装MySQL 8.0
brew install mysql@8.0

# 启动MySQL服务
brew services start mysql@8.0

# 将MySQL添加到PATH（添加到 ~/.zshrc）
echo 'export PATH="/opt/homebrew/opt/mysql@8.0/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# 验证安装
mysql --version
```

### 设置MySQL root密码（首次安装）

```bash
# 运行安全配置脚本
mysql_secure_installation
```

按照提示操作：
1. 设置root密码（建议设置一个强密码）
2. 移除匿名用户：Yes
3. 禁止root远程登录：Yes
4. 移除测试数据库：Yes
5. 重新加载权限表：Yes

## 步骤2: 创建数据库

### 方法1: 使用自动化脚本（推荐）

```bash
# 运行数据库初始化脚本
./scripts/setup-database.sh
```

脚本会自动创建：
- 数据库：`rl_training`
- 用户：`rl_user`
- 密码：`rl_password_2025`

### 方法2: 手动创建

```bash
# 登录MySQL
mysql -u root -p

# 在MySQL命令行中执行
CREATE DATABASE rl_training CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'rl_user'@'localhost' IDENTIFIED BY 'rl_password_2025';
GRANT ALL PRIVILEGES ON rl_training.* TO 'rl_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 步骤3: 配置环境变量

### 创建 .env 文件

```bash
# 复制示例配置
cp .env.example .env

# 编辑配置（如果需要修改密码）
nano .env
```

### 设置环境变量

```bash
# 添加到 ~/.zshrc
cat >> ~/.zshrc << 'EOF'

# RL Training Platform Database Config
export DB_HOST=localhost
export DB_PORT=3306
export DB_USER=rl_user
export DB_PASSWORD=rl_password_2025
export DB_NAME=rl_training
EOF

# 重新加载配置
source ~/.zshrc
```

## 步骤4: 测试数据库连接

```bash
# 运行测试脚本
./scripts/test-database.sh
```

如果看到 "✅ 数据库连接成功！"，说明配置正确。

## 步骤5: 启动后端服务

```bash
# 进入API服务器目录
cd cmd/api-server

# 安装Go依赖
go mod download

# 编译
go build -o api-server

# 运行（会自动创建数据库表）
./api-server
```

预期输出：
```
Database initialized successfully
API Server starting on port 8080...
```

## 步骤6: 启动前端服务

打开新终端窗口：

```bash
# 进入前端目录
cd frontend

# 安装依赖（如果还没安装）
npm install

# 启动开发服务器
npm run dev
```

预期输出：
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

## 步骤7: 访问应用

打开浏览器访问：http://localhost:5173

### 首次使用流程

1. **连接Kubernetes集群**
   - 点击右上角 "Configure Cluster"
   - 上传kubeconfig文件
   - 选择context
   - 点击连接

2. **创建训练环境**（如果还没有）
   - 进入 "Environments" 页面
   - 点击 "Create Environment"
   - 选择框架（Ray推荐）
   - 配置资源
   - 创建环境

3. **创建训练任务**
   - 进入 "Training Jobs" 页面
   - 点击 "创建训练任务"
   - 选择创建模式（快速创建/自定义创建）
   - 填写必填字段：
     * 实验名称
     * 算法类型（PPO/DQN/SAC等）
     * 训练环境（选择运行中的环境）
     * 数据路径（如：/cfs/rl-data/exp1/train/latest）
   - 配置超参数
   - 点击创建

4. **启动训练**
   - 在任务列表中找到创建的任务
   - 点击 "启动" 按钮
   - 等待任务状态变为 "running"

## 常见问题

### MySQL服务无法启动

```bash
# 检查服务状态
brew services list

# 重启MySQL
brew services restart mysql@8.0

# 查看日志
tail -f /opt/homebrew/var/mysql/*.err
```

### 数据库连接失败

```bash
# 检查MySQL是否运行
ps aux | grep mysql

# 测试连接
mysql -u rl_user -prl_password_2025 -h localhost rl_training

# 检查环境变量
echo $DB_HOST
echo $DB_USER
```

### 端口冲突

如果8080端口被占用：

```bash
# 查找占用进程
lsof -i :8080

# 修改端口
export PORT=8081
```

### 前端无法连接后端

检查CORS配置：
- 确保后端运行在 http://localhost:8080
- 确保前端运行在 http://localhost:5173
- 检查浏览器控制台是否有CORS错误

## 停止服务

```bash
# 停止后端（Ctrl+C）

# 停止前端（Ctrl+C）

# 停止MySQL（可选）
brew services stop mysql@8.0
```

## 下一步

- 查看完整文档：[docs/training-jobs-setup.md](./training-jobs-setup.md)
- 了解API接口：查看文档中的API部分
- 配置CFS存储：参考存储配置文档
- 集成Ray训练：参考Ray集成文档

## 技术支持

如遇到问题，请检查：
1. MySQL服务是否正常运行
2. 环境变量是否正确设置
3. 端口是否被占用
4. 日志输出中的错误信息