# RL on K8S - 强化学习云控制台系统

基于Kubernetes的强化学习训练环境管理平台，提供可视化的集群管理、环境配置、数据管理和训练任务监控功能。

## 🌟 核心特性

### 集群管理
- ✅ 多集群连接支持（支持多Context切换）
- ✅ 可视化集群状态监控
- ✅ 实时资源统计（Pods、Namespaces等）
- ✅ 支持exec插件认证（如kubectl-ianvs）

### 环境管理
- ✅ 支持多种RL框架（Ray、Horovod、DeepSpeed、Custom）
- ✅ KubeRay集成（自动创建和管理RayCluster）
- ✅ 环境CRUD操作（创建、查看、删除、扩缩容）
- ✅ 环境详情页（详细配置信息展示）
- ✅ Ray Dashboard一键连接
- ✅ Web终端连接Ray Head节点（浏览器内Shell交互）
- ✅ 实时状态监控（自动刷新）
- ✅ Namespace切换支持
- ✅ 名称自动规范化
- ✅ 资源优化配置（适配资源受限集群）

### 数据管理
- ✅ 统一的Data Management页面（Tab组件整合）
- ✅ 数据集CRUD操作（创建、列表查看、删除）
- ✅ 三级分层存储架构（/cfs/rl-data/{experiment_id}/{data_type}/{date}/）
- ✅ 四种数据类型分类管理（raw/train/eval/model）
- ✅ 数据集统计可视化（存储占用、类型分布）
- ✅ 文件浏览器（目录导航、文件列表、列表/网格视图切换）
- ✅ 文件操作（下载、删除、预览）
- ✅ 文本文件预览（支持txt/log/json/yaml/md/py/sh等）
- ✅ 图片文件预览
- ✅ Parquet文件预览（Schema展示、数据表格、分页加载）
- ✅ 腾讯云CFS Turbo集成（NFS v4.0挂载）

### 用户体验
- ✅ 现代化UI设计（基于TDesign）
- ✅ 响应式布局
- ✅ 友好的错误提示
- ✅ 实时状态更新
- ✅ 浏览器内终端（xterm.js）

## 🏗️ 技术架构

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **UI组件库**: TDesign React
- **路由**: React Router v6
- **图表**: Recharts
- **图标**: TDesign Icons + Lucide React
- **终端**: xterm.js + xterm-addon-fit

### 后端
- **语言**: Go 1.21+
- **框架**: 标准库 net/http
- **K8s客户端**: client-go + dynamic client
- **WebSocket**: Gorilla WebSocket
- **数据解析**: parquet-go (xitongsys/parquet-go v1.6.2)
- **CORS**: rs/cors

### Kubernetes
- **版本**: v1.28+
- **CRD**: KubeRay Operator v1.5.0-rc.0
- **资源**: RayCluster、Deployment、Service、PV/PVC
- **存储**: 腾讯云CFS Turbo (NFS v4.0)

## 📦 项目结构

```
RL_on_K8S/
├── cmd/
│   └── api-server/              # API服务器入口
│       ├── main.go              # 主程序和路由
│       ├── environment.go       # 环境管理逻辑
│       ├── dataset.go           # 数据集管理逻辑
│       ├── file.go              # 文件操作逻辑
│       └── terminal.go          # Web终端逻辑
├── frontend/
│   ├── src/
│   │   ├── components/          # React组件
│   │   │   ├── ClusterConfigDialog.tsx
│   │   │   ├── CreateEnvironmentDialog.tsx
│   │   │   ├── DatasetList.tsx
│   │   │   ├── StorageStats.tsx
│   │   │   ├── FileBrowser.tsx
│   │   │   ├── FilePreview.tsx
│   │   │   └── Terminal.tsx
│   │   └── pages/               # 页面组件
│   │       ├── Cluster.tsx
│   │       ├── Dashboard.tsx
│   │       ├── Environments.tsx
│   │       ├── EnvironmentDetail.tsx
│   │       ├── DataManagement.tsx
│   │       ├── TrainingJobs.tsx
│   │       └── Monitoring.tsx
│   ├── package.json
│   └── vite.config.ts
├── api/
│   └── v1alpha1/                # CRD定义
│       └── dataset_types.go
├── docs/                        # 文档目录
│   ├── DEPLOYMENT_GUIDE.md
│   ├── DATA_MANAGEMENT_MERGE.md
│   └── ...
├── scripts/                     # 脚本目录
│   ├── generate_test_data.py
│   └── ...
├── go.mod
├── go.sum
└── README.md
```

## 🚀 快速开始

### 前置要求

- Go 1.21+
- Node.js 18+
- Kubernetes集群（v1.28+）
- KubeRay Operator（可选，用于Ray环境）
- kubectl配置文件
- 腾讯云CFS Turbo（可选，用于数据持久化）

### 安装KubeRay Operator（可选）

如果需要使用Ray环境，请先安装KubeRay Operator：

```bash
# 安装KubeRay Operator
kubectl create -k "github.com/ray-project/kuberay/ray-operator/config/default?ref=v1.0.0&timeout=90s"

# 验证安装
kubectl get pods -n ray-system
```

### 配置CFS存储（可选）

如果需要使用数据管理功能，请配置CFS存储：

```bash
# 创建PV和PVC
kubectl apply -f scripts/cfs-pv.yaml
kubectl apply -f scripts/cfs-pvc.yaml

# 验证挂载
kubectl get pv,pvc -n default
```

### 后端启动

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/RL_on_K8S.git
cd RL_on_K8S

# 2. 安装依赖
go mod download

# 3. 编译API服务器
cd cmd/api-server
go build -o ../../bin/api-server .

# 4. 启动服务器
cd ../..
nohup ./bin/api-server > backend.log 2>&1 &

# 5. 验证服务
curl http://localhost:8080/api/cluster/status
```

### 前端启动

```bash
# 1. 进入前端目录
cd frontend

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 4. 访问应用
# 浏览器打开 http://localhost:5173/
```

## 📖 使用指南

### 1. 连接到Kubernetes集群

1. 打开浏览器访问 `http://localhost:5173/`
2. 点击顶部导航栏的 "Cluster" 或 "集群管理"
3. 上传kubeconfig文件或粘贴内容
4. 选择要使用的Context
5. 点击 "Connect" 连接到集群
6. 等待连接成功提示

**注意**：如果使用exec插件认证（如kubectl-ianvs），需要先执行登录命令：
```bash
kubectl ianvs login <cluster-id> --expired=1h
```

### 2. 创建训练环境

1. 连接成功后，点击 "Environments" 或 "环境管理"
2. 点击 "Create Environment" 按钮
3. 填写环境信息：
   - **Name**: 环境名称（自动规范化）
   - **Framework**: 选择框架（Ray/Horovod/DeepSpeed/Custom）
   - **Namespace**: 选择命名空间
   - **Workers**: Worker节点数量
   - **Image**: 选择或自定义镜像
4. 点击 "Create" 创建环境
5. 等待环境创建完成

### 3. 查看环境详情

1. 在环境列表中点击环境的**名称**
2. 查看详细信息：
   - 基本信息（名称、框架、状态、创建时间等）
   - 配置信息（Ray版本、Python版本、资源分配）
   - 节点配置（Head节点、Worker节点数量）
   - 存储信息（持久化存储路径、容量）
   - 网络信息（Head节点IP、Dashboard端口等）
3. 实时状态监控（每5秒自动刷新）

### 4. 使用Web终端

对于Ray环境，可以直接在浏览器中连接到Head节点：

1. 在环境列表中点击 "Terminal" 按钮
2. 等待终端连接建立
3. 在浏览器内执行Shell命令
4. 支持终端尺寸自适应
5. 支持复制粘贴（Ctrl+Shift+C/V）

### 5. 数据管理

#### 创建数据集

1. 点击 "Data Management" 导航菜单
2. 在 "Datasets" Tab中点击 "Create Dataset"
3. 填写数据集信息：
   - **Name**: 数据集名称
   - **Experiment ID**: 实验标识
   - **Data Type**: 数据类型（raw/train/eval/model）
   - **Description**: 描述信息
4. 点击 "Create Dataset" 创建

#### 浏览文件

1. 在数据集列表中点击 "Browse" 按钮
2. 使用文件浏览器：
   - 左侧：快速导航面板
   - 右侧：文件列表（支持列表/网格视图切换）
3. 支持的操作：
   - 下载文件
   - 删除文件
   - 预览文件（文本、图片、Parquet）

#### 查看存储统计

1. 切换到 "Storage Statistics" Tab
2. 查看统计信息：
   - 总数据集数量
   - 总存储容量
   - 各类型数据集分布
   - 存储占用可视化
   - 最近上传记录

### 6. 环境管理操作

#### 扩缩容
1. 在环境列表中点击 "Scale" 按钮
2. 输入新的Worker数量
3. 点击确认

#### 删除环境
1. 在环境列表中点击 "Delete" 按钮
2. 确认删除操作
3. 等待删除完成

## 🔧 配置说明

### 后端配置

API服务器默认配置：
- **端口**: 8080
- **CORS**: 允许 localhost:5173, 5174, 5175
- **日志**: backend.log
- **CFS路径**: /cfs/rl-data

可通过环境变量修改：
```bash
export PORT=8080
export CFS_BASE_PATH=/cfs/rl-data
```

### 前端配置

前端开发服务器配置（`vite.config.ts`）：
```typescript
export default defineConfig({
  server: {
    host: '0.0.0.0',
    allowedHosts: true
  }
})
```

### Ray环境资源配置

默认资源配置（已优化）：
- **Head节点**:
  - CPU: 1000m
  - Memory: 4Gi
- **Worker节点**:
  - CPU: 1000m
  - Memory: 2Gi

### CFS存储配置

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: cfs-pv
spec:
  capacity:
    storage: 35Ti
  accessModes:
    - ReadWriteMany
  nfs:
    server: 10.32.5.135
    path: /83d8ea56/cfs
```

## 📚 API文档

### 集群管理

#### POST /api/cluster/connect
连接到Kubernetes集群

#### GET /api/cluster/status
获取集群连接状态

#### GET /api/cluster/stats
获取集群统计信息

### 环境管理

#### GET /api/environments
列出所有环境

#### POST /api/environments/create
创建新环境

#### DELETE /api/environments/delete
删除环境

#### POST /api/environments/scale
扩缩容环境

#### GET /api/environments/detail
获取环境详情

#### GET /api/environments/status
获取环境状态

#### GET /api/environments/dashboard-url
获取Dashboard访问信息

### 数据管理

#### GET /api/datasets
列出所有数据集

**查询参数**:
- `namespace`: 命名空间
- `dataType`: 数据类型（可选）
- `experimentId`: 实验ID（可选）

#### POST /api/datasets/create
创建新数据集

#### DELETE /api/datasets/delete
删除数据集

#### GET /api/datasets/stats
获取存储统计信息

### 文件管理

#### GET /api/files/list
列出目录文件

**查询参数**:
- `namespace`: 命名空间
- `path`: 目录路径

#### GET /api/files/download
下载文件

**查询参数**:
- `namespace`: 命名空间
- `path`: 文件路径

#### DELETE /api/files/delete
删除文件

#### GET /api/files/preview
预览文件

**查询参数**:
- `namespace`: 命名空间
- `path`: 文件路径
- `type`: 文件类型（text/image/parquet）

### Web终端

#### WebSocket /api/terminal/ws
建立终端连接

**查询参数**:
- `namespace`: 命名空间
- `pod`: Pod名称
- `container`: 容器名称（可选）

## 🐛 故障排查

### 常见问题

#### 1. 认证失败

**错误**: `Authentication failed: exec plugin requires pre-authentication`

**解决方案**:
```bash
kubectl ianvs login <cluster-id> --expired=1h
```

#### 2. API返回404

**原因**: API服务器未重启或路由未注册

**解决方案**:
```bash
pkill -f "api-server"
cd cmd/api-server
go build -o ../../bin/api-server .
cd ../..
nohup ./bin/api-server > backend.log 2>&1 &
```

#### 3. CORS错误

**原因**: 前端端口与CORS配置不匹配

**解决方案**: 已支持5173、5174、5175端口，重新编译后端即可

#### 4. 环境创建失败

**可能原因**:
- KubeRay Operator未安装（Ray环境）
- 资源不足
- 命名空间不存在

**解决方案**:
1. 检查KubeRay Operator状态
2. 查看集群资源
3. 创建所需命名空间

#### 5. 文件预览失败

**可能原因**:
- CFS未正确挂载
- 文件路径不存在
- 文件格式不支持

**解决方案**:
1. 检查PV/PVC状态
2. 验证文件路径
3. 查看后端日志

### 日志查看

```bash
# API服务器日志
tail -f backend.log

# 浏览器控制台
# 打开开发者工具 (F12) -> Console
```

详细的故障排查指南请参考：
- [部署指南](docs/DEPLOYMENT_GUIDE.md)
- [数据管理合并说明](docs/DATA_MANAGEMENT_MERGE.md)

## 📝 开发文档

- [部署指南](docs/DEPLOYMENT_GUIDE.md)
- [数据管理页面合并说明](docs/DATA_MANAGEMENT_MERGE.md)
- [环境详情功能测试指南](docs/ENVIRONMENT_DETAIL_TESTING.md)
- [实施总结](docs/IMPLEMENTATION_SUMMARY.md)

## 🗺️ 路线图

### 已完成 ✅
- [x] 多集群管理与连接
- [x] 环境管理（CRUD操作）
- [x] KubeRay集成
- [x] 环境详情页
- [x] Ray Dashboard连接
- [x] Web终端集成
- [x] 实时状态监控
- [x] Namespace切换
- [x] 资源优化配置
- [x] 数据集管理
- [x] 文件浏览器
- [x] 文件预览（文本/图片/Parquet）
- [x] 存储统计可视化
- [x] CFS Turbo集成

### 进行中 🚧
- [ ] 训练任务管理
- [ ] 监控诊断功能

### 计划中 📋
- [ ] 环境数据挂载
- [ ] Sidecar容器集成
- [ ] 数据版本控制
- [ ] 审计日志
- [ ] 用户权限管理
- [ ] 训练任务调度
- [ ] 模型版本管理
- [ ] 实验跟踪集成（MLflow）
- [ ] 自动扩缩容策略
- [ ] 成本优化建议

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

1. Fork本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 👥 作者

- **Virgil Liang** - *初始工作*

## 🙏 致谢

- [KubeRay](https://github.com/ray-project/kuberay) - Ray on Kubernetes
- [TDesign](https://tdesign.tencent.com/) - 企业级设计体系
- [Kubernetes](https://kubernetes.io/) - 容器编排平台
- [Ray](https://www.ray.io/) - 分布式计算框架
- [xterm.js](https://xtermjs.org/) - 浏览器终端模拟器

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 [Issue](https://github.com/yourusername/RL_on_K8S/issues)

---

**注意**: 本项目仍在积极开发中，API可能会发生变化。建议在生产环境使用前进行充分测试。