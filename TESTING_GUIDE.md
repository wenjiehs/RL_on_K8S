# 🧪 CFS Storage Integration Testing Guide

## 快速开始

### 前端访问地址
**http://localhost:5175**

（注意：端口可能是5173、5174或5175，取决于哪个端口可用）

### 后端API地址
**http://localhost:8080**

## 测试步骤

### 1. 启动后端服务器
```bash
cd /Users/virgilliang/codebuddy/RL_on_K8S
./bin/api-server
```

应该看到：
```
Server starting on :8080
Connected to Kubernetes cluster
```

### 2. 访问前端
打开浏览器访问：**http://localhost:5175**

### 3. 测试存储集成功能

#### 步骤 1：打开创建环境对话框
1. 点击左侧导航栏的 "Environments"
2. 点击右上角的 "Create Environment" 按钮

#### 步骤 2：观察存储状态
对话框顶部应该显示存储状态：

**如果存储已就绪：**
```
✅ CFS Storage Ready - 100Gi available at /cfs
```

**如果存储未初始化：**
```
⚠️ CFS Storage Not Initialized

Storage will be automatically initialized when you create the environment.

☑ Automatically initialize storage when creating environment
```

#### 步骤 3：查看存储配置详情
选择 Framework 为 "Ray" 后，应该看到存储配置面板：

```
📦 Storage Configuration:
• Mount Path: /cfs
• Data Path: /cfs/rl-data
• Storage Class: cfs-turbo-sc
• Access Mode: ReadWriteMany
```

#### 步骤 4：创建Ray环境测试
1. 填写环境信息：
   - Name: `test-storage-integration`
   - Framework: `Ray`
   - Image: 保持默认 `rayproject/ray:latest`
   - Replicas: `1`
   - Namespace: `default`

2. 如果存储未初始化，确保 "Automatically initialize storage" 已勾选

3. 点击 "Create" 按钮

4. 应该看到：
   - 如果需要初始化：显示 "Initializing storage..." 消息
   - 然后显示 "Environment created successfully"

#### 步骤 5：验证CFS挂载
```bash
# 等待Ray集群就绪
kubectl get raycluster -n default

# 获取Ray head pod
kubectl get pods -n default -l ray.io/node-type=head

# 检查CFS挂载
kubectl exec -it <ray-head-pod-name> -n default -- df -h /cfs

# 应该看到：
# 10.32.5.135@tcp:/83d8ea56/cfs  35.0T  26.1T  8.9T  74% /cfs

# 测试读写
kubectl exec -it <ray-head-pod-name> -n default -- sh -c "
  echo 'Test from Ray' > /cfs/rl-data/test.txt && 
  cat /cfs/rl-data/test.txt
"
```

## 常见问题排查

### 问题1：前端页面打不开
**解决方案：**
1. 检查端口占用：`lsof -i :5173 -i :5174 -i :5175`
2. 查看正在运行的端口号
3. 访问正确的端口

### 问题2：存储状态显示"Failed to fetch"
**解决方案：**
1. 确认后端API服务器正在运行：`curl http://localhost:8080/api/contexts`
2. 检查CORS配置
3. 查看浏览器控制台错误信息

### 问题3：PVC创建失败
**解决方案：**
1. 检查StorageClass是否存在：
   ```bash
   kubectl get storageclass cfs-turbo-sc
   ```
2. 如果不存在，创建它：
   ```bash
   kubectl apply -f scripts/cfs-production.yaml
   ```

### 问题4：Ray Pod无法访问/cfs
**解决方案：**
1. 检查PVC状态：
   ```bash
   kubectl get pvc rl-data-storage -n default
   ```
2. 检查Pod的volume配置：
   ```bash
   kubectl describe pod <ray-pod> -n default | grep -A 10 Volumes
   ```

## 自动化测试脚本

运行完整的自动化测试：
```bash
./scripts/quick-test-storage.sh
```

这个脚本会：
- ✅ 检查API服务器健康状态
- ✅ 测试存储状态API
- ✅ 测试存储配置API
- ✅ 验证StorageClass存在
- ✅ 检查PVC状态
- ✅ 可选：初始化存储
- ✅ 检查现有Ray环境

## API测试

### 测试存储状态API
```bash
curl http://localhost:8080/api/storage/status?namespace=default | jq .
```

### 测试存储配置API
```bash
curl http://localhost:8080/api/storage/config | jq .
```

### 测试存储初始化API
```bash
curl -X POST http://localhost:8080/api/storage/initialize \
  -H "Content-Type: application/json" \
  -d '{"namespace": "default"}' | jq .
```

## 成功标准

测试通过的标准：
- ✅ 前端页面正常加载
- ✅ 创建环境对话框正常打开
- ✅ 存储状态正确显示
- ✅ 存储配置详情正确显示
- ✅ 自动初始化功能正常工作
- ✅ Ray环境成功创建
- ✅ CFS存储成功挂载到/cfs
- ✅ Ray Pod可以读写/cfs/rl-data
- ✅ 浏览器控制台无错误
- ✅ API服务器日志无错误

## 详细文档

- [完整实现文档](docs/CFS_FRONTEND_INTEGRATION_COMPLETE.md)
- [详细测试指南](docs/STORAGE_INTEGRATION_TEST.md)
- [后端集成文档](docs/CFS_BACKEND_INTEGRATION.md)

---

**当前状态：** ✅ 所有功能已实现，可以开始测试
**前端地址：** http://localhost:5175
**后端地址：** http://localhost:8080