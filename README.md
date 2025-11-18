# RL Training Platform on Kubernetes

基于Kubernetes的强化学习训练云控制台系统，提供完整的训练任务生命周期管理能力。

## 功能特性

### 🎯 核心功能
- **多集群管理**：支持多Kubernetes集群连接和Context切换
- **环境管理**：Ray/Horovod/DeepSpeed等框架的环境创建和管理
- **训练任务管理**：完整的任务生命周期控制（创建/启动/暂停/恢复/终止/删除）
- **数据管理**：基于CFS Turbo的分布式存储，支持数据集管理和文件浏览
- **Web终端**：浏览器内直接连接Ray Head节点进行调试

### 🚀 训练任务功能
- **双模式创建**：快速创建（预置算法）和自定义创建（上传代码）
- **预置算法**：PPO、DQN、SAC、A3C、TD3等主流强化学习算法
- **实时监控**：任务状态实时更新，支持启动/暂停/恢复/终止操作
- **Checkpoint管理**：支持训练中断恢复，删除时可选保留Checkpoint
- **分布式训练**：自动部署Ray集群，支持多节点并行训练

### 📊 数据管理
- **三级分层存储**：`/cfs/rl-data/{experiment_id}/{data_type}/{date}/`
- **四种数据类型**：raw（原始数据）、train（训练数据）、eval（评估数据）、model（模型文件）
- **文件浏览器**：支持目录导航、文件预览（文本/图片/Parquet）
- **存储统计**：可视化展示存储占用和数据分布

## 技术栈

### 后端
- **语言**：Go 1.21+
- **框架**：标准库 + Gorilla WebSocket
- **数据库**：MySQL 8.0+ with GORM ORM
- **Kubernetes**：client-go v0.28+
- **存储**：腾讯云CFS Turbo (CSI驱动)

### 前端
- **框架**：React 18 + TypeScript
- **构建工具**：Vite 5
- **UI组件**：TDesign React
- **路由**：React Router v6
- **终端**：xterm.js

### 基础设施
- **容器编排**：Kubernetes 1.28+
- **分布式训练**：KubeRay Operator v1.5.0
- **存储**：CFS Turbo 35TB (fsid: 83d8ea56)

## 快速开始

### 前置条件
- macOS系统（或Linux）
- Homebrew（macOS）
- Go 1.21+
- Node.js 18+
- Kubernetes集群访问权限

### 一键安装和启动

```bash
# 1. 克隆仓库
git clone <repository-url>
cd RL_on_K8S

# 2. 安装MySQL
./scripts/install-mysql.sh

# 3. 初始化数据库
./scripts/setup-database.sh

# 4. 启动所有服务
./scripts/start-all.sh
```

访问 http://localhost:5173 开始使用！

### 手动启动

详细步骤请参考 [快速启动指南](docs/QUICKSTART.md)

## 项目结构

```
RL_on_K8S/
├── cmd/
│   └── api-server/          # 后端API服务器
│       ├── main.go          # 主入口
│       ├── models.go        # 数据模型
│       ├── database.go      # 数据库连接
│       ├── training_job.go  # 训练任务API
│       ├── environment.go   # 环境管理API
│       ├── cfs.go          # CFS存储API
│       └── terminal.go      # WebSocket终端
├── frontend/
│   ├── src/
│   │   ├── components/      # React组件
│   │   ├── pages/          # 页面组件
│   │   └── App.tsx         # 主应用
│   └── package.json
├── scripts/
│   ├── install-mysql.sh    # MySQL安装脚本
│   ├── setup-database.sh   # 数据库初始化
│   ├── test-database.sh    # 数据库测试
│   ├── start-all.sh        # 启动所有服务
│   └── stop-all.sh         # 停止所有服务
├── docs/
│   ├── QUICKSTART.md       # 快速启动指南
│   └── training-jobs-setup.md  # 训练任务配置文档
└── README.md
```

## 使用指南

### 1. 连接Kubernetes集群

1. 点击右上角 "Configure Cluster"
2. 上传kubeconfig文件
3. 选择要使用的Context
4. 点击连接

### 2. 创建训练环境

1. 进入 "Environments" 页面
2. 点击 "Create Environment"
3. 选择框架（推荐Ray）
4. 配置资源（CPU/内存/GPU）
5. 创建环境并等待就绪

### 3. 创建训练任务

1. 进入 "Training Jobs" 页面
2. 点击 "创建训练任务"
3. 选择创建模式：
   - **快速创建**：选择预置算法（PPO/DQN/SAC等）
   - **自定义创建**：上传自定义代码
4. 填写必填字段：
   - 实验名称
   - 算法类型
   - 训练环境（选择运行中的环境）
   - 数据路径（如：`/cfs/rl-data/exp1/train/latest`）
5. 配置超参数（JSON格式）
6. 点击创建

### 4. 启动和管理训练

- **启动**：点击 "启动" 按钮开始训练
- **暂停**：点击 "暂停" 保存状态并暂停
- **恢复**：从暂停状态继续训练
- **终止**：停止训练任务
- **删除**：删除任务（可选保留Checkpoint）

### 5. 数据管理

1. 进入 "Data Management" 页面
2. 查看数据集列表和存储统计
3. 浏览文件目录
4. 预览文件内容（支持文本/图片/Parquet）
5. 下载或删除文件

## API文档

### 训练任务API

```http
# 创建任务
POST /api/training-jobs/create

# 查询任务列表
GET /api/training-jobs?status=running&limit=20

# 获取任务详情
GET /api/training-jobs/detail?experiment_id=exp_abc123

# 更新任务状态
POST /api/training-jobs/status
{
  "experiment_id": "exp_abc123",
  "action": "start"  // start, pause, terminate
}

# 删除任务
DELETE /api/training-jobs/delete?experiment_id=exp_abc123&keep_checkpoint=true
```

完整API文档请参考 [训练任务配置文档](docs/training-jobs-setup.md)

## 配置说明

### 环境变量

```bash
# 数据库配置
export DB_HOST=localhost
export DB_PORT=3306
export DB_USER=rl_user
export DB_PASSWORD=rl_password_2025
export DB_NAME=rl_training

# API服务器端口
export PORT=8080
```

### 数据库表结构

系统使用两个主要表：

- `training_jobs`：存储训练任务元数据
- `training_metrics`：存储训练指标数据

详细表结构请参考 [配置文档](docs/training-jobs-setup.md#数据库表结构)

## 故障排查

### MySQL连接失败

```bash
# 检查MySQL服务
brew services list | grep mysql

# 重启MySQL
brew services restart mysql@8.0

# 测试连接
./scripts/test-database.sh
```

### 后端启动失败

```bash
# 查看日志
tail -f logs/api-server.log

# 检查端口占用
lsof -i :8080
```

### 前端无法连接后端

- 检查后端是否运行在 http://localhost:8080
- 检查浏览器控制台CORS错误
- 验证环境变量配置

更多问题请参考 [快速启动指南](docs/QUICKSTART.md#常见问题)

## 开发计划

- [x] 多集群管理和连接
- [x] 环境管理（Ray/Horovod/DeepSpeed）
- [x] 训练任务生命周期管理
- [x] 数据管理和文件浏览
- [x] Web终端集成
- [x] CFS Turbo存储集成
- [ ] 任务详情页和实时监控
- [ ] 训练指标可视化
- [ ] Ray Job Submission集成
- [ ] Checkpoint版本管理UI
- [ ] 分布式训练自动部署

## 贡献指南

欢迎提交Issue和Pull Request！

## 许可证

MIT License

## 联系方式

- 项目主页：<repository-url>
- 问题反馈：<issues-url>

---

**RL Training Platform** - 让强化学习训练更简单 🚀