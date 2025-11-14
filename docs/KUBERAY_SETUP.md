# KubeRay 集成说明

## 概述

本系统默认使用 **KubeRay Operator** 来管理 Ray 环境，提供更强大的功能：

- ✅ 自动扩缩容（Autoscaling）
- ✅ 故障自动恢复
- ✅ 资源优化管理
- ✅ 原生 Ray Dashboard 支持
- ✅ 分布式训练支持

## 前置要求

### 1. 安装 KubeRay Operator

在您的 Kubernetes 集群中安装 KubeRay Operator：

```bash
# 方法 1: 使用 Helm (推荐)
helm repo add kuberay https://ray-project.github.io/kuberay-helm/
helm repo update
helm install kuberay-operator kuberay/kuberay-operator --version 1.0.0

# 方法 2: 使用 kubectl
kubectl create -k "github.com/ray-project/kuberay/ray-operator/config/default?ref=v1.0.0&timeout=90s"
```

### 2. 验证安装

```bash
# 检查 Operator 是否运行
kubectl get pods -n kuberay-system

# 应该看到类似输出：
# NAME                                READY   STATUS    RESTARTS   AGE
# kuberay-operator-7b8c9d5f6b-xxxxx   1/1     Running   0          1m
```

### 3. 验证 CRD

```bash
# 检查 RayCluster CRD 是否已安装
kubectl get crd rayclusters.ray.io

# 应该看到：
# NAME                    CREATED AT
# rayclusters.ray.io      2024-01-01T00:00:00Z
```

## 使用方式

### 通过 Web UI 创建 Ray 环境

1. 登录控制台
2. 连接到 Kubernetes 集群
3. 进入 "Environments" 页面
4. 点击 "Create Environment"
5. 选择 Framework: **Ray**
6. 配置参数：
   - **Name**: 环境名称（如 `my-ray-cluster`）
   - **Container Image**: Ray 镜像（默认 `rayproject/ray:2.9.0`）
   - **Initial Replicas**: Worker 节点数量
   - **Namespace**: Kubernetes 命名空间

### 创建的资源

当您创建 Ray 环境时，系统会自动创建：

1. **RayCluster** 自定义资源
   - 1 个 Head 节点（固定）
   - N 个 Worker 节点（可扩缩容）

2. **Services**
   - Ray Dashboard (端口 8265)
   - Ray Client (端口 10001)
   - Ray GCS (端口 6379)

3. **Pods**
   - `<name>-head-xxxxx`: Head 节点
   - `<name>-worker-xxxxx`: Worker 节点

### 访问 Ray Dashboard

```bash
# 端口转发到本地
kubectl port-forward -n <namespace> service/<cluster-name>-head-svc 8265:8265

# 在浏览器中访问
open http://localhost:8265
```

## 资源配置

### Head 节点默认配置

```yaml
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 1
    memory: 1Gi
```

### Worker 节点默认配置

```yaml
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 1
    memory: 1Gi
```

### 自定义资源配置

未来版本将支持通过 UI 自定义资源配置。

## 扩缩容

### 通过 UI 扩缩容

1. 在环境列表中找到目标环境
2. 点击 "Scale" 按钮
3. 输入新的 Worker 数量
4. 确认更改

### 通过 kubectl 扩缩容

```bash
# 查看当前配置
kubectl get raycluster <cluster-name> -n <namespace> -o yaml

# 编辑配置
kubectl edit raycluster <cluster-name> -n <namespace>

# 修改 spec.workerGroupSpecs[0].replicas 的值
```

## 故障排查

### 1. RayCluster 创建失败

**错误信息**: `failed to create RayCluster: ... (ensure KubeRay operator is installed in the cluster)`

**解决方案**:
```bash
# 检查 Operator 是否运行
kubectl get pods -n kuberay-system

# 如果没有运行，重新安装
helm install kuberay-operator kuberay/kuberay-operator
```

### 2. Pod 无法启动

**检查步骤**:
```bash
# 查看 Pod 状态
kubectl get pods -n <namespace> | grep <cluster-name>

# 查看 Pod 日志
kubectl logs -n <namespace> <pod-name>

# 查看 Pod 事件
kubectl describe pod -n <namespace> <pod-name>
```

### 3. 查看 Operator 日志

```bash
kubectl logs -n kuberay-system deployment/kuberay-operator
```

## 其他框架

对于非 Ray 框架（Horovod、DeepSpeed、Custom），系统会创建标准的 Kubernetes Deployment，不依赖 KubeRay Operator。

## 参考资料

- [KubeRay 官方文档](https://docs.ray.io/en/latest/cluster/kubernetes/index.html)
- [KubeRay GitHub](https://github.com/ray-project/kuberay)
- [Ray 官方文档](https://docs.ray.io/)