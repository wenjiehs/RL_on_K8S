# Kubernetes 集群认证指南

## 📋 概述

本文档说明如何处理不同类型的 Kubernetes 集群认证方式。

---

## 🔐 认证方式

### 1. 标准认证（证书/Token）

**适用场景**: 大多数标准 Kubernetes 集群

**Kubeconfig 示例**:
```yaml
users:
- name: my-user
  user:
    client-certificate-data: <base64-cert>
    client-key-data: <base64-key>
```

**使用方式**: 直接上传 kubeconfig 即可连接

---

### 2. Exec 插件认证 ⚠️

**适用场景**: 企业内部集群（如腾讯云 TKE、阿里云 ACK 等）

**Kubeconfig 示例**:
```yaml
users:
- name: my-user
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: kubectl-ianvs  # 或其他插件
      args:
      - get-token
      - --cluster-id=cls-xxx
```

**问题**: 
- 后端无法直接执行 exec 插件
- 需要在本地环境预先登录

**解决方案**:

#### 方案 1: 本地预登录（推荐）

在上传 kubeconfig 之前，先在本地执行登录命令：

```bash
# 腾讯云 TKE 示例
kubectl ianvs login cls-jrnaysd3 --expired=1h

# 阿里云 ACK 示例  
aliyun cs GET /k8s/clusters/<cluster-id>/user_config

# AWS EKS 示例
aws eks update-kubeconfig --name <cluster-name>
```

登录后，凭证会被缓存，kubeconfig 中的 exec 插件可以正常工作。

#### 方案 2: 转换为 Token 认证

将 exec 认证转换为 token 认证：

```bash
# 1. 获取 token
TOKEN=$(kubectl config view --raw -o jsonpath='{.users[0].user.exec.command}' | xargs -I {} {} get-token)

# 2. 修改 kubeconfig，替换 exec 为 token
kubectl config set-credentials my-user --token=$TOKEN

# 3. 上传修改后的 kubeconfig
```

#### 方案 3: 使用 Service Account Token

创建长期有效的 Service Account：

```bash
# 1. 创建 Service Account
kubectl create serviceaccount rl-console-sa

# 2. 绑定权限
kubectl create clusterrolebinding rl-console-binding \
  --clusterrole=cluster-admin \
  --serviceaccount=default:rl-console-sa

# 3. 获取 Token（Kubernetes 1.24+）
kubectl create token rl-console-sa --duration=8760h

# 4. 创建新的 kubeconfig
kubectl config set-credentials rl-console-sa --token=<token>
kubectl config set-context rl-console --cluster=<cluster> --user=rl-console-sa
```

---

## 🚨 常见错误及解决

### 错误 1: exec plugin failed

**错误信息**:
```
getting credentials: exec: executable kubectl-ianvs failed with exit code 2
```

**原因**: exec 插件未登录或凭证过期

**解决**:
```bash
# 重新登录
kubectl ianvs login <cluster-id> --expired=1h

# 验证连接
kubectl get nodes
```

---

### 错误 2: certificate has expired

**错误信息**:
```
x509: certificate has expired or is not yet valid
```

**原因**: 客户端证书过期

**解决**:
```bash
# 重新获取 kubeconfig
# 腾讯云 TKE
tccli tke DescribeClusterKubeconfig --ClusterId cls-xxx

# 阿里云 ACK
aliyun cs GET /k8s/clusters/<cluster-id>/user_config
```

---

### 错误 3: Unauthorized

**错误信息**:
```
Unauthorized: invalid credentials
```

**原因**: Token 无效或权限不足

**解决**:
1. 检查 RBAC 权限
2. 重新生成 Token
3. 确认 Service Account 绑定正确

---

## 💡 最佳实践

### 1. 开发环境

使用本地 kubectl 配置，确保能正常访问集群后再上传 kubeconfig：

```bash
# 测试连接
kubectl cluster-info
kubectl get nodes

# 确认无误后上传
```

### 2. 生产环境

使用 Service Account Token，避免依赖个人凭证：

```bash
# 创建专用 SA
kubectl create serviceaccount rl-prod-sa -n kube-system

# 绑定最小权限
kubectl create clusterrolebinding rl-prod-binding \
  --clusterrole=view \
  --serviceaccount=kube-system:rl-prod-sa

# 生成长期 Token
kubectl create token rl-prod-sa -n kube-system --duration=87600h
```

### 3. 多集群管理

为每个集群创建独立的 context：

```bash
# 添加集群
kubectl config set-cluster prod-cluster --server=https://api.prod.example.com

# 添加用户
kubectl config set-credentials prod-user --token=<token>

# 创建 context
kubectl config set-context prod --cluster=prod-cluster --user=prod-user

# 切换 context
kubectl config use-context prod
```

---

## 🔧 腾讯云 TKE 专用指南

### 安装 kubectl-ianvs 插件

```bash
# macOS
brew install kubectl-ianvs

# Linux
wget https://ianvs-1251707795.cos.ap-guangzhou.myqcloud.com/kubectl-ianvs/latest/kubectl-ianvs-linux-amd64
chmod +x kubectl-ianvs-linux-amd64
sudo mv kubectl-ianvs-linux-amd64 /usr/local/bin/kubectl-ianvs
```

### 登录集群

```bash
# 登录（1小时有效期）
kubectl ianvs login cls-jrnaysd3 --expired=1h

# 登录（24小时有效期）
kubectl ianvs login cls-jrnaysd3 --expired=24h

# 验证
kubectl get nodes
```

### 获取 Kubeconfig

```bash
# 方式1: 从控制台下载
# TKE 控制台 -> 集群 -> 基本信息 -> 集群凭证

# 方式2: 使用 tccli
tccli tke DescribeClusterKubeconfig --ClusterId cls-jrnaysd3
```

---

## 📚 相关资源

- [Kubernetes 认证文档](https://kubernetes.io/docs/reference/access-authn-authz/authentication/)
- [腾讯云 TKE 文档](https://cloud.tencent.com/document/product/457)
- [kubectl 插件开发](https://kubernetes.io/docs/tasks/extend-kubectl/kubectl-plugins/)

---

**最后更新**: 2025-01-17
**版本**: v0.1.0