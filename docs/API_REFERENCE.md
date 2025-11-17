# API参考文档

本文档详细描述了RL on K8S后端API的所有端点、请求格式和响应格式。

## 基础信息

- **Base URL**: `http://localhost:8080`
- **Content-Type**: `application/json`
- **CORS**: 支持 `localhost:5173`, `localhost:5174`, `localhost:5175`

## 目录

1. [集群管理API](#集群管理api)
2. [环境管理API](#环境管理api)
3. [错误处理](#错误处理)
4. [数据模型](#数据模型)

## 集群管理API

### 1. 连接到集群

连接到Kubernetes集群并初始化客户端。

**端点**: `POST /api/cluster/connect`

**请求体**:
```json
{
  "kubeConfig": "YXBpVmVyc2lvbjogdjEKY2x1c3RlcnM6Ci0gY2x1c3Rlcjo...",
  "context": "my-cluster-context"
}
```

**参数说明**:
- `kubeConfig` (string, required): Base64编码的kubeconfig文件内容
- `context` (string, required): 要使用的context名称

**成功响应** (200 OK):
```json
{
  "connected": true,
  "message": "Successfully connected to cluster",
  "clusterName": "my-cluster",
  "context": "my-cluster-context"
}
```

**错误响应** (400 Bad Request):
```json
{
  "error": "Invalid kubeconfig format"
}
```

**错误响应** (500 Internal Server Error):
```json
{
  "error": "Failed to connect to cluster: connection timeout"
}
```

### 2. 获取集群状态

获取当前集群连接状态。

**端点**: `GET /api/cluster/status`

**请求参数**: 无

**成功响应** (200 OK):
```json
{
  "connected": true,
  "message": "Connected",
  "clusterName": "my-cluster",
  "context": "my-cluster-context"
}
```

**未连接响应** (200 OK):
```json
{
  "connected": false,
  "message": "Not connected to any cluster"
}
```

### 3. 获取集群统计信息

获取集群的统计信息，包括Pod数量、命名空间等。

**端点**: `GET /api/cluster/stats`

**请求参数**: 无

**成功响应** (200 OK):
```json
{
  "totalPods": 150,
  "runningPods": 142,
  "namespaces": 12
}
```

**错误响应** (500 Internal Server Error):
```json
{
  "error": "Failed to get cluster stats: not connected"
}
```

### 4. 获取命名空间列表

获取集群中所有可用的命名空间。

**端点**: `GET /api/cluster/namespaces`

**请求参数**: 无

**成功响应** (200 OK):
```json
{
  "namespaces": [
    "default",
    "kube-system",
    "kube-public",
    "my-namespace"
  ]
}
```

**错误响应** (500 Internal Server Error):
```json
{
  "error": "Failed to list namespaces"
}
```

## 环境管理API

### 1. 列出环境

获取指定命名空间中的所有训练环境。

**端点**: `GET /api/environments`

**查询参数**:
- `namespace` (string, optional): 命名空间名称，默认为所有命名空间

**请求示例**:
```
GET /api/environments?namespace=default
```

**成功响应** (200 OK):
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "my-ray-cluster",
    "framework": "ray",
    "image": "rayproject/ray:2.9.0",
    "replicas": 2,
    "status": "running",
    "namespace": "default",
    "createdAt": "2025-11-17T10:30:00Z"
  },
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "horovod-training",
    "framework": "horovod",
    "image": "horovod/horovod:latest",
    "replicas": 3,
    "status": "pending",
    "namespace": "default",
    "createdAt": "2025-11-17T11:00:00Z"
  }
]
```

**错误响应** (500 Internal Server Error):
```json
{
  "error": "Failed to list environments"
}
```

### 2. 创建环境

创建新的训练环境。

**端点**: `POST /api/environments/create`

**请求体**:
```json
{
  "name": "my-ray-cluster",
  "framework": "ray",
  "image": "rayproject/ray:2.9.0",
  "replicas": 2,
  "namespace": "default"
}
```

**参数说明**:
- `name` (string, required): 环境名称（会自动规范化）
- `framework` (string, required): 框架类型 (`ray`, `horovod`, `deepspeed`, `custom`)
- `image` (string, required): 容器镜像地址
- `replicas` (int, required): Worker节点数量
- `namespace` (string, required): 命名空间

**成功响应** (200 OK):
```json
{
  "message": "Environment created successfully",
  "name": "my-ray-cluster",
  "namespace": "default"
}
```

**错误响应** (400 Bad Request):
```json
{
  "error": "Invalid request: name is required"
}
```

**错误响应** (500 Internal Server Error):
```json
{
  "error": "Failed to create environment: insufficient resources"
}
```

### 3. 删除环境

删除指定的训练环境。

**端点**: `DELETE /api/environments/delete`

**查询参数**:
- `name` (string, required): 环境名称
- `namespace` (string, required): 命名空间
- `framework` (string, required): 框架类型

**请求示例**:
```
DELETE /api/environments/delete?name=my-ray-cluster&namespace=default&framework=ray
```

**成功响应** (200 OK):
```json
{
  "message": "Environment deleted successfully"
}
```

**错误响应** (400 Bad Request):
```json
{
  "error": "Missing required parameters"
}
```

**错误响应** (404 Not Found):
```json
{
  "error": "Environment not found"
}
```

### 4. 扩缩容环境

调整环境的Worker节点数量。

**端点**: `POST /api/environments/scale`

**查询参数**:
- `name` (string, required): 环境名称
- `namespace` (string, required): 命名空间
- `framework` (string, required): 框架类型

**请求体**:
```json
{
  "replicas": 5
}
```

**参数说明**:
- `replicas` (int, required): 新的Worker节点数量

**请求示例**:
```
POST /api/environments/scale?name=my-ray-cluster&namespace=default&framework=ray
Content-Type: application/json

{
  "replicas": 5
}
```

**成功响应** (200 OK):
```json
{
  "message": "Environment scaled successfully",
  "replicas": 5
}
```

**错误响应** (400 Bad Request):
```json
{
  "error": "Invalid replicas count"
}
```

### 5. 获取环境详情

获取环境的详细配置信息。

**端点**: `GET /api/environments/detail`

**查询参数**:
- `name` (string, required): 环境名称
- `namespace` (string, required): 命名空间
- `framework` (string, required): 框架类型

**请求示例**:
```
GET /api/environments/detail?name=my-ray-cluster&namespace=default&framework=ray
```

**成功响应** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "my-ray-cluster",
  "type": "ray",
  "status": "running",
  "rayVersion": "2.9.0",
  "pythonVersion": "3.9",
  "resources": {
    "cpu": "1000m",
    "memory": "4Gi",
    "gpu": "0"
  },
  "storage": {
    "path": "/mnt/cluster_storage",
    "capacity": "10Gi",
    "storageClass": "standard"
  },
  "network": {
    "headNodeIP": "10.244.1.5",
    "dashboardPort": "8265",
    "serviceName": "my-ray-cluster-head-svc"
  },
  "nodes": {
    "headNodes": 1,
    "workerNodes": 2,
    "totalNodes": 3
  },
  "createdAt": "2025-11-17T10:30:00Z"
}
```

**错误响应** (404 Not Found):
```json
{
  "error": "Environment not found"
}
```

### 6. 获取环境状态

获取环境的实时运行状态。

**端点**: `GET /api/environments/status`

**查询参数**:
- `name` (string, required): 环境名称
- `namespace` (string, required): 命名空间
- `framework` (string, required): 框架类型

**请求示例**:
```
GET /api/environments/status?name=my-ray-cluster&namespace=default&framework=ray
```

**成功响应** (200 OK):
```json
{
  "status": "running"
}
```

**可能的状态值**:
- `running`: 运行中
- `pending`: 创建中
- `failed`: 失败
- `unknown`: 未知

**错误响应** (404 Not Found):
```json
{
  "error": "Environment not found"
}
```

### 7. 获取Dashboard访问信息

获取Ray Dashboard的访问URL和连接信息。

**端点**: `GET /api/environments/dashboard-url`

**查询参数**:
- `name` (string, required): 环境名称
- `namespace` (string, required): 命名空间

**请求示例**:
```
GET /api/environments/dashboard-url?name=my-ray-cluster&namespace=default
```

**成功响应** (200 OK):
```json
{
  "available": true,
  "url": "http://10.244.1.5:8265",
  "message": "Dashboard is available. Use port-forward to access: kubectl port-forward -n default svc/my-ray-cluster-head-svc 8265:8265"
}
```

**Dashboard不可用响应** (200 OK):
```json
{
  "available": false,
  "message": "Dashboard is not available. Environment may not be running."
}
```

**错误响应** (404 Not Found):
```json
{
  "error": "Environment not found"
}
```

## 错误处理

### 错误响应格式

所有错误响应都遵循以下格式：

```json
{
  "error": "错误描述信息"
}
```

### HTTP状态码

- `200 OK`: 请求成功
- `400 Bad Request`: 请求参数错误
- `404 Not Found`: 资源不存在
- `500 Internal Server Error`: 服务器内部错误

### 常见错误

#### 1. 未连接到集群
```json
{
  "error": "Not connected to cluster"
}
```

**解决方案**: 先调用 `/api/cluster/connect` 连接到集群

#### 2. 参数缺失
```json
{
  "error": "Missing required parameters: name, namespace"
}
```

**解决方案**: 检查请求参数是否完整

#### 3. 资源不存在
```json
{
  "error": "Environment not found"
}
```

**解决方案**: 确认环境名称、命名空间和框架类型正确

#### 4. 认证失败
```json
{
  "error": "Authentication failed: exec plugin requires pre-authentication"
}
```

**解决方案**: 执行 `kubectl ianvs login <cluster-id> --expired=1h`

## 数据模型

### Environment (环境)

```typescript
interface Environment {
  id: string;              // 唯一标识符
  name: string;            // 环境名称
  framework: string;       // 框架类型
  image: string;           // 容器镜像
  replicas: number;        // Worker数量
  status: string;          // 运行状态
  namespace: string;       // 命名空间
  createdAt: string;       // 创建时间 (ISO 8601)
}
```

### EnvironmentDetail (环境详情)

```typescript
interface EnvironmentDetail {
  id: string;
  name: string;
  type: string;
  status: string;
  rayVersion: string;
  pythonVersion: string;
  resources: ResourceConfig;
  storage: StorageConfig;
  network: NetworkConfig;
  nodes: NodeConfig;
  createdAt: string;
}

interface ResourceConfig {
  cpu: string;             // CPU配额 (如 "1000m")
  memory: string;          // 内存配额 (如 "4Gi")
  gpu: string;             // GPU数量
}

interface StorageConfig {
  path: string;            // 存储路径
  capacity: string;        // 存储容量
  storageClass: string;    // 存储类
}

interface NetworkConfig {
  headNodeIP: string;      // Head节点IP
  dashboardPort: string;   // Dashboard端口
  serviceName: string;     // Service名称
}

interface NodeConfig {
  headNodes: number;       // Head节点数量
  workerNodes: number;     // Worker节点数量
  totalNodes: number;      // 总节点数
}
```

### ClusterStats (集群统计)

```typescript
interface ClusterStats {
  totalPods: number;       // 总Pod数量
  runningPods: number;     // 运行中的Pod数量
  namespaces: number;      // 命名空间数量
}
```

### ClusterStatus (集群状态)

```typescript
interface ClusterStatus {
  connected: boolean;      // 是否已连接
  message: string;         // 状态消息
  clusterName?: string;    // 集群名称
  context?: string;        // Context名称
}
```

## 使用示例

### 示例1: 完整的环境创建流程

```bash
# 1. 连接到集群
curl -X POST http://localhost:8080/api/cluster/connect \
  -H "Content-Type: application/json" \
  -d '{
    "kubeConfig": "YXBpVmVyc2lvbjogdjEK...",
    "context": "my-cluster"
  }'

# 2. 获取命名空间列表
curl http://localhost:8080/api/cluster/namespaces

# 3. 创建环境
curl -X POST http://localhost:8080/api/environments/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-ray-cluster",
    "framework": "ray",
    "image": "rayproject/ray:2.9.0",
    "replicas": 2,
    "namespace": "default"
  }'

# 4. 查看环境列表
curl http://localhost:8080/api/environments?namespace=default

# 5. 获取环境详情
curl "http://localhost:8080/api/environments/detail?name=my-ray-cluster&namespace=default&framework=ray"
```

### 示例2: 环境扩缩容

```bash
# 扩容到5个Worker
curl -X POST "http://localhost:8080/api/environments/scale?name=my-ray-cluster&namespace=default&framework=ray" \
  -H "Content-Type: application/json" \
  -d '{
    "replicas": 5
  }'

# 检查状态
curl "http://localhost:8080/api/environments/status?name=my-ray-cluster&namespace=default&framework=ray"
```

### 示例3: 获取Dashboard信息

```bash
# 获取Dashboard URL
curl "http://localhost:8080/api/environments/dashboard-url?name=my-ray-cluster&namespace=default"

# 建立端口转发（在终端执行）
kubectl port-forward -n default svc/my-ray-cluster-head-svc 8265:8265

# 访问Dashboard
open http://localhost:8265
```

## 版本历史

- **v1.0.0** (2025-11-17): 初始版本
  - 集群管理API
  - 环境管理API
  - 环境详情API
  - Dashboard访问API

## 相关文档

- [用户指南](USER_GUIDE.md)
- [快速测试指南](QUICK_TEST_GUIDE.md)
- [故障排查指南](ENVIRONMENT_DETAIL_TROUBLESHOOTING.md)