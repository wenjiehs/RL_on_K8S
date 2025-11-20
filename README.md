# 基于Kubernetes的强化学习云控制台系统

## 🎯 项目概述

本项目是一个基于Kubernetes的强化学习云控制台系统，提供完整的分布式训练任务管理、环境管理、数据存储和监控功能。系统基于腾讯云TKE集群和CFS Turbo存储，实现了高效的强化学习训练环境，支持Ray集群的完整生命周期管理和VERL框架的训练任务。

## 🚀 核心功能

### 1. 集群管理
- **Kubernetes集群连接**：支持连接腾讯云TKE集群
- **集群状态监控**：实时显示节点状态和资源使用情况
- **节点详情查看**：查看节点资源分配、Pod状态和系统信息
- **多集群支持**：通过kubeconfig文件切换不同集群

### 2. 环境管理
- **Ray环境管理**：基于KubeRay operator创建和管理Ray集群
- **环境状态监控**：实时查看Ray Head和Worker节点状态
- **Dashboard集成**：直接访问Ray Dashboard进行详细监控
- **Web Shell访问**：通过xterm.js提供Web终端直接连接Ray Head Pod
- **资源配置显示**：正确解析和显示GPU、CPU、内存资源（支持RayCluster CRD）
- **环境生命周期管理**：创建、启动、停止、删除Ray集群

### 3. 数据管理（基于CFS）
- **CFS存储连接**：支持腾讯云CFS Turbo高性能文件存储
- **实时文件浏览**：Web界面浏览和管理训练数据、模型文件
- **存储统计**：实时显示CFS存储使用情况和容量信息
- **文件操作**：支持文件上传、下载、删除、目录创建等操作
- **数据集管理**：支持训练数据集的创建和管理

### 4. 训练任务管理
- **VERL训练支持**：基于VERL（Versatile Reinforcement Learning）框架
- **训练任务创建**：支持DPO算法配置，自动生成训练命令
- **GPU资源配置**：正确配置`trainer.n_gpus_per_node`参数，支持多GPU训练
- **实时监控**：查看训练进度、资源使用、日志输出
- **Checkpoint管理**：训练检查点自动保存到CFS存储
- **训练日志**：实时查看训练输出，支持日志流式传输
- **任务状态管理**：创建、启动、停止、删除训练任务

### 5. 监控和可视化
- **训练指标图表**：使用Recharts库可视化训练指标
- **资源使用监控**：实时显示CPU、内存、GPU使用情况
- **日志查看器**：支持实时日志流和历史日志查看

## 🏗️ 系统架构

### 整体架构
```
┌─────────────────────────────────────────────────────────────────┐
│                        前端层 (Frontend)                        │
│  React 18 + TypeScript + TDesign + Vite                        │
│  Port: 5173                                                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API层 (Backend)                         │
│  Go 1.24 + Gin + GORM + WebSocket                              │
│  Port: 8080                                                     │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Kubernetes    │  │   SQLite DB     │  │  CFS Storage    │
│   TKE集群       │  │   (任务配置)     │  │  (训练数据)     │
│                 │  │                 │  │                 │
│ • RayCluster   │  │ • TrainingJobs  │  │ • Datasets      │
│ • Pods         │  │ • Environments  │  │ • Models        │
│ • PVCs         │  │ • Datasets      │  │ • Checkpoints   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 技术架构
- **前端架构**:
  - React 18 + TypeScript：现代化前端框架
  - TDesign：企业级UI组件库
  - Vite：快速构建工具
  - React Router：前端路由管理
  - xterm.js：Web终端组件
  - Recharts：数据可视化图表

- **后端架构**:
  - Go 1.24：高性能后端服务
  - Gin：轻量级Web框架
  - GORM + SQLite：数据持久化
  - Client-go：Kubernetes官方客户端
  - KubeRay：Ray集群Operator集成
  - WebSocket：实时日志和终端通信

- **基础设施**:
  - Kubernetes：容器编排平台
  - KubeRay Operator：Ray集群生命周期管理
  - CFS Turbo：高性能共享文件存储
  - VERL：强化学习训练框架
  - Docker：容器化部署

## 📦 技术栈

### 前端技术
- **React 18**: 现代化前端框架，支持并发特性
- **TypeScript**: 类型安全的JavaScript超集
- **TDesign**: 腾讯开源的企业级UI组件库
- **Vite**: 下一代前端构建工具，快速热更新
- **React Router**: 前端路由管理
- **xterm.js**: Web终端组件，支持Shell访问
- **Recharts**: React图表库，用于训练指标可视化
- **Axios**: HTTP客户端，与后端API通信

### 后端技术
- **Go 1.24**: 高性能后端语言，支持最新特性
- **Gin**: 轻量级Web框架，高性能HTTP路由
- **GORM**: Go语言ORM库，支持SQLite数据库
- **SQLite**: 轻量级嵌入式数据库，存储任务配置
- **Client-go**: Kubernetes官方Go客户端库
- **KubeRay**: Ray集群Kubernetes Operator
- **Gorilla WebSocket**: 实时通信支持
- **Gorilla Mux**: HTTP路由器

### 训练框架
- **VERL**: Versatile Reinforcement Learning框架
- **Ray**: 分布式机器学习框架
- **DPO**: Direct Preference Optimization算法
- **PyTorch**: 深度学习框架（通过VERL集成）

### 基础设施
- **Kubernetes 1.24+**: 容器编排平台
- **TKE**: 腾讯云容器服务
- **CFS Turbo**: 腾讯云高性能文件存储
- **Docker**: 容器化部署
- **KubeRay Operator**: Ray集群生命周期管理

## 🚀 快速开始

### 环境要求
- **Go 1.24+**: 后端开发环境
- **Node.js 18+**: 前端开发环境
- **Kubernetes 1.24+**: 容器编排平台
- **腾讯云TKE集群**: 生产环境推荐
- **CFS Turbo存储**: 高性能文件存储
- **kubectl**: Kubernetes命令行工具
- **Docker**: 容器构建工具

### 快速安装

#### 方法一：使用启动脚本（推荐）

1. **克隆项目**
```bash
git clone https://github.com/wenjiehs/RL_on_K8S.git
cd RL_on_K8S
```

2. **启动后端服务**
```bash
# 使用提供的启动脚本（自动处理依赖和配置）
./start-api-server.sh
```

3. **启动前端服务**
```bash
# 使用提供的启动脚本
./start-frontend.sh
```

#### 方法二：手动安装

1. **克隆项目**
```bash
git clone https://github.com/wenjiehs/RL_on_K8S.git
cd RL_on_K8S
```

2. **安装后端依赖**
```bash
go mod download
```

3. **安装前端依赖**
```bash
cd frontend
npm install
cd ..
```

4. **配置kubeconfig**
```bash
# 设置kubeconfig环境变量
export KUBECONFIG=/path/to/your/kubeconfig
```

5. **启动后端服务**
```bash
# 编译后端
go build -o bin/api-server cmd/api-server/*.go

# 启动API服务（后台运行）
./bin/api-server > api-server.log 2>&1 &
```

6. **启动前端服务**
```bash
cd frontend
npm run dev
```

### 访问系统
- **前端界面**: http://localhost:5173
- **后端API**: http://localhost:8080
- **API健康检查**: http://localhost:8080/api/cluster/status
- **Ray Dashboard**: 通过前端环境管理页面访问

### 验证安装

1. **检查后端服务**
```bash
curl http://localhost:8080/api/cluster/status
```

2. **检查前端服务**
```bash
curl http://localhost:5173
```

3. **查看服务状态**
```bash
# 查看后端进程
ps aux | grep api-server

# 查看前端进程
lsof -i :5173
```

## 📖 使用指南

### 1. 集群连接配置
1. **访问集群管理页面**
   - 打开前端界面，点击"集群管理"
   - 系统会自动读取当前kubeconfig配置
   
2. **验证集群连接**
   - 查看集群状态和节点信息
   - 确认集群资源可用性
   
3. **多集群支持**
   - 可通过修改kubeconfig文件切换不同集群

### 2. Ray环境管理
1. **创建Ray环境**
   - 进入"环境管理"页面
   - 点击"创建环境"
   - 配置环境参数：
     - 环境名称（如：ray-single-group）
     - Ray版本（推荐：2.8.0）
     - Head节点资源配置
     - Worker节点配置和副本数
     - GPU资源配置（支持多GPU）

2. **环境监控**
   - 实时查看Ray Head和Worker节点状态
   - 监控CPU、内存、GPU使用情况
   - 访问Ray Dashboard进行详细监控

3. **Web Shell访问**
   - 点击"终端"按钮打开Web Shell
   - 直接在Ray Head Pod中执行命令
   - 支持文件操作和进程管理

### 3. 数据和存储管理
1. **CFS存储浏览**
   - 在"数据管理"页面浏览CFS Turbo存储
   - 支持目录导航和文件预览
   - 实时显示存储使用情况

2. **数据集管理**
   - 创建和管理训练数据集
   - 支持多种数据格式（Parquet、JSON等）
   - 数据集路径自动配置到训练任务

3. **文件操作**
   - 上传训练数据和模型文件
   - 下载训练结果和检查点
   - 创建目录和删除文件

### 4. VERL训练任务管理
1. **创建训练任务**
   - 进入"训练任务"页面
   - 点击"创建任务"
   - 配置训练参数：
     - 任务名称和描述
     - 选择Ray环境（自动读取GPU配置）
     - 选择基础模型（支持多种预训练模型）
     - 选择训练数据集
     - 配置训练参数（学习率、批次大小等）
     - 设置输出目录（CFS存储路径）

2. **GPU资源配置**
   - 系统自动从环境配置读取GPU数量
   - 正确生成`trainer.n_gpus_per_node`参数
   - 支持多GPU分布式训练

3. **训练监控**
   - 实时查看训练日志输出
   - 监控训练进度和资源使用
   - 查看训练指标图表
   - 管理训练检查点

4. **训练命令预览**
   - 自动生成完整的VERL训练命令
   - 支持命令预览和调试
   - 包含所有必要的参数配置

### 5. 监控和调试
1. **系统监控**
   - 查看集群资源使用情况
   - 监控Pod状态和节点健康
   - 实时日志查看和分析

2. **训练调试**
   - 查看详细训练日志
   - 访问Ray Dashboard调试
   - Web Shell直接操作训练环境

## 🔧 配置说明

### 环境变量配置
```bash
# Kubernetes配置
export KUBECONFIG=/path/to/your/kubeconfig

# 数据库配置
export DB_PATH=./training.db

# CFS存储配置
export CFS_MOUNT_PATH=/mnt/cfs-turbo
export CFS_PVC_NAME=rl-cfs-turbo-pv

# API服务配置
export API_PORT=8080
export API_HOST=0.0.0.0
```

### 启动脚本配置
**start-api-server.sh** 主要配置：
```bash
# kubeconfig路径（需要根据实际环境修改）
KUBECONFIG_PATH="/Users/virgilliang/Downloads/cls-jrnaysd3-config"

# API服务器二进制路径
API_SERVER_BIN="./bin/api-server"

# 日志文件
LOG_FILE="api-server.log"

# 服务端口
PORT="8080"
```

### Ray集群配置示例
```yaml
# RayCluster CRD配置
apiVersion: ray.io/v1alpha1
kind: RayCluster
metadata:
  name: ray-single-group
  namespace: default
spec:
  rayVersion: "2.8.0"
  
  # Head节点配置
  headGroupSpec:
    rayStartParams:
      dashboard-host: "0.0.0.0"
      num-cpus: "0"
    template:
      spec:
        containers:
        - name: ray-head
          resources:
            limits:
              cpu: "4"
              memory: "16Gi"
              nvidia.com/gpu: "8"  # GPU配置
            requests:
              cpu: "2"
              memory: "8Gi"
  
  # Worker节点配置
  workerGroupSpecs:
  - replicas: 2
    groupName: "worker-group"
    rayStartParams:
      num-cpus: "1"
    template:
      spec:
        containers:
        - name: ray-worker
          resources:
            limits:
              cpu: "4"
              memory: "16Gi"
              nvidia.com/gpu: "8"  # GPU配置
            requests:
              cpu: "2"
              memory: "8Gi"
```

### VERL训练配置
系统自动生成的训练命令示例：
```bash
PYTHONUNBUFFERED=1 python3 -m verl.trainer.main_ppo \
    data.train_files=/mnt/cfs-turbo/cfs/dataset.parquet \
    data.val_files=/mnt/cfs-turbo/cfs/dataset.parquet \
    data.train_batch_size=256 \
    data.max_prompt_length=512 \
    data.max_response_length=256 \
    actor_rollout_ref.model.path=/mnt/cfs-turbo/cfs/base_model \
    actor_rollout_ref.actor.optim.lr=1e-6 \
    actor_rollout_ref.actor.ppo_mini_batch_size=64 \
    actor_rollout_ref.actor.ppo_micro_batch_size_per_gpu=4 \
    actor_rollout_ref.rollout.name=vllm \
    actor_rollout_ref.rollout.tensor_model_parallel_size=1 \
    actor_rollout_ref.rollout.gpu_memory_utilization=0.3 \
    critic.optim.lr=1e-5 \
    critic.model.path=/mnt/cfs-turbo/cfs/base_model \
    critic.ppo_micro_batch_size_per_gpu=4 \
    algorithm.kl_ctrl.kl_coef=0.001 \
    trainer.logger='[console]' \
    trainer.val_before_train=false \
    trainer.default_local_dir=/mnt/cfs-turbo/cfs/checkpoint \
    trainer.n_gpus_per_node=8 \  # 自动从环境配置读取
    trainer.nnodes=2 \
    trainer.save_freq=1 \
    trainer.test_freq=10 \
    trainer.total_epochs=8 \
    +distributed.backend=nccl \
    2>&1 | tee /mnt/cfs-turbo/cfs/checkpoint/training.log
```

## 🐛 故障排除

### 常见问题及解决方案

1. **Kubernetes连接失败**
   ```bash
   # 检查kubeconfig文件
   kubectl --kubeconfig=/path/to/kubeconfig cluster-info
   
   # 验证权限
   kubectl get nodes
   
   # 检查API服务器地址
   kubectl config view
   ```

2. **Ray环境创建失败**
   ```bash
   # 检查KubeRay operator
   kubectl get pods -n ray-system
   
   # 查看RayCluster状态
   kubectl get raycluster -o wide
   
   # 查看Pod日志
   kubectl logs -f <ray-pod-name> -n <namespace>
   ```

3. **GPU资源显示错误**
   - 确认RayCluster CRD配置正确
   - 检查GPU资源limits配置
   - 验证nvidia.com/gpu资源可用性

4. **CFS存储访问异常**
   ```bash
   # 检查PVC状态
   kubectl get pvc
   
   # 查看存储类
   kubectl get storageclass
   
   # 验证挂载点
   kubectl exec -it <pod> -- df -h
   ```

5. **训练任务GPU配置错误**
   - 确认环境GPU资源配置正确
   - 检查生成的训练命令中`trainer.n_gpus_per_node`参数
   - 验证Ray集群GPU可用性

6. **前端无法访问**
   ```bash
   # 检查端口占用
   lsof -i :5173
   
   # 重启前端服务
   ./start-frontend.sh
   
   # 查看前端日志
   tail -f /tmp/vite-server.log
   ```

7. **后端API无响应**
   ```bash
   # 检查后端进程
   ps aux | grep api-server
   
   # 重启后端服务
   ./start-api-server.sh
   
   # 查看后端日志
   tail -f api-server.log
   ```

### 日志查看命令
```bash
# API服务日志
tail -f api-server.log

# 前端服务日志
tail -f /tmp/vite-server.log

# Kubernetes Pod日志
kubectl logs -f <pod-name> -n <namespace>

# Ray集群状态
kubectl get raycluster -n <namespace> -o wide

# 查看训练任务状态
kubectl get pods -l job-name=<training-job-name>

# 系统事件
kubectl get events --sort-by=.metadata.creationTimestamp
```

## 📁 项目结构

```
RL_on_K8S/
├── cmd/api-server/              # 后端API服务源码
│   ├── main.go                  # 服务入口
│   ├── environment.go            # 环境管理（RayCluster资源解析）
│   ├── training-job-*.go        # 训练任务管理
│   ├── database.go              # 数据库操作
│   └── ...                      # 其他API处理器
├── frontend/                     # 前端React应用
│   ├── src/
│   │   ├── components/          # UI组件
│   │   │   ├── CreateTrainingJobDialog.tsx  # 训练任务创建
│   │   │   ├── CreateEnvironmentDialog.tsx  # 环境创建
│   │   │   ├── WebTerminal.tsx  # Web终端
│   │   │   └── ...              # 其他组件
│   │   ├── pages/               # 页面组件
│   │   │   ├── TrainingJobs.tsx # 训练任务管理
│   │   │   ├── Environments.tsx # 环境管理
│   │   │   ├── DataManagement.tsx # 数据管理
│   │   │   └── ...              # 其他页面
│   │   └── App.tsx              # 应用入口
│   ├── package.json             # 前端依赖
│   └── vite.config.ts           # Vite配置
├── scripts/                     # 部署和工具脚本
│   ├── install-kuberay.sh       # KubeRay安装脚本
│   ├── cfs-*.yaml               # CFS存储配置
│   └── generate_test_parquet.py # 测试数据生成
├── deployments/                 # Kubernetes部署文件
├── docs/                        # 项目文档
├── start-api-server.sh          # 后端启动脚本
├── start-frontend.sh            # 前端启动脚本
├── go.mod                       # Go模块依赖
├── go.sum                       # Go依赖校验
└── README.md                    # 项目说明
```

## 🚀 部署指南

### 生产环境部署

1. **Kubernetes集群准备**
   ```bash
   # 安装KubeRay Operator
   kubectl apply -f https://raw.githubusercontent.com/ray-project/kuberay/v1.5.0/ray-operator/config/default/kustomization.yaml
   
   # 验证安装
   kubectl get pods -n ray-system
   ```

2. **CFS存储配置**
   ```bash
   # 创建CFS存储类和PVC
   kubectl apply -f scripts/cfs-storage.yaml
   kubectl apply -f scripts/cfs-production.yaml
   ```

3. **应用部署**
   ```bash
   # 构建Docker镜像（可选）
   docker build -t rl-console:latest .
   
   # 部署到Kubernetes
   kubectl apply -f deployments/
   ```

### 开发环境设置

1. **本地开发**
   ```bash
   # 启动开发环境
   make dev
   
   # 或分别启动
   ./start-api-server.sh &
   ./start-frontend.sh
   ```

2. **调试模式**
   ```bash
   # 后端调试
   go run cmd/api-server/*.go
   
   # 前端调试
   cd frontend && npm run dev
   ```

## 🧪 测试

### 单元测试
```bash
# 后端测试
go test ./...

# 前端测试
cd frontend && npm test
```

### 集成测试
```bash
# 创建测试环境
kubectl apply -f scripts/test-environment.yaml

# 运行训练任务测试
curl -X POST http://localhost:8080/api/training-jobs \
  -H "Content-Type: application/json" \
  -d @test-data/training-job.json
```

## 🤝 贡献指南

### 开发流程
1. **Fork项目**到个人GitHub仓库
2. **创建功能分支**: `git checkout -b feature/new-feature`
3. **开发新功能**:
   - 遵循代码规范
   - 添加单元测试
   - 更新文档
4. **提交更改**: `git commit -am 'Add new feature'`
5. **推送分支**: `git push origin feature/new-feature`
6. **创建Pull Request**到主分支

### 代码规范
- **Go代码**: 遵循Go官方代码规范，使用gofmt格式化
- **TypeScript代码**: 使用ESLint和Prettier格式化
- **提交信息**: 使用约定式提交格式（Conventional Commits）

### 问题报告
- 使用GitHub Issues报告bug
- 提供详细的复现步骤和环境信息
- 包含相关的日志和错误信息

## 📄 许可证

本项目采用MIT许可证，详见[LICENSE](LICENSE)文件。

## 📞 联系方式

- **项目维护者**: wenjiehs
- **GitHub仓库**: https://github.com/wenjiehs/RL_on_K8S
- **问题反馈**: https://github.com/wenjiehs/RL_on_K8S/issues
- **功能请求**: https://github.com/wenjiehs/RL_on_K8S/discussions

## 🙏 致谢

感谢以下开源项目的支持：

### 核心框架
- [Ray](https://github.com/ray-project/ray) - 分布式机器学习框架
- [VERL](https://github.com/volcengine/verl) - Versatile Reinforcement Learning框架
- [KubeRay](https://github.com/ray-project/kuberay) - Kubernetes上的Ray Operator

### 前端技术
- [React](https://github.com/facebook/react) - 现代化前端框架
- [TDesign](https://github.com/Tencent/tdesign) - 企业级UI组件库
- [Vite](https://github.com/vitejs/vite) - 下一代前端构建工具
- [xterm.js](https://github.com/xtermjs/xterm.js) - Web终端组件

### 后端技术
- [Gin](https://github.com/gin-gonic/gin) - Go Web框架
- [GORM](https://github.com/go-gorm/gorm) - Go ORM库
- [Client-go](https://github.com/kubernetes/client-go) - Kubernetes官方Go客户端

### 基础设施
- [Kubernetes](https://github.com/kubernetes/kubernetes) - 容器编排平台
- [腾讯云TKE](https://cloud.tencent.com/product/tke) - 容器服务
- [腾讯云CFS](https://cloud.tencent.com/product/cfs) - 文件存储服务