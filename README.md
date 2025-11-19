# 基于Kubernetes的强化学习云控制台系统

## 🎯 项目概述

本项目是一个基于Kubernetes的强化学习云控制台系统，提供完整的分布式训练任务管理、环境管理、数据存储和监控功能。系统基于腾讯云TKE集群和CFS Turbo存储，实现了高效的强化学习训练环境。

## 🚀 核心功能

### 1. 集群管理
- **Kubernetes集群连接**：支持连接腾讯云TKE集群
- **集群状态监控**：实时显示节点状态和资源使用情况
- **多集群管理**：支持切换和管理多个Kubernetes集群

### 2. 环境管理
- **Ray环境管理**：创建、删除、监控Ray集群
- **环境状态监控**：实时查看Ray Head和Worker节点状态
- **Dashboard访问**：集成Ray Dashboard提供详细监控
- **Shell访问**：Web Shell直接连接Ray Head Pod

### 3. 数据管理（基于CFS）
- **CFS存储连接**：支持腾讯云CFS Turbo存储
- **实时文件浏览**：Web界面浏览和管理数据文件
- **存储统计**：显示CFS存储使用情况（2.0T总容量，1.7T可用）
- **文件操作**：支持上传、下载、删除文件

### 4. 训练任务管理
- **训练任务创建**：支持多种强化学习算法配置
- **实时监控**：查看训练进度、资源使用、日志输出
- **Checkpoint管理**：训练检查点保存和恢复
- **指标监控**：训练指标可视化监控

## 🏗️ 系统架构

### 前端架构
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend │    │  Kubernetes    │    │  腾讯云CFS     │
│   (React)     │    │   TKE集群      │    │   Turbo存储     │
│   Port: 3000  │    │                │    │                │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                      │                      │
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Server   │    │  Ray Cluster   │    │  CFS Pods      │
│   (Go)       │───▶│  (训练环境)    │───▶│  (数据访问)     │
│   Port: 8080  │    │                │    │                │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                      │                      │
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SQLite DB    │    │  Ray Cluster   │    │  CFS Pods      │
│   (本地存储)   │    │  (环境管理)    │    │  (存储访问)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 后端架构
- **API Server**: Go语言编写的RESTful API服务
- **数据库**: SQLite本地数据库，存储任务和配置信息
- **Kubernetes客户端**: 使用client-go与K8s API交互
- **Ray Operator**: 基于KubeRay operator管理Ray集群

## 📦 技术栈

### 前端
- **React 18**: 现代化前端框架
- **TypeScript**: 类型安全的JavaScript
- **Ant Design**: 企业级UI组件库
- **Axios**: HTTP客户端
- **React Router**: 前端路由

### 后端
- **Go 1.21**: 高性能后端语言
- **Gin**: Web框架
- **SQLite**: 轻量级数据库
- **Client-go**: Kubernetes官方Go客户端
- **KubeRay**: Ray集群管理operator

### 基础设施
- **Kubernetes**: 容器编排平台
- **TKE**: 腾讯云容器服务
- **CFS Turbo**: 高性能文件存储
- **Ray**: 分布式机器学习框架

## 🚀 快速开始

### 环境要求
- Go 1.21+
- Node.js 18+
- Kubernetes 1.24+
- 腾讯云TKE集群
- CFS Turbo存储

### 安装步骤

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
```

4. **配置环境变量**
```bash
# 复制配置文件
cp .env.example .env

# 编辑配置
vim .env
```

5. **启动后端服务**
```bash
# 编译后端
go build -o bin/api-server cmd/api-server/*.go

# 启动API服务
./bin/api-server
```

6. **启动前端服务**
```bash
cd frontend
npm start
```

### 访问系统
- 前端界面: http://localhost:3000
- API文档: http://localhost:8080/api
- Ray Dashboard: 通过环境管理页面访问

## 📖 使用指南

### 1. 集群连接
1. 在"集群管理"页面配置Kubernetes连接信息
2. 输入kubeconfig文件或API Server地址
3. 测试连接并保存配置

### 2. 创建训练环境
1. 进入"环境管理"页面
2. 点击"创建环境"
3. 配置环境参数：
   - 环境名称
   - Ray版本
   - 节点数量
   - 资源配置
4. 点击创建，等待环境启动

### 3. 数据管理
1. 在"数据管理"页面浏览CFS存储
2. 上传训练数据集
3. 查看存储使用情况
4. 管理文件和目录

### 4. 创建训练任务
1. 进入"训练任务"页面
2. 点击"创建任务"
3. 配置训练参数：
   - 算法类型
   - 模型配置
   - 数据集选择
   - 资源需求
4. 启动训练并监控进度

## 🔧 配置说明

### 环境变量配置
```bash
# Kubernetes配置
KUBECONFIG=/path/to/kubeconfig

# 数据库配置
DB_PATH=./training.db

# CFS存储配置
CFS_MOUNT_PATH=/mnt/cfs-turbo
CFS_PVC_NAME=rl-cfs-turbo-pv

# API服务配置
API_PORT=8080
API_HOST=0.0.0.0
```

### Ray集群配置
```yaml
# Ray版本
rayVersion: "2.8.0"

# Head节点配置
headGroupSpec:
  rayStartParams:
    dashboard-host: "0.0.0.0"
    num-cpus: "0"
  
# Worker节点配置
workerGroupSpecs:
  - replicas: 2
    groupName: "worker-group"
    rayStartParams:
      num-cpus: "1"
```

## 🐛 故障排除

### 常见问题

1. **Kubernetes连接失败**
   - 检查kubeconfig文件路径
   - 验证集群访问权限
   - 确认API Server地址正确

2. **Ray环境创建失败**
   - 检查KubeRay operator是否安装
   - 验证资源配额是否充足
   - 查看Pod日志排查错误

3. **CFS存储访问异常**
   - 确认CFS Turbo已正确挂载
   - 检查PVC状态
   - 验证访问权限

4. **训练任务启动失败**
   - 检查镜像是否可用
   - 验证资源配置
   - 查看训练日志

### 日志查看
```bash
# API服务日志
tail -f api-server.log

# Kubernetes Pod日志
kubectl logs -f <pod-name> -n <namespace>

# Ray集群状态
kubectl get raycluster -n <namespace>
```

## 🤝 贡献指南

1. Fork项目到个人仓库
2. 创建功能分支: `git checkout -b feature/new-feature`
3. 提交更改: `git commit -am 'Add new feature'`
4. 推送分支: `git push origin feature/new-feature`
5. 创建Pull Request

## 📄 许可证

本项目采用MIT许可证，详见[LICENSE](LICENSE)文件。

## 📞 联系方式

- 项目维护者: wenjiehs
- GitHub: https://github.com/wenjiehs/RL_on_K8S
- 问题反馈: https://github.com/wenjiehs/RL_on_K8S/issues

## 🙏 致谢

感谢以下开源项目的支持：
- [Ray](https://github.com/ray-project/ray) - 分布式机器学习框架
- [KubeRay](https://github.com/ray-project/kuberay) - Kubernetes上的Ray Operator
- [React](https://github.com/facebook/react) - 前端框架
- [Ant Design](https://github.com/ant-design/ant-design) - UI组件库
- [Gin](https://github.com/gin-gonic/gin) - Go Web框架