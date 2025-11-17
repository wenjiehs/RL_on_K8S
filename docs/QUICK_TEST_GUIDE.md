# 环境详情功能快速测试指南

## 问题说明

当前遇到的认证错误：
```
Authentication failed: The kubeconfig uses an exec plugin that requires pre-authentication.
```

这是因为您的kubeconfig使用了`kubectl-ianvs`插件进行认证，需要先登录。

## 解决方案

### 方案1：使用kubectl-ianvs登录（推荐）

```bash
# 先登录到集群
kubectl ianvs login <cluster-id> --expired=1h

# 然后再通过前端连接
```

### 方案2：使用其他可用的集群

如果您有其他不需要exec插件的kubeconfig（如GKE、EKS等），可以使用那些集群进行测试。

### 方案3：本地测试集群

使用minikube或kind创建本地测试集群：

```bash
# 使用minikube
minikube start
minikube kubectl -- get pods -A

# 获取kubeconfig
kubectl config view --raw > /tmp/test-kubeconfig.yaml
```

## 完整测试流程

### 1. 准备集群连接

**选择以下任一方式**：

#### A. 使用kubectl-ianvs登录
```bash
# 登录到您的集群
kubectl ianvs login cls-jrnaysd3 --expired=1h

# 验证连接
kubectl get pods -A
```

#### B. 使用本地minikube
```bash
# 启动minikube
minikube start

# 安装KubeRay Operator
kubectl create -k "github.com/ray-project/kuberay/ray-operator/config/default?ref=v1.0.0&timeout=90s"

# 等待operator就绪
kubectl wait --for=condition=available --timeout=300s deployment/kuberay-operator -n ray-system
```

### 2. 启动服务

```bash
# 确保API服务器运行
ps aux | grep "/tmp/api-server" | grep -v grep

# 如果没有运行，启动它
cd /Users/virgilliang/codebuddy/RL_on_K8S/cmd/api-server
go build -o /tmp/api-server .
nohup /tmp/api-server > /tmp/api-server.log 2>&1 &

# 确保前端运行
# 访问 http://localhost:5175/
```

### 3. 连接到集群

1. 打开浏览器访问 `http://localhost:5175/`
2. 点击顶部导航栏的 "Cluster"
3. 上传kubeconfig文件（确保已经通过kubectl-ianvs登录）
4. 选择正确的context
5. 点击 "Connect"
6. 等待连接成功提示

### 4. 创建测试环境

**通过前端UI创建**：
1. 点击 "Environments"
2. 点击 "Create Environment"
3. 填写信息：
   - Name: test-env
   - Framework: Ray
   - Namespace: default
   - Workers: 1
4. 点击 "Create"

**或通过kubectl创建**：
```bash
# 创建namespace
kubectl create namespace ray-test

# 等待环境创建完成
kubectl get rayclusters -n default
```

### 5. 访问环境详情

1. 在环境列表中找到刚创建的环境
2. **点击环境的名称**（不是操作按钮）
3. 应该会跳转到详情页面，显示：
   - 基本信息（名称、框架、状态等）
   - 配置信息（Ray版本、Python版本、资源分配）
   - 节点配置（Head节点、Worker节点）
   - 存储信息
   - 网络信息
   - Ray Dashboard连接区域

### 6. 测试Dashboard连接

在详情页面：
1. 找到 "Ray Dashboard连接" 区域
2. 如果集群状态为"运行中"，会显示port-forward命令
3. 复制命令到终端执行：
   ```bash
   kubectl port-forward -n default svc/test-env-head-svc 8265:8265
   ```
4. 点击 "打开Dashboard" 按钮
5. 应该会在新标签页打开Ray Dashboard

## 验证功能

### 检查点1：环境详情页面加载
- [ ] 页面正常加载，无错误
- [ ] 显示环境基本信息
- [ ] 显示资源配置
- [ ] 显示网络信息

### 检查点2：实时状态更新
- [ ] 状态标签正确显示（运行中/待定/错误）
- [ ] 每5秒自动刷新状态
- [ ] 刷新按钮可用

### 检查点3：Dashboard连接
- [ ] 显示Dashboard连接区域（仅Ray环境）
- [ ] 显示port-forward命令
- [ ] 一键复制功能可用
- [ ] Dashboard链接可点击

### 检查点4：导航功能
- [ ] 返回按钮可用
- [ ] 面包屑导航正确

## 故障排查

### 问题1：认证失败

**错误信息**：
```
Authentication failed: exec plugin requires pre-authentication
```

**解决方案**：
```bash
kubectl ianvs login <cluster-id> --expired=1h
```

### 问题2：API返回404

**原因**：API服务器未重启或路由未注册

**解决方案**：
```bash
# 重新编译和启动
pkill -f "/tmp/api-server"
cd /Users/virgilliang/codebuddy/RL_on_K8S/cmd/api-server
go build -o /tmp/api-server .
nohup /tmp/api-server > /tmp/api-server.log 2>&1 &
```

### 问题3：CORS错误

**错误信息**：浏览器控制台显示CORS相关错误

**解决方案**：已修复，确保使用最新编译的API服务器

### 问题4：环境不存在

**错误信息**：
```
Environment not found
```

**解决方案**：
1. 确认环境确实存在：`kubectl get rayclusters -A`
2. 确认namespace正确
3. 确认framework参数正确

## 测试数据

### 示例环境信息

创建一个测试环境后，详情页应该显示类似以下信息：

```
基本信息：
- 名称：test-env
- 框架：Ray
- 命名空间：default
- 状态：运行中
- 创建时间：2025-11-17 15:00:00
- 镜像：rayproject/ray:2.9.0

配置信息：
- Ray版本：2.9.0
- Python版本：3.9
- CPU：1000m
- 内存：4Gi
- GPU：无

节点配置：
- Head节点：1
- Worker节点：1

存储信息：
- 持久化存储路径：/tmp/ray
- 容量：10Gi

网络信息：
- Head节点IP：10.x.x.x
- Dashboard端口：8265
- Client端口：10001
```

## API测试命令

连接到集群后，可以直接测试API：

```bash
# 测试环境详情
curl "http://localhost:8080/api/environments/detail?name=test-env&namespace=default&framework=ray" | jq

# 测试环境状态
curl "http://localhost:8080/api/environments/status?name=test-env&namespace=default&framework=ray" | jq

# 测试Dashboard URL
curl "http://localhost:8080/api/environments/dashboard-url?name=test-env&namespace=default" | jq
```

## 预期输出

### 环境详情API响应示例

```json
{
  "id": "abc123...",
  "name": "test-env",
  "framework": "ray",
  "image": "rayproject/ray:2.9.0",
  "replicas": 1,
  "status": "running",
  "namespace": "default",
  "createdAt": "2025-11-17T15:00:00Z",
  "rayVersion": "2.9.0",
  "pythonVersion": "3.9",
  "resources": {
    "cpu": "1000m",
    "memory": "4Gi",
    "gpu": "",
    "gpuType": ""
  },
  "storage": {
    "persistentVolumePath": "/tmp/ray",
    "size": "10Gi"
  },
  "network": {
    "headNodeIP": "10.x.x.x",
    "dashboardPort": "8265",
    "clientPort": "10001"
  },
  "nodes": {
    "head": 1,
    "workers": 1
  }
}
```

## 下一步

测试成功后，可以继续开发：
1. 训练管理功能
2. 监控诊断功能
3. 数据管理功能

## 需要帮助？

如果遇到问题，请提供：
1. 浏览器控制台完整错误信息（F12 -> Console）
2. 网络请求详情（F12 -> Network）
3. API服务器日志：`tail -50 /tmp/api-server.log`
4. kubectl命令输出