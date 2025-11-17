# 后端 API 能力总结

## 📋 概述

本文档总结了 RL on K8S 项目后端当前已实现的所有 API 能力。

---

## 🔌 集群管理 API

### 1. 连接集群
**端点**: `POST /api/cluster/connect`

**功能**: 连接到 Kubernetes 集群

**请求参数**:
```json
{
  "kubeConfig": "base64编码的kubeconfig内容",
  "apiServer": "API Server URL（可选，用于覆盖）",
  "context": "要使用的context名称（可选，默认使用current-context）"
}
```

**响应**:
```json
{
  "connected": true,
  "message": "Successfully connected to cluster 'cluster-name'",
  "clusterName": "cluster-name",
  "context": "context-name"
}
```

**特性**:
- 支持 Base64 编码的 kubeconfig 文件
- 支持多 Context 选择
- 支持 API Server URL 覆盖
- 自动 TLS 验证（无 CA 时跳过）
- 15秒连接超时
- 连接测试（通过列出 pods 验证）

---

### 2. 查询集群状态
**端点**: `GET /api/cluster/status`

**功能**: 获取当前集群连接状态

**响应**:
```json
{
  "connected": true,
  "message": "Connected",
  "clusterName": "cluster-name",
  "context": "context-name"
}
```

---

### 3. 获取集群统计信息
**端点**: `GET /api/cluster/stats`

**功能**: 获取集群资源统计

**响应**:
```json
{
  "totalPods": 100,
  "runningPods": 85,
  "namespaces": 10
}
```

---

### 4. 解析 Kubeconfig
**端点**: `POST /api/cluster/parse-kubeconfig`

**功能**: 解析 kubeconfig 文件，提取可用的 contexts

**请求参数**:
```json
{
  "kubeConfig": "base64编码的kubeconfig内容"
}
```

**响应**:
```json
{
  "contexts": [
    {
      "name": "context-1",
      "cluster": "cluster-1",
      "user": "user-1"
    },
    {
      "name": "context-2",
      "cluster": "cluster-2",
      "user": "user-2"
    }
  ],
  "currentContext": "context-1"
}
```

---

## 🚀 环境管理 API

### 5. 列出环境
**端点**: `GET /api/environments?namespace=default`

**功能**: 列出指定命名空间中的所有 RL 训练环境

**查询参数**:
- `namespace`: 命名空间（默认: default）

**响应**:
```json
[
  {
    "id": "uuid",
    "name": "my-ray-env",
    "framework": "ray",
    "image": "rayproject/ray:2.9.0",
    "replicas": 3,
    "status": "running",
    "namespace": "default",
    "labels": {
      "rl-env": "true",
      "rl-framework": "ray"
    },
    "createdAt": "2025-01-17T10:00:00Z",
    "updatedAt": "2025-01-17T10:00:00Z"
  }
]
```

**支持的环境类型**:
- **Ray**: 通过 KubeRay Operator 管理的 RayCluster
- **Horovod/DeepSpeed/Custom**: 通过标准 Kubernetes Deployment 管理

**状态值**:
- `pending`: 正在创建/启动中
- `running`: 运行中
- `stopped`: 已停止
- `error`: 错误状态

---

### 6. 创建环境
**端点**: `POST /api/environments/create`

**功能**: 创建新的 RL 训练环境

**请求参数**:
```json
{
  "name": "my-training-env",
  "framework": "ray",
  "image": "rayproject/ray:2.9.0",
  "replicas": 3,
  "namespace": "default",
  "labels": {
    "team": "ml-team"
  }
}
```

**响应**:
```json
{
  "id": "uuid",
  "name": "my-training-env",
  "framework": "ray",
  "image": "rayproject/ray:2.9.0",
  "replicas": 3,
  "status": "pending",
  "namespace": "default",
  "labels": {
    "rl-env": "true",
    "rl-framework": "ray",
    "team": "ml-team"
  },
  "createdAt": "2025-01-17T10:00:00Z",
  "updatedAt": "2025-01-17T10:00:00Z"
}
```

**特性**:
- **自动名称规范化**: 将名称转换为 Kubernetes 兼容格式
  - 转换为小写
  - 空格和下划线替换为连字符
  - 移除非法字符
  - 确保以字母数字开头
  - 最大长度 253 字符
- **预定义镜像**: 支持框架默认镜像
  - Ray: `rayproject/ray:2.9.0`
  - Horovod: `horovod/horovod:latest`
  - DeepSpeed: `deepspeed/deepspeed:latest`
- **KubeRay 集成**: Ray 环境自动创建 RayCluster CRD
- **资源优化**: 针对资源受限集群优化的资源配置
  - Head 节点: 100m CPU, 256Mi 内存（请求）/ 500m CPU, 512Mi 内存（限制）
  - Worker 节点: 100m CPU, 256Mi 内存（请求）/ 500m CPU, 512Mi 内存（限制）

**Ray 环境特殊配置**:
- 自动配置 Dashboard (端口 8265)
- GCS 服务 (端口 6379)
- Client 端口 (端口 10001)
- 支持自动扩缩容 (minReplicas=0, maxReplicas=replicas*2)

---

### 7. 删除环境
**端点**: `DELETE /api/environments/delete?name=env-name&namespace=default&framework=ray`

**功能**: 删除指定的 RL 训练环境

**查询参数**:
- `name`: 环境名称（必需）
- `namespace`: 命名空间（默认: default）
- `framework`: 框架类型（用于确定删除 RayCluster 还是 Deployment）

**响应**:
```json
{
  "message": "Environment env-name deleted successfully"
}
```

**特性**:
- Ray 环境: 删除 RayCluster CRD
- 其他环境: 删除 Deployment
- 自动清理相关资源

---

### 8. 扩缩容环境
**端点**: `POST /api/environments/scale?name=env-name&namespace=default`

**功能**: 调整环境的副本数

**查询参数**:
- `name`: 环境名称（必需）
- `namespace`: 命名空间（默认: default）

**请求参数**:
```json
{
  "replicas": 5
}
```

**响应**:
```json
{
  "message": "Environment env-name scaled to 5 replicas",
  "replicas": 5
}
```

**特性**:
- 支持扩容和缩容
- 最小副本数: 0
- 实时更新 Deployment

---

## 📊 CRD 定义（未来扩展）

### RLEnvironment CRD
**API 版本**: `rl.k8s.io/v1alpha1`

**用途**: 自定义资源定义，用于声明式管理 RL 训练环境

**规格**:
```yaml
apiVersion: rl.k8s.io/v1alpha1
kind: RLEnvironment
metadata:
  name: my-env
spec:
  image: rayproject/ray:2.9.0
  replicas: 3
  hpaSpec:
    minReplicas: 1
    maxReplicas: 10
    targetCPUUtilizationPercentage: 80
```

**状态**: 已定义类型，Controller 待实现

---

### RLTrainingJob CRD
**API 版本**: `rl.k8s.io/v1alpha1`

**用途**: 管理 RL 训练任务的生命周期

**规格**:
```yaml
apiVersion: rl.k8s.io/v1alpha1
kind: RLTrainingJob
metadata:
  name: my-training-job
spec:
  environmentRef: my-env
  framework: Ray
  offlineDataPath: cos://bucket/data
  realtimeDataTopic: kafka-topic
  checkpointSpec:
    path: cos://bucket/checkpoints
    intervalSeconds: 300
  alertingSpec:
    webhook:
      url: https://webhook.example.com
```

**状态**: 已定义类型，Controller 待实现

---

## 🔧 技术栈

### 后端技术
- **语言**: Go 1.21+
- **框架**: 标准库 net/http
- **Kubernetes 客户端**: 
  - `client-go`: 标准 Kubernetes API 交互
  - `dynamic client`: CRD 动态资源管理
- **CORS**: `github.com/rs/cors`

### Kubernetes 集成
- **API 版本**: v1.28+
- **CRD 支持**: 
  - KubeRay v1.0.0 (ray.io/v1)
  - 自定义 CRD (rl.k8s.io/v1alpha1)
- **资源管理**:
  - Deployment (标准工作负载)
  - RayCluster (分布式 Ray 集群)
  - Service (网络服务)
  - HPA (水平自动扩缩容，待实现)

---

## 🎯 已实现功能总结

### ✅ 集群管理
- [x] 多集群连接支持
- [x] 多 Context 切换
- [x] Kubeconfig 解析
- [x] 集群状态监控
- [x] 资源统计

### ✅ 环境管理
- [x] 环境 CRUD 操作
- [x] 多框架支持 (Ray/Horovod/DeepSpeed/Custom)
- [x] KubeRay 集成
- [x] 名称自动规范化
- [x] 资源优化配置
- [x] 环境扩缩容

### 🔄 待实现功能
- [ ] 训练任务管理 (RLTrainingJob)
- [ ] 监控诊断
- [ ] 数据管理 (COS/Kafka 集成)
- [ ] HPA 自动扩缩容
- [ ] Checkpoint 管理
- [ ] 告警集成

---

## 📝 API 设计原则

1. **RESTful 风格**: 遵循 REST API 设计规范
2. **错误处理**: 统一的错误响应格式
3. **CORS 支持**: 允许前端跨域访问
4. **超时控制**: 15秒请求超时
5. **日志记录**: 详细的操作日志
6. **资源优化**: 适配资源受限的云环境

---

## 🔐 安全考虑

- TLS 证书验证（可配置跳过）
- Kubeconfig Base64 编码传输
- 命名空间隔离
- RBAC 权限控制（依赖 Kubernetes）

---

## 📚 相关文档

- [KubeRay 安装指南](./KUBERAY_SETUP.md)
- [项目 README](../README.md)

---

**最后更新**: 2025-01-17
**版本**: v0.1.0