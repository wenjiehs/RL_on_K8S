# RL on K8S - 强化学习云控制台系统

基于Kubernetes的强化学习训练环境管理平台，提供可视化的集群管理、环境配置和训练任务监控功能。

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
- ✅ 实时状态监控（自动刷新）
- ✅ Namespace切换支持
- ✅ 名称自动规范化
- ✅ 资源优化配置（适配资源受限集群）

### 用户体验
- ✅ 现代化UI设计（基于TDesign）
- ✅ 响应式布局
- ✅ 友好的错误提示
- ✅ 实时状态更新

## 🏗️ 技术架构

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **UI组件库**: TDesign React
- **路由**: React Router v6
- **图表**: Recharts
- **图标**: TDesign Icons + Lucide React

### 后端
- **语言**: Go 1.21+
- **框架**: 标准库 net/http
- **K8s客户端**: client-go + dynamic client
- **CORS**: rs/cors

### Kubernetes
- **版本**: v1.28+
- **CRD**: KubeRay Operator v1.5.0-rc.0
- **资源**: RayCluster、Deployment、Service

## 📦 项目结构

```
RL_on_K8S/
├── cmd/
│   └── api-server/          # API服务器入口
│       ├── main.go          # 主程序和路由
│       └── environment.go   # 环境管理逻辑
├── frontend/
│   ├── src/
│   │   ├── components/      # React组件
│   │   │   ├── ClusterConfigDialog.tsx
│   │   │   └── CreateEnvironmentDialog.tsx
│   │   └── pages/           # 页面组件
│   │       ├── Cluster.tsx
│   │       ├── Dashboard.tsx
│   │       ├── Environments.tsx
│   │       └── EnvironmentDetail.tsx
│   ├── package.json
│   └── vite.config.ts
├── docs/                    # 文档目录
│   ├── ENVIRONMENT_DETAIL_TESTING.md
│   ├── ENVIRONMENT_DETAIL_TROUBLESHOOTING.md
│   ├── IMPLEMENTATION_SUMMARY.md
│   └── QUICK_TEST_GUIDE.md
├── scripts/                 # 脚本目录
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

### 安装KubeRay Operator（可选）

如果需要使用Ray环境，请先安装KubeRay Operator：

```bash
# 安装KubeRay Operator
kubectl create -k "github.com/ray-project/kuberay/ray-operator/config/default?ref=v1.0.0&timeout=90s"

# 验证安装
kubectl get pods -n ray-system
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
go build -o /tmp/api-server .

# 4. 启动服务器
nohup /tmp/api-server > /tmp/api-server.log 2>&1 &

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

### 4. 连接Ray Dashboard

对于Ray环境，可以通过以下步骤连接Dashboard：

1. 在环境详情页找到 "Ray Dashboard连接" 区域
2. 确保环境状态为 "运行中"
3. 复制显示的port-forward命令
4. 在终端执行命令：
   ```bash
   kubectl port-forward -n <namespace> svc/<env-name>-head-svc 8265:8265
   ```
5. 点击 "打开Dashboard" 按钮
6. 在新标签页中访问Ray Dashboard

### 5. 环境管理操作

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
- **日志**: /tmp/api-server.log

可通过环境变量修改：
```bash
export PORT=8080
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

## 📚 API文档

### 集群管理

#### POST /api/cluster/connect
连接到Kubernetes集群

**请求体**:
```json
{
  "kubeConfig": "base64编码的kubeconfig内容",
  "context": "要使用的context名称"
}
```

**响应**:
```json
{
  "connected": true,
  "message": "Successfully connected to cluster",
  "clusterName": "cluster-name",
  "context": "context-name"
}
```

#### GET /api/cluster/status
获取集群连接状态

**响应**:
```json
{
  "connected": true,
  "message": "Connected",
  "clusterName": "cluster-name",
  "context": "context-name"
}
```

#### GET /api/cluster/stats
获取集群统计信息

**响应**:
```json
{
  "totalPods": 100,
  "runningPods": 95,
  "namespaces": 10
}
```

### 环境管理

#### GET /api/environments
列出所有环境

**查询参数**:
- `namespace`: 命名空间（可选，默认为所有）

**响应**:
```json
[
  {
    "id": "uuid",
    "name": "env-name",
    "framework": "ray",
    "image": "rayproject/ray:2.9.0",
    "replicas": 2,
    "status": "running",
    "namespace": "default",
    "createdAt": "2025-11-17T10:00:00Z"
  }
]
```

#### POST /api/environments/create
创建新环境

**请求体**:
```json
{
  "name": "my-env",
  "framework": "ray",
  "image": "rayproject/ray:2.9.0",
  "replicas": 2,
  "namespace": "default"
}
```

#### DELETE /api/environments/delete
删除环境

**查询参数**:
- `name`: 环境名称
- `namespace`: 命名空间
- `framework`: 框架类型

#### POST /api/environments/scale
扩缩容环境

**查询参数**:
- `name`: 环境名称
- `namespace`: 命名空间
- `framework`: 框架类型

**请求体**:
```json
{
  "replicas": 3
}
```

#### GET /api/environments/detail
获取环境详情

**查询参数**:
- `name`: 环境名称
- `namespace`: 命名空间
- `framework`: 框架类型

**响应**:
```json
{
  "id": "uuid",
  "name": "env-name",
  "framework": "ray",
  "status": "running",
  "rayVersion": "2.9.0",
  "pythonVersion": "3.9",
  "resources": {
    "cpu": "1000m",
    "memory": "4Gi"
  },
  "network": {
    "headNodeIP": "10.x.x.x",
    "dashboardPort": "8265"
  }
}
```

#### GET /api/environments/status
获取环境状态

**查询参数**:
- `name`: 环境名称
- `namespace`: 命名空间
- `framework`: 框架类型

**响应**:
```json
{
  "status": "running"
}
```

#### GET /api/environments/dashboard-url
获取Dashboard访问信息

**查询参数**:
- `name`: 环境名称
- `namespace`: 命名空间

**响应**:
```json
{
  "available": true,
  "url": "http://cluster-ip:8265",
  "message": "Dashboard is available"
}
```

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
pkill -f "/tmp/api-server"
cd cmd/api-server
go build -o /tmp/api-server .
nohup /tmp/api-server > /tmp/api-server.log 2>&1 &
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

### 日志查看

```bash
# API服务器日志
tail -f /tmp/api-server.log

# 浏览器控制台
# 打开开发者工具 (F12) -> Console
```

详细的故障排查指南请参考：
- [环境详情功能故障排查](docs/ENVIRONMENT_DETAIL_TROUBLESHOOTING.md)
- [快速测试指南](docs/QUICK_TEST_GUIDE.md)

## 📝 开发文档

- [环境详情功能测试指南](docs/ENVIRONMENT_DETAIL_TESTING.md)
- [实施总结](docs/IMPLEMENTATION_SUMMARY.md)
- [快速测试指南](docs/QUICK_TEST_GUIDE.md)
- [故障排查指南](docs/ENVIRONMENT_DETAIL_TROUBLESHOOTING.md)

## 🗺️ 路线图

### 已完成 ✅
- [x] 多集群管理与连接
- [x] 环境管理（CRUD操作）
- [x] KubeRay集成
- [x] 环境详情页
- [x] Ray Dashboard连接
- [x] 实时状态监控
- [x] Namespace切换
- [x] 资源优化配置

### 进行中 🚧
- [ ] 训练任务管理
- [ ] 监控诊断功能
- [ ] 数据管理

### 计划中 📋
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

- **Virgil Liang** - *初始工作* - [GitHub](https://github.com/yourusername)

## 🙏 致谢

- [KubeRay](https://github.com/ray-project/kuberay) - Ray on Kubernetes
- [TDesign](https://tdesign.tencent.com/) - 企业级设计体系
- [Kubernetes](https://kubernetes.io/) - 容器编排平台
- [Ray](https://www.ray.io/) - 分布式计算框架

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 [Issue](https://github.com/yourusername/RL_on_K8S/issues)
- 发送邮件至: your.email@example.com

---

**注意**: 本项目仍在积极开发中，API可能会发生变化。建议在生产环境使用前进行充分测试。