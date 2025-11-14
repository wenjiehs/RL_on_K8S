# RL on K8S - 强化学习云控制台系统

基于 Kubernetes 的强化学习云控制台系统，支持 Ray、Horovod、DeepSpeed 等主流 RL 框架。

## 🚀 快速开始

### 1. 前置要求

- Kubernetes 集群 (v1.28+)
- kubectl 已配置并连接到集群
- Go 1.21+ (用于后端开发)
- Node.js 18+ (用于前端开发)

### 2. 安装 KubeRay Operator

**重要**: Ray 环境需要 KubeRay Operator 支持。

```bash
# 使用提供的安装脚本
./scripts/install-kuberay.sh

# 或手动安装
kubectl create namespace kuberay-system
kubectl apply -f https://raw.githubusercontent.com/ray-project/kuberay/v1.0.0/ray-operator/config/crd/bases/ray.io_rayclusters.yaml
kubectl apply -f https://raw.githubusercontent.com/ray-project/kuberay/v1.0.0/ray-operator/config/default/operator.yaml -n kuberay-system
```

验证安装：
```bash
kubectl get crd rayclusters.ray.io
kubectl get pods -n kuberay-system
```

### 3. 启动后端服务

```bash
cd cmd/api-server
go mod tidy
go run *.go
```

后端服务将在 `http://localhost:8080` 启动。

### 4. 启动前端服务

```bash
cd frontend
npm install
npm run dev
```

前端服务将在 `http://localhost:5173` 启动。

### 5. 访问控制台

打开浏览器访问 `http://localhost:5173`

## 📚 功能模块

### 1. 集群管理
- ✅ 支持多集群连接
- ✅ Kubeconfig 文件上传
- ✅ 多 Context 选择
- ✅ 实时集群状态监控

### 2. 环境管理
- ✅ Ray 环境（基于 KubeRay）
  - 自动创建 Head + Worker 节点
  - 支持动态扩缩容
  - Ray Dashboard 访问
- ✅ Horovod 环境
- ✅ DeepSpeed 环境
- ✅ 自定义镜像环境

### 3. 训练管理
- 🚧 分布式训练任务
- 🚧 训练监控
- 🚧 Checkpoint 管理

### 4. 数据管理
- 🚧 数据集管理
- 🚧 版本控制
- 🚧 数据增强

### 5. 监控诊断
- 🚧 Prometheus 集成
- 🚧 Grafana 仪表板
- 🚧 智能告警

## 🎯 使用示例

### 创建 Ray 环境

1. 连接到 Kubernetes 集群
2. 进入 "Environments" 页面
3. 点击 "Create Environment"
4. 配置参数：
   - **Name**: `my-ray-cluster`
   - **Framework**: `Ray`
   - **Container Image**: `rayproject/ray:2.9.0`
   - **Initial Replicas**: `2` (Worker 数量)
   - **Namespace**: `default`
5. 点击 "Create Environment"

### 访问 Ray Dashboard

```bash
# 端口转发
kubectl port-forward -n default service/my-ray-cluster-head-svc 8265:8265

# 浏览器访问
open http://localhost:8265
```

### 扩缩容环境

1. 在环境列表中找到目标环境
2. 点击 "Scale" 按钮
3. 输入新的 Worker 数量
4. 确认更改

## 🏗️ 项目结构

```
RL_on_K8S/
├── cmd/
│   └── api-server/          # 后端 API 服务
│       ├── main.go          # 主程序
│       ├── environment.go   # 环境管理
│       └── parse_kubeconfig.go  # Kubeconfig 解析
├── frontend/                # 前端应用
│   ├── src/
│   │   ├── components/      # React 组件
│   │   ├── pages/           # 页面
│   │   └── App.tsx          # 主应用
│   └── package.json
├── scripts/                 # 工具脚本
│   └── install-kuberay.sh   # KubeRay 安装脚本
├── docs/                    # 文档
│   └── KUBERAY_SETUP.md     # KubeRay 设置指南
└── README.md
```

## 🔧 技术栈

### 后端
- **语言**: Go 1.21+
- **框架**: net/http
- **Kubernetes**: client-go v0.28+
- **CORS**: rs/cors

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **UI 库**: TDesign React
- **图标**: TDesign Icons React
- **样式**: Tailwind CSS

### Kubernetes
- **版本**: v1.28+
- **CRD**: KubeRay v1.0.0
- **资源**: Deployment, Service, RayCluster

## 📖 文档

- [KubeRay 设置指南](docs/KUBERAY_SETUP.md)
- [API 文档](docs/API.md) (待完善)
- [开发指南](docs/DEVELOPMENT.md) (待完善)

## 🐛 故障排查

### 1. KubeRay Operator 未安装

**错误**: `failed to create RayCluster: ... (ensure KubeRay operator is installed)`

**解决**: 运行安装脚本
```bash
./scripts/install-kuberay.sh
```

### 2. 环境名称不合法

**错误**: `metadata.name: Invalid value: "test ray": a lowercase RFC 1123 subdomain...`

**解决**: 系统会自动转换名称，如果仍有问题，请使用小写字母、数字和连字符

### 3. 后端连接失败

**检查**:
```bash
# 查看后端日志
tail -f /tmp/api-server.log

# 检查端口占用
lsof -i:8080
```

### 4. 前端无法连接后端

**检查**:
- 后端是否在 8080 端口运行
- CORS 配置是否正确
- 浏览器控制台是否有错误

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🔗 相关链接

- [KubeRay 官方文档](https://docs.ray.io/en/latest/cluster/kubernetes/index.html)
- [Ray 官方文档](https://docs.ray.io/)
- [Kubernetes 官方文档](https://kubernetes.io/docs/)
- [TDesign React](https://tdesign.tencent.com/react/overview)