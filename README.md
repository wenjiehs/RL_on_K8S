# 🤖 RL Training Platform on Kubernetes

<div align="center">

[![Go Version](https://img.shields.io/badge/Go-1.21+-blue.svg)](https://golang.org)
[![React Version](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://reactjs.org)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-1.28+-326CE5.svg)](https://kubernetes.io)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**基于Kubernetes的企业级强化学习训练云控制台系统**

提供从环境管理到训练部署、数据存储到实时监控的完整解决方案

[快速开始](#快速开始) • [功能特性](#功能特性) • [技术架构](#技术架构) • [使用指南](#使用指南)

</div>

---

## 📖 项目概述

RL Training Platform 是一个专为强化学习训练设计的云原生平台，基于Kubernetes构建，提供了完整的训练任务生命周期管理能力。平台集成了现代化的前后端技术栈，支持多种强化学习算法，提供企业级的存储和监控能力。

### 🎯 核心价值

- **🚀 一站式训练管理**：从环境创建到训练部署的全流程支持
- **🔧 企业级架构**：微服务设计，支持高并发和水平扩展
- **💾 智能存储管理**：35TB CFS Turbo分布式存储，支持海量数据
- **📊 实时监控能力**：任务状态、训练指标、资源使用全方位监控
- **🎨 现代化体验**：Material Design UI，流畅的用户交互

---

## ✨ 功能特性

### 🌐 多集群管理
- **集群连接**：支持多Kubernetes集群配置和切换
- **Context管理**：智能识别和管理集群上下文
- **连接状态监控**：实时显示集群连接状态
- **权限验证**：支持RBAC权限控制

### 🏗️ 环境管理
- **多框架支持**：Ray、Horovod、DeepSpeed、PyTorch DDP
- **资源配置**：CPU、内存、GPU灵活配置
- **环境监控**：实时显示环境状态和资源使用
- **扩缩容能力**：支持动态调整节点数量

### 🎯 训练任务管理
- **双模式创建**：
  - **快速创建**：预置算法配置，开箱即用
  - **自定义创建**：上传自定义代码，灵活配置
- **算法支持**：PPO、DQN、SAC、A3C、TD3等主流强化学习算法
- **生命周期控制**：创建、启动、暂停、恢复、终止、删除
- **Checkpoint管理**：训练进度保存和恢复，支持版本管理
- **分布式训练**：自动部署多节点训练集群

### 💾 数据管理系统
- **分层存储架构**：`/cfs/rl-data/{experiment_id}/{data_type}/{date}/`
- **数据类型分类**：
  - `raw`：原始训练数据
  - `train`：训练过程数据
  - `eval`：评估结果数据
  - `model`：模型文件
- **文件浏览器**：支持目录导航、文件预览（文本/图片/Parquet）
- **存储统计**：可视化展示存储占用和数据分布
- **数据上传**：支持分片上传大文件

### 🖥️ Web终端
- **浏览器内终端**：基于xterm.js的全功能终端
- **实时连接**：通过WebSocket连接Ray Head节点
- **自适应尺寸**：终端窗口自动适配浏览器大小
- **多会话支持**：同时连接多个Pod
- **完整Shell体验**：支持ANSI转义序列、光标控制、彩色输出
- **智能重连机制**：网络断开时自动重新连接
- **线程安全通信**：稳定的WebSocket双向通信

### 📈 监控与诊断
- **任务状态监控**：实时显示训练任务状态
- **资源监控**：CPU、内存、GPU使用率监控
- **日志查看**：实时查看训练日志和错误信息
- **指标收集**：训练指标自动收集和可视化

---

## 🏛️ 技术架构

### 🎨 前端技术栈
| 技术 | 版本 | 说明 |
|------|------|------|
| **React** | 18+ | 现代化UI框架，支持Hooks和并发特性 |
| **TypeScript** | 5+ | 类型安全，提升开发效率 |
| **TDesign** | 1.12.0 | 企业级UI组件库 |
| **Vite** | 5+ | 快速构建工具，支持HMR |
| **xterm.js** | 5+ | 浏览器终端组件 |

### ⚙️ 后端技术栈
| 技术 | 版本 | 说明 |
|------|------|------|
| **Go** | 1.21+ | 高性能后端语言，支持并发 |
| **GORM** | 1.25+ | ORM框架，支持数据库操作 |
| **MySQL** | 8.0+ | 关系型数据库，数据持久化 |
| **Gin** | 1.9+ | Web框架，高性能路由 |
| **Gorilla WebSocket** | 1.5+ | WebSocket支持，实时通信 |

### ☁️ 基础设施
| 组件 | 技术选型 | 说明 |
|------|----------|------|
| **容器编排** | Kubernetes 1.28+ | 云原生部署，自动扩缩容 |
| **分布式训练** | KubeRay Operator v1.5.0 | Ray集群管理 |
| **存储系统** | 腾讯云CFS Turbo | 35TB共享文件存储 |
| **CSI驱动** | com.tencent.cloud.csi.cfsturbo | 存储接口标准化 |
| **网络** | Calico/CNI | 容器网络解决方案 |

### 🤖 AI/ML框架
| 框架 | 用途 | 说明 |
|------|------|------|
| **Ray RLlib** | 分布式训练 | 支持多种RL算法 |
| **PyTorch** | 深度学习 | 模型训练核心框架 |
| **Stable-Baselines3** | 强化学习 | 预置算法实现 |
| **Horovod** | 分布式训练 | 多机并行训练 |
| **DeepSpeed** | 大模型训练 | 内存优化和并行 |

---

## 🚀 快速开始

### 📋 前置条件

#### 系统要求
- **操作系统**：macOS 13+ 或 Ubuntu 20.04+
- **内存**：8GB+ (推荐16GB+)
- **存储**：50GB+ 可用空间

#### 必需软件
```bash
# macOS
brew install go node mysql git

# Ubuntu
sudo apt update
sudo apt install golang nodejs mysql-server git
```

#### 集群要求
- **Kubernetes**：1.28+ 集群访问权限
- **权限**：Pod创建、PVC管理、RBAC配置
- **存储**：支持ReadWriteMany的StorageClass

### ⚡ 一键部署

```bash
# 1. 克隆项目
git clone https://github.com/wenjiehs/RL_on_K8S.git
cd RL_on_K8S

# 2. 安装依赖（自动检测系统）
chmod +x scripts/install-deps.sh
./scripts/install-deps.sh

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库信息

# 4. 初始化数据库
./scripts/setup-database.sh

# 5. 启动所有服务
./scripts/start-all.sh

# 6. 访问平台
echo "🚀 访问: http://localhost:5173"
```

### 🔧 手动部署

#### 1. 数据库设置
```bash
# 启动MySQL
brew services start mysql@8.0  # macOS
sudo systemctl start mysql      # Ubuntu

# 创建数据库
mysql -u root -p -e "CREATE DATABASE rl_training CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 创建用户
mysql -u root -p -e "CREATE USER 'rl_user'@'localhost' IDENTIFIED BY 'your_password';"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON rl_training.* TO 'rl_user'@'localhost';"
```

#### 2. 后端服务
```bash
cd cmd/api-server
go mod tidy
go build -o api-server
./api-server
```

#### 3. 前端服务
```bash
cd frontend
npm install
npm run dev
```

### 🌐 访问验证

访问 http://localhost:5173 并验证：

1. ✅ 页面正常加载
2. ✅ 可以连接Kubernetes集群
3. ✅ 环境列表正常显示
4. ✅ 创建测试环境成功

---

## 📚 使用指南

### 🔗 集群连接配置

1. **获取kubeconfig**：
```bash
# 从集群管理员获取kubeconfig文件
cp ~/.kube/config ./kubeconfig
```

2. **配置平台**：
   - 点击右上角 "Configure Cluster"
   - 上传kubeconfig文件或填写连接信息
   - 选择目标Context
   - 测试连接

### 🏗️ 创建训练环境

1. **进入环境管理页面**：
   - 导航到 "Environments" 
   - 点击 "Create Environment"

2. **配置环境参数**：
   ```yaml
   name: "rl-env-ppo"
   framework: "Ray"
   resources:
     cpu: "4"
     memory: "8Gi"
     gpu: "1"
   image: "rayproject/ray:2.8.0-py311"
   ```

3. **高级配置**：
   - 选择Ray版本
   - 配置自动扩缩容
   - 设置环境变量
   - 挂载CFS存储

### 🎯 创建训练任务

#### 快速创建模式
1. **选择预置算法**：
   - PPO：策略梯度算法，适合连续动作空间
   - DQN：深度Q网络，适合离散动作空间
   - SAC：软演员评论家，样本效率高
   - A3C：异步优势演员评论家，收敛快

2. **配置训练参数**：
   ```json
   {
     "learning_rate": 0.0003,
     "gamma": 0.99,
     "batch_size": 64,
     "n_steps": 2048,
     "clip_range": 0.2
   }
   ```

#### 自定义创建模式
1. **上传代码**：
   ```bash
   # 支持的算法模板
   ├── ppo_cartpole.py
   ├── dqn_lunarlander.py
   ├── sac_mujoco.py
   └── a3c_atari.py
   ```

2. **配置数据路径**：
   ```
   /cfs/rl-data/experiment_001/raw/latest/
   /cfs/rl-data/experiment_001/train/latest/
   ```

### 📊 数据管理操作

1. **浏览数据结构**：
   ```
   /cfs/rl-data/
   ├── experiment_001/
   │   ├── raw/
   │   │   └── 2025-11-18/
   │   ├── train/
   │   │   └── 2025-11-18/
   │   ├── eval/
   │   │   └── 2025-11-18/
   │   └── model/
   │       └── 2025-11-18/
   ```

2. **文件预览支持**：
   - **文本文件**：.txt, .log, .json, .yaml, .md, .py, .sh
   - **图片文件**：.png, .jpg, .jpeg, .gif, .svg
   - **数据文件**：.parquet（Schema展示+数据表格）

### 🖥️ Web终端使用

#### 🚀 快速连接
1. **启动终端**：
   - 在环境列表中找到运行中的Ray环境
   - 点击 "Terminal" 按钮
   - 等待WebSocket连接建立（状态显示为绿色 "Connected"）

2. **连接状态**：
   - 🟢 **Connected**：终端已连接，可以正常使用
   - 🟡 **Connecting**：正在建立连接，请稍候
   - 🔴 **Disconnected**：连接断开，请刷新页面重试

#### 💻 终端功能
1. **完整Shell体验**：
   ```bash
   # 查看Ray集群状态
   ray status
   
   # 查看训练任务列表
   ray list jobs
   
   # 查看节点资源
   ray memory
   
   # 查看正在运行的进程
   ps aux
   
   # 文件操作
   ls -la /cfs/rl-data/
   cat training.log
   
   # 系统监控
   top
   htop
   df -h
   ```

2. **高级操作**：
   ```bash
   # 进入Python环境
   python3
   
   # 查看GPU状态
   nvidia-smi
   
   # 查看网络连接
   netstat -tulpn
   
   # 查看容器日志
   kubectl logs -f deployment/ray-cluster-head
   
   # 端口转发
   kubectl port-forward service/ray-cluster-head-head-svc 8265:8265
   ```

#### 🎨 终端特性
- **🖱️ 鼠标支持**：支持鼠标选择、复制、粘贴
- **🎨 彩色输出**：支持ANSI颜色代码和样式
- **📏 自适应尺寸**：窗口大小自动调整
- **🔄 智能重连**：网络断开时自动重新连接
- **📱 响应式设计**：支持移动设备访问

#### ⌨️ 快捷键
| 快捷键 | 功能 |
|--------|------|
| `Ctrl+C` | 中断当前命令 |
| `Ctrl+L` | 清屏 |
| `Ctrl+A` | 光标移到行首 |
| `Ctrl+E` | 光标移到行尾 |
| `Ctrl+U` | 删除整行 |
| `Ctrl+W` | 删除前一个单词 |
| `Ctrl+R` | 搜索历史命令 |
| `↑/↓` | 浏览历史命令 |

#### 🐛 故障排除
1. **连接失败**：
   - 检查环境是否正在运行
   - 确认集群连接状态
   - 刷新页面重新连接

2. **输入无响应**：
   - 检查终端连接状态
   - 尝试重新打开终端窗口
   - 查看浏览器控制台错误信息

3. **显示异常**：
   - 清除浏览器缓存
   - 检查网络连接稳定性
   - 确认后端服务正常运行

---

## 🔧 配置说明

### 📝 环境变量配置

创建 `.env` 文件：
```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=rl_user
DB_PASSWORD=your_secure_password
DB_NAME=rl_training

# API服务配置
PORT=8080
GIN_MODE=release

# 存储配置
CFS_HOST=10.32.5.135
CFS_PATH=/cfs/rl-data
CFS_FSID=83d8ea56

# 集群配置
KUBECONFIG_PATH=/Users/username/.kube/config
DEFAULT_NAMESPACE=default
```

### 🗄️ 数据库表结构

#### training_jobs 表
```sql
CREATE TABLE training_jobs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    experiment_id VARCHAR(64) UNIQUE NOT NULL,
    experiment_name VARCHAR(255) NOT NULL,
    algorithm_type VARCHAR(50) NOT NULL,
    environment_id VARCHAR(64) NOT NULL,
    data_path VARCHAR(512) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    hyperparams TEXT,
    code_path VARCHAR(512),
    checkpoint_path VARCHAR(512),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    INDEX idx_experiment_id (experiment_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);
```

#### training_metrics 表
```sql
CREATE TABLE training_metrics (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    experiment_id VARCHAR(64) NOT NULL,
    episode INT NOT NULL,
    step BIGINT NOT NULL,
    reward DOUBLE,
    loss DOUBLE,
    metrics JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_experiment_id (experiment_id),
    INDEX idx_episode (episode),
    FOREIGN KEY (experiment_id) REFERENCES training_jobs(experiment_id) ON DELETE CASCADE
);
```

---

## 🐛 故障排查

### 🔧 常见问题解决

#### 1. MySQL连接失败
```bash
# 检查MySQL状态
brew services list | grep mysql

# 重启MySQL服务
brew services restart mysql@8.0

# 测试数据库连接
./scripts/test-database.sh
```

#### 2. Kubernetes连接问题
```bash
# 验证kubeconfig
kubectl cluster-info

# 测试权限
kubectl get pods

# 查看context
kubectl config current-context
```

#### 3. 前端无法访问后端
```bash
# 检查后端服务
curl http://localhost:8080/health

# 检查端口占用
lsof -i :8080

# 查看CORS配置
grep -r "cors" cmd/api-server/
```

#### 4. CFS存储挂载失败
```bash
# 检查PVC状态
kubectl get pvc

# 查看StorageClass
kubectl get storageclass

# 检查CSI驱动
kubectl get csidrivers
```

### 📋 日志查看

```bash
# 后端日志
tail -f logs/api-server.log

# 前端构建日志
cd frontend && npm run build

# Kubernetes Pod日志
kubectl logs -f deployment/ray-cluster-head
```

---

## 🚀 开发指南

### 🔨 开发环境设置

```bash
# 1. 克隆项目
git clone https://github.com/wenjiehs/RL_on_K8S.git
cd RL_on_K8S

# 2. 安装开发依赖
npm run setup:dev

# 3. 启动开发服务器
npm run dev:all

# 4. 运行测试
npm run test
```

### 📊 性能优化

#### 前端优化
- **代码分割**：使用React.lazy()进行路由级别分割
- **组件缓存**：React.memo优化重渲染
- **Bundle分析**：webpack-bundle-analyzer分析包大小

#### 后端优化
- **数据库索引**：关键字段建立索引
- **连接池**：配置数据库连接池
- **缓存策略**：Redis缓存热点数据

### 🧪 测试

```bash
# 单元测试
npm run test:unit

# 集成测试
npm run test:integration

# E2E测试
npm run test:e2e

# 性能测试
npm run test:performance
```

---

## 📈 项目规划

### ✅ 已完成功能
- [x] 多集群管理和连接
- [x] 环境管理（Ray/Horovod/DeepSpeed）
- [x] 训练任务生命周期管理
- [x] 双模式任务创建（快速/自定义）
- [x] 数据管理和文件浏览
- [x] CFS Turbo存储集成
- [x] Web终端功能（完整的Shell体验，支持ANSI转义序列和实时交互）
- [x] 实时状态监控
- [x] 终端输入输出问题修复（JSON消息解析、线程安全通信）
- [x] Namespace切换支持
- [x] KubeRay Operator集成
- [x] 资源优化配置

### 🚧 开发中功能
- [ ] 训练指标可视化图表
- [ ] 任务详情页和实时监控
- [ ] Ray Job Submission深度集成
- [ ] Checkpoint版本管理UI
- [ ] 告警和通知系统

### 📋 计划功能
- [ ] 分布式训练自动部署
- [ ] 实验对比和分析
- [ ] 模型版本管理
- [ ] 超参数自动调优
- [ ] 多租户支持
- [ ] 审计日志系统
- [ ] API网关和限流
- [ ] 监控告警集成

---

## 🤝 贡献指南

我们欢迎社区贡献！请遵循以下步骤：

### 🔀 Pull Request流程

1. **Fork项目**到您的GitHub账户
2. **创建特性分支**：`git checkout -b feature/amazing-feature`
3. **提交更改**：`git commit -m 'Add amazing feature'`
4. **推送分支**：`git push origin feature/amazing-feature`
5. **创建Pull Request**

### 📝 代码规范

#### Go代码规范
- 遵循[Golang Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)
- 使用`gofmt`格式化代码
- 函数注释使用标准格式

#### TypeScript代码规范
- 使用[ESLint](https://eslint.org/)检查代码质量
- 组件使用PascalCase命名
- 文件使用camelCase命名

### 🐛 问题报告

报告Bug时请提供：
- 环境信息（OS、浏览器、K8s版本）
- 重现步骤
- 期望行为 vs 实际行为
- 相关日志和截图

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

---

## 📞 联系方式

- **项目主页**：https://github.com/wenjiehs/RL_on_K8S
- **问题反馈**：https://github.com/wenjiehs/RL_on_K8S/issues
- **功能建议**：https://github.com/wenjiehs/RL_on_K8S/discussions

---

<div align="center">

**🤖 RL Training Platform - 让强化学习训练更简单**

Made with ❤️ by [wenjiehs](https://github.com/wenjiehs)

[⭐ Star](https://github.com/wenjiehs/RL_on_K8S) • [🍴 Fork](https://github.com/wenjiehs/RL_on_K8S/fork) • [📖 文档](docs/)

</div>