# RL on K8S - 基于 Kubernetes 的强化学习云控制台系统

一个现代化的强化学习训练管理平台，提供多集群管理、环境编排、数据管理和实时监控功能。

## 🌟 核心特性

### 集群管理
- ✅ 多 Kubernetes 集群连接与切换
- ✅ 支持多 Context 管理
- ✅ 实时集群状态监控
- ✅ Namespace 动态切换

### 环境管理
- ✅ 支持多种 RL 框架（Ray、Horovod、DeepSpeed、Custom）
- ✅ KubeRay Operator 集成（自动创建 RayCluster）
- ✅ 环境 CRUD 操作（创建、查看、删除、扩缩容）
- ✅ 环境详情页面（详细配置信息展示）
- ✅ Ray Dashboard 一键访问
- ✅ Web 终端连接 Ray Head 节点（浏览器内 Shell 交互）
- ✅ 资源优化配置（适配资源受限集群）
- ✅ 名称自动规范化

### 数据管理
- ✅ 直接文件系统访问（无需 Kubernetes CRD）
- ✅ 三级分层存储架构（`/cfs/rl-data/{experiment_id}/{data_type}/{date}/`）
- ✅ 四种数据类型分类管理（raw/train/eval/model）
- ✅ 数据集统计可视化（存储占用、类型分布）
- ✅ 文件浏览器（目录导航、文件列表、列表/网格视图切换）
- ✅ 文件操作（下载、删除、预览）
- ✅ 文本文件预览（支持 txt/log/json/yaml/md/py/sh 等）
- ✅ 图片文件预览
- ✅ Parquet 文件预览（Schema 展示、数据表格、分页加载）
- ✅ 腾讯云 CFS Turbo 集成（35TB 容量）
- ✅ 自动存储初始化（智能检测、一键创建 PVC）

### 存储集成
- ✅ 腾讯云 CFS Turbo（CSI 驱动挂载）
- ✅ CFS 存储配置 API（状态查询、初始化、配置管理）
- ✅ Ray 环境自动挂载 CFS 存储（Head 和 Worker 节点）
- ✅ 创建环境页面存储状态显示（实时检测、可视化指示器）
- ✅ 存储配置详情展示（挂载路径、容量、访问模式）

## 🏗️ 技术架构

### 后端技术栈
- **语言**: Go 1.21+
- **框架**: 
  - Kubernetes client-go（集群交互）
  - Gorilla WebSocket（终端连接）
  - xitongsys/parquet-go v1.6.2（Parquet 文件解析）
- **存储**: 腾讯云 CFS Turbo（35TB，CSI 驱动）
- **数据格式**: Apache Parquet（pyarrow/snappy 压缩）

### 前端技术栈
- **框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **UI 组件**: TDesign React v1.12.0
- **终端**: xterm.js
- **样式**: TailwindCSS 3.4.17

### Kubernetes 集成
- **版本**: v1.28+
- **Operator**: KubeRay v1.5.0-rc.0
- **存储**: CFS Turbo CSI Driver (com.tencent.cloud.csi.cfsturbo)

## 📦 快速开始

### 前置要求

1. **Kubernetes 集群**
   - Kubernetes v1.28+
   - KubeRay Operator v1.5.0-rc.0 已安装
   - 腾讯云 CFS Turbo CSI 驱动已配置

2. **开发环境**
   - Go 1.21+
   - Node.js 18+
   - kubectl 配置完成

### 安装步骤

#### 1. 克隆项目
```bash
git clone https://github.com/yourusername/RL_on_K8S.git
cd RL_on_K8S
```

#### 2. 部署 CFS 数据访问器 Pod
```bash
kubectl apply -f scripts/cfs-data-accessor.yaml
kubectl wait --for=condition=Ready pod/cfs-data-accessor -n default --timeout=60s
```

#### 3. 启动后端服务
```bash
# 编译后端
cd cmd/api-server
go build -o ../../bin/api-server

# 启动后端（需要设置 KUBECONFIG）
cd ../..
export KUBECONFIG="$HOME/.kube/config:$HOME/Downloads/cls-jrnaysd3-config"
./bin/api-server
```

后端服务将在 `http://localhost:8080` 启动。

#### 4. 启动前端服务
```bash
cd frontend
npm install
npm run dev
```

前端服务将在 `http://localhost:5173` 启动（或 5174/5175）。

### 访问应用

打开浏览器访问：`http://localhost:5173`

## 🔧 配置说明

### CFS 存储配置

系统使用腾讯云 CFS Turbo 作为共享存储，配置信息：

- **StorageClass**: `cfs-turbo-sc`
- **PVC 名称**: `rl-data-storage`
- **容量**: 100Gi（可扩展至 35TB）
- **访问模式**: ReadWriteMany
- **挂载路径**: `/cfs/rl-data`

### 数据目录结构

```
/cfs/rl-data/
├── {experiment_id}/          # 实验 ID
│   ├── raw/                  # 原始数据
│   │   └── {date}/          # 日期目录
│   │       └── *.parquet    # 数据文件
│   ├── train/               # 训练数据
│   │   └── {date}/
│   ├── eval/                # 评估数据
│   │   └── {date}/
│   └── model/               # 模型文件
│       └── {date}/
```

### 环境变量

后端支持以下环境变量：

- `KUBECONFIG`: Kubernetes 配置文件路径（支持多个，用 `:` 分隔）
- `CFS_USE_POD`: 是否使用 Pod 访问 CFS（默认 `true`）
- `PORT`: API 服务端口（默认 `8080`）

## 📖 使用指南

### 1. 连接集群

1. 访问首页，点击"集群管理"
2. 选择要连接的 Context
3. 点击"连接"按钮
4. 等待连接成功提示

### 2. 创建 Ray 环境

1. 进入"环境管理"页面
2. 点击"创建环境"按钮
3. 填写环境配置：
   - 环境名称
   - 框架类型（选择 Ray）
   - Head 节点配置（CPU、内存、GPU）
   - Worker 节点配置（副本数、资源）
   - 镜像选择
4. 确认存储状态（绿色表示就绪）
5. 点击"创建"

### 3. 访问 Ray Dashboard

1. 在环境列表中找到目标环境
2. 点击"Dashboard"按钮
3. 系统会自动打开 Ray Dashboard

### 4. 使用 Web 终端

1. 在环境列表中找到目标环境
2. 点击"终端"按钮
3. 在浏览器中直接操作 Ray Head 节点的 Shell

### 5. 管理数据集

#### 浏览数据集
1. 进入"数据管理"页面
2. 查看"Datasets"标签页
3. 浏览所有可用数据集

#### 上传数据
1. 点击"创建数据集"按钮
2. 填写实验 ID 和数据类型
3. 选择文件上传
4. 等待上传完成

#### 文件浏览
1. 切换到"File Browser"标签页
2. 导航到目标目录
3. 支持的操作：
   - 下载文件
   - 删除文件
   - 预览文件（文本、图片、Parquet）
   - 切换视图（列表/网格）

#### Parquet 文件预览
1. 在文件浏览器中找到 `.parquet` 文件
2. 点击"预览"按钮
3. 查看 Schema 和数据表格
4. 支持分页浏览（默认显示前 100 行）

### 6. 查看存储统计

1. 进入"数据管理"页面
2. 切换到"Storage Stats"标签页
3. 查看：
   - 总存储占用
   - 各数据类型分布
   - 文件数量统计

## 🔌 API 文档

### 集群管理 API

#### 连接集群
```http
POST /api/cluster/connect
Content-Type: application/json

{
  "context": "cls",
  "kubeConfig": "base64_encoded_kubeconfig"
}
```

#### 查询集群状态
```http
GET /api/cluster/status
```

### 环境管理 API

#### 列出环境
```http
GET /api/environments?namespace=default
```

#### 创建环境
```http
POST /api/environments/create
Content-Type: application/json

{
  "name": "my-ray-env",
  "namespace": "default",
  "framework": "ray",
  "headConfig": {
    "cpu": "2",
    "memory": "4Gi",
    "gpu": "0"
  },
  "workerConfig": {
    "replicas": 2,
    "cpu": "2",
    "memory": "4Gi",
    "gpu": "0"
  }
}
```

#### 删除环境
```http
POST /api/environments/delete
Content-Type: application/json

{
  "name": "my-ray-env",
  "namespace": "default"
}
```

### 数据管理 API

#### 列出数据集
```http
GET /api/datasets?namespace=default
```

#### 浏览目录
```http
GET /api/datasets/browse?path=/cfs/rl-data
```

#### 下载文件
```http
GET /api/datasets/download?path=/cfs/rl-data/exp001/raw/2025-11-17/data.parquet
```

#### 预览 Parquet 文件
```http
GET /api/datasets/preview/parquet?path=/cfs/rl-data/exp001/raw/2025-11-17/data.parquet&limit=100
```

#### 获取存储统计
```http
GET /api/datasets/stats
```

### 存储配置 API

#### 查询存储状态
```http
GET /api/storage/status?namespace=default
```

#### 初始化存储
```http
POST /api/storage/initialize
Content-Type: application/json

{
  "namespace": "default"
}
```

## 🛠️ 开发指南

### 项目结构

```
RL_on_K8S/
├── cmd/
│   └── api-server/          # 后端 API 服务
│       ├── main.go          # 主入口
│       ├── cluster.go       # 集群管理
│       ├── environment.go   # 环境管理
│       ├── cfs_client.go    # CFS 客户端
│       ├── cfs_dataset.go   # 数据集管理
│       ├── dataset.go       # 文件浏览
│       ├── parquet_preview.go # Parquet 预览
│       ├── storage.go       # 存储配置
│       └── terminal.go      # Web 终端
├── frontend/
│   ├── src/
│   │   ├── components/      # React 组件
│   │   ├── pages/          # 页面组件
│   │   └── App.tsx         # 应用入口
│   └── package.json
├── scripts/
│   ├── cfs-data-accessor.yaml  # CFS 访问器 Pod
│   └── fix-cfs-permissions.sh  # 权限修复脚本
└── docs/                    # 文档目录
```

### 添加新功能

1. **后端 API**
   - 在 `cmd/api-server/` 中添加新的处理函数
   - 在 `main.go` 中注册路由
   - 更新 API 文档

2. **前端页面**
   - 在 `frontend/src/pages/` 中创建新页面
   - 在 `App.tsx` 中添加路由
   - 使用 TDesign 组件保持 UI 一致性

### 代码规范

- **Go**: 遵循 Go 官方代码规范
- **TypeScript**: 使用 ESLint + Prettier
- **提交信息**: 遵循 Conventional Commits

## 🐛 故障排查

### 后端无法连接集群

**问题**: API 返回 "Not connected to any cluster"

**解决方案**:
1. 检查 KUBECONFIG 环境变量是否正确设置
2. 验证 kubeconfig 文件路径是否存在
3. 确认 kubectl 可以正常访问集群

### 数据集 API 返回空数组

**问题**: `/api/datasets` 返回 `[]`

**解决方案**:
1. 确认 CFS 数据访问器 Pod 正在运行：
   ```bash
   kubectl get pod cfs-data-accessor -n default
   ```
2. 检查 CFS 存储是否正确挂载：
   ```bash
   kubectl exec -n default cfs-data-accessor -- ls -la /cfs/rl-data
   ```
3. 验证后端已连接到集群

### Web 终端无法连接

**问题**: 终端显示连接错误

**解决方案**:
1. 检查 Ray Head Pod 是否运行正常
2. 验证 WebSocket 连接是否被防火墙阻止
3. 查看浏览器控制台错误信息

### Parquet 文件预览失败

**问题**: 预览 Parquet 文件时报错

**解决方案**:
1. 确认文件格式正确（使用 pyarrow 生成）
2. 检查文件大小（建议 < 100MB）
3. 验证后端日志中的详细错误信息

## 📝 更新日志

### v1.0.0 (2025-11-17)

#### 新增功能
- ✅ 多集群管理与连接
- ✅ Ray 环境自动化部署
- ✅ Web 终端集成
- ✅ CFS Turbo 存储集成
- ✅ 数据集管理（无 CRD）
- ✅ Parquet 文件预览
- ✅ 文件浏览器
- ✅ 存储统计可视化

#### 技术改进
- ✅ 移除 Kubernetes CRD 依赖
- ✅ 优化 BusyBox 兼容性
- ✅ 改进错误处理
- ✅ 增强日志记录

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 👥 作者

- **Virgil Liang** - *Initial work*

## 🙏 致谢

- [KubeRay](https://github.com/ray-project/kuberay) - Ray on Kubernetes
- [TDesign](https://tdesign.tencent.com/) - 企业级设计体系
- [xterm.js](https://xtermjs.org/) - 终端模拟器
- [Kubernetes](https://kubernetes.io/) - 容器编排平台