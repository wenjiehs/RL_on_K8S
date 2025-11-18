# 安装和使用指南

## 🚀 快速开始

### 环境要求
- Go 1.19+
- Node.js 16+
- Kubernetes 集群 (腾讯云TKE推荐)
- kubectl 配置正确

### 1. 克隆项目
```bash
git clone https://github.com/wenjiehs/RL_on_K8S.git
cd RL_on_K8S
```

### 2. 后端启动
```bash
# 编译后端
go build -o bin/api-server cmd/api-server/*.go

# 启动后端服务
./bin/api-server > api-server.log 2>&1 &
```

### 3. 前端启动
```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 4. 访问应用
- 前端界面: http://localhost:5173
- 后端API: http://localhost:8080

## 📋 功能使用指南

### 1. 集群连接
1. 打开前端界面
2. 点击"连接集群"
3. 上传kubeconfig文件或输入集群信息
4. 确认连接状态

### 2. 环境管理
1. 进入"环境管理"页面
2. 点击"创建环境"
3. 填写环境信息：
   - 环境名称
   - 框架选择 (Ray/Horovod/DeepSpeed)
   - Docker镜像
   - 副本数量
   - 命名空间
4. 点击"创建环境"

### 3. 存储管理
系统会自动初始化CFS存储：
- 挂载路径: `/mnt/cfs`
- 数据路径: `/mnt/cfs/rl-data`
- 存储类: `cfs-turbo-sc`

## 🔧 故障排除

### 常见问题

#### 1. 环境一直处于Pending状态
**原因**: 缺少必需的PVC `ray-storage-pvc`
**解决方案**:
```bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ray-storage-pvc
  namespace: default
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: cfs-turbo-sc
  resources:
    requests:
      storage: 10Gi
EOF
```

#### 2. 前端无法访问
**解决方案**:
```bash
# 检查端口占用
lsof -i :5173

# 重启前端服务
pkill -f "npm run dev"
cd frontend && npm run dev
```

#### 3. 后端API无响应
**解决方案**:
```bash
# 检查后端进程
ps aux | grep api-server

# 重启后端服务
pkill -f api-server
./bin/api-server > api-server.log 2>&1 &
```

#### 4. 集群连接失败
**检查项目**:
- kubeconfig文件是否正确
- 集群是否可访问
- 权限是否足够

### 日志查看
```bash
# 后端日志
tail -f api-server.log

# 前端日志
cd frontend && tail -f vite*.log

# Kubernetes事件
kubectl get events --sort-by=.metadata.creationTimestamp
```

## 📊 监控和调试

### 检查环境状态
```bash
# 查看RayCluster状态
kubectl get rayclusters

# 查看Pod状态
kubectl get pods -l rl-env=true

# 查看PVC状态
kubectl get pvc
```

### 访问Ray Dashboard
```bash
# 端口转发
kubectl port-forward service/<environment-name>-head-svc 8265:8265

# 访问Dashboard
http://localhost:8265
```

## 🔄 更新和维护

### 更新代码
```bash
git pull origin main
```

### 重新部署
```bash
# 停止服务
pkill -f "api-server"
pkill -f "npm run dev"

# 重新编译和启动
go build -o bin/api-server cmd/api-server/*.go
./bin/api-server > api-server.log 2>&1 &

cd frontend && npm run dev
```

## 📞 技术支持

如果遇到问题，请：
1. 查看日志文件
2. 检查集群状态
3. 参考故障排除指南
4. 提交Issue到GitHub仓库

## 📝 开发说明

### 项目结构
```
RL_on_K8S/
├── cmd/api-server/          # 后端API服务
├── frontend/                # 前端React应用
├── docs/                   # 文档
├── scripts/                # 脚本文件
├── deployments/            # Kubernetes部署文件
└── README.md              # 项目说明
```

### 技术栈
- **后端**: Go + Kubernetes Client
- **前端**: React + TDesign
- **存储**: SQLite + CFS Turbo
- **容器**: Docker + Kubernetes