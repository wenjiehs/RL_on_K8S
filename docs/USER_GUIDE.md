# RL on K8S 用户指南

本指南将帮助您快速上手使用RL on K8S强化学习云控制台系统。

## 目录

1. [系统概述](#系统概述)
2. [快速开始](#快速开始)
3. [集群管理](#集群管理)
4. [环境管理](#环境管理)
5. [环境详情与监控](#环境详情与监控)
6. [Ray Dashboard使用](#ray-dashboard使用)
7. [常见问题](#常见问题)

## 系统概述

RL on K8S是一个基于Kubernetes的强化学习训练环境管理平台，提供：

- **多集群管理**: 支持连接和管理多个Kubernetes集群
- **环境管理**: 创建和管理Ray、Horovod、DeepSpeed等训练环境
- **实时监控**: 实时查看环境状态和资源使用情况
- **可视化操作**: 通过Web界面完成所有操作，无需命令行

## 快速开始

### 1. 访问系统

打开浏览器访问：`http://localhost:5173/`

### 2. 连接到Kubernetes集群

首次使用需要连接到Kubernetes集群：

1. 点击顶部导航栏的 **"Cluster"** 或 **"集群管理"**
2. 准备kubeconfig文件（通常位于 `~/.kube/config`）
3. 选择以下方式之一上传配置：
   - **上传文件**: 点击"Upload File"按钮，选择kubeconfig文件
   - **粘贴内容**: 将kubeconfig内容粘贴到文本框中
4. 选择要使用的Context（如果有多个）
5. 点击 **"Connect"** 按钮

**认证提示**: 如果使用exec插件认证（如kubectl-ianvs），需要先在终端执行登录命令：
```bash
kubectl ianvs login <cluster-id> --expired=1h
```

### 3. 验证连接

连接成功后，您将看到：
- 绿色的"Connected"状态指示器
- 集群名称和Context信息
- 集群统计信息（Pods数量、Namespaces等）

## 集群管理

### 查看集群信息

在集群管理页面，您可以查看：

- **连接状态**: 当前是否已连接到集群
- **集群名称**: 当前连接的集群名称
- **Context**: 当前使用的Context
- **统计信息**:
  - Total Pods: 集群中所有Pod数量
  - Running Pods: 正在运行的Pod数量
  - Namespaces: 命名空间数量

### 切换集群

如果需要连接到不同的集群：

1. 点击 **"Disconnect"** 断开当前连接
2. 上传新的kubeconfig文件
3. 选择新的Context
4. 点击 **"Connect"** 连接

## 环境管理

### 创建训练环境

1. 点击顶部导航栏的 **"Environments"** 或 **"环境管理"**
2. 点击 **"Create Environment"** 按钮
3. 填写环境配置：

   **基本信息**:
   - **Name**: 环境名称（支持中文，系统会自动转换为合法的Kubernetes名称）
   - **Framework**: 选择训练框架
     - `Ray`: 分布式计算框架（推荐）
     - `Horovod`: 分布式深度学习框架
     - `DeepSpeed`: 微软深度学习优化库
     - `Custom`: 自定义环境

   **配置参数**:
   - **Namespace**: 选择命名空间（默认为default）
   - **Workers**: Worker节点数量（建议1-5个）
   - **Container Image**: 选择或输入镜像地址
     - Ray: `rayproject/ray:2.9.0`（默认）
     - Horovod: `horovod/horovod:latest`
     - DeepSpeed: `deepspeed/deepspeed:latest`
     - Custom: 输入自定义镜像地址

4. 点击 **"Create"** 创建环境
5. 等待环境创建完成（通常需要1-3分钟）

### 查看环境列表

环境列表显示所有已创建的环境，包括：

- **Name**: 环境名称（点击可查看详情）
- **Framework**: 使用的框架
- **Image**: 容器镜像
- **Replicas**: Worker节点数量
- **Status**: 当前状态
  - `Running`: 运行中
  - `Pending`: 创建中
  - `Failed`: 创建失败
- **Namespace**: 所在命名空间
- **Created**: 创建时间
- **Actions**: 操作按钮
  - `Scale`: 扩缩容
  - `Delete`: 删除环境

### 环境扩缩容

调整Worker节点数量：

1. 在环境列表中找到目标环境
2. 点击 **"Scale"** 按钮
3. 在弹出的对话框中输入新的Worker数量
4. 点击 **"Confirm"** 确认
5. 等待扩缩容完成

**注意**: 
- 扩容会创建新的Worker Pod
- 缩容会删除多余的Worker Pod
- 建议根据实际训练需求调整

### 删除环境

删除不再需要的环境：

1. 在环境列表中找到目标环境
2. 点击 **"Delete"** 按钮
3. 在确认对话框中点击 **"Confirm"**
4. 等待删除完成

**警告**: 删除操作不可恢复，请谨慎操作！

### 切换Namespace

查看不同命名空间的环境：

1. 在环境管理页面顶部找到Namespace选择器
2. 点击下拉菜单
3. 选择要查看的命名空间
4. 环境列表会自动刷新

## 环境详情与监控

### 查看环境详情

点击环境列表中的**环境名称**进入详情页，查看完整信息：

#### 1. 基本信息
- **环境名称**: 环境的显示名称
- **环境ID**: 唯一标识符
- **框架类型**: 使用的训练框架
- **运行状态**: 当前状态（每5秒自动刷新）
- **创建时间**: 环境创建的时间戳

#### 2. 配置信息
- **Ray版本**: Ray框架版本（仅Ray环境）
- **Python版本**: Python运行时版本
- **CPU分配**: 每个节点的CPU资源
- **内存分配**: 每个节点的内存资源
- **GPU支持**: 是否启用GPU（如果配置）

#### 3. 节点配置
- **Head节点数量**: 通常为1个
- **Worker节点数量**: 当前Worker数量
- **总节点数**: Head + Worker总数

#### 4. 存储信息
- **持久化存储**: 数据存储路径
- **存储容量**: 分配的存储空间
- **存储类型**: 存储类（StorageClass）

#### 5. 网络信息
- **Head节点IP**: Head节点的集群内部IP
- **Dashboard端口**: Ray Dashboard访问端口（默认8265）
- **服务名称**: Kubernetes Service名称

### 实时状态监控

环境详情页会每5秒自动刷新状态，显示：

- **运行中** (Running): 环境正常运行
- **创建中** (Pending): 环境正在创建
- **失败** (Failed): 环境创建或运行失败
- **未知** (Unknown): 无法获取状态

## Ray Dashboard使用

### 访问Ray Dashboard

对于Ray环境，可以通过Dashboard进行高级管理和监控：

#### 步骤1: 检查环境状态

在环境详情页确认：
- 环境状态为 **"运行中"**
- Dashboard连接区域显示为绿色

#### 步骤2: 建立端口转发

1. 在 **"Ray Dashboard连接"** 区域找到port-forward命令
2. 复制命令（点击复制按钮）
3. 在终端执行命令：
   ```bash
   kubectl port-forward -n <namespace> svc/<env-name>-head-svc 8265:8265
   ```
4. 保持终端窗口打开

#### 步骤3: 访问Dashboard

1. 点击 **"打开Dashboard"** 按钮
2. 新标签页将打开Ray Dashboard
3. 在Dashboard中可以：
   - 查看集群状态
   - 监控任务执行
   - 查看日志
   - 管理Actor和Task

### Dashboard功能说明

Ray Dashboard提供以下功能：

- **Overview**: 集群概览和资源使用情况
- **Jobs**: 查看和管理Ray作业
- **Actors**: 查看Actor状态和资源使用
- **Tasks**: 监控任务执行情况
- **Logs**: 查看集群日志
- **Metrics**: 性能指标和监控图表

### 执行测试任务

在Dashboard中执行简单的测试任务：

1. 打开Ray Dashboard
2. 进入 **"Jobs"** 标签
3. 点击 **"Submit Job"**
4. 输入测试代码：
   ```python
   import ray
   
   @ray.remote
   def hello_world():
       return "Hello from Ray!"
   
   result = ray.get(hello_world.remote())
   print(result)
   ```
5. 点击 **"Submit"** 提交任务
6. 在Jobs列表中查看执行结果

## 常见问题

### Q1: 连接集群时提示认证失败

**问题**: `Authentication failed: exec plugin requires pre-authentication`

**解决方案**: 
```bash
# 先在终端执行登录命令
kubectl ianvs login <cluster-id> --expired=1h

# 然后在Web界面重新连接
```

### Q2: 创建环境时提示KubeRay Operator未安装

**问题**: `failed to create RayCluster: ensure KubeRay operator is installed`

**解决方案**:
```bash
# 安装KubeRay Operator
kubectl create -k "github.com/ray-project/kuberay/ray-operator/config/default?ref=v1.0.0&timeout=90s"

# 验证安装
kubectl get pods -n ray-system
```

### Q3: 环境一直处于Pending状态

**可能原因**:
- 集群资源不足
- 镜像拉取失败
- 节点调度问题

**排查步骤**:
```bash
# 查看Pod状态
kubectl get pods -n <namespace>

# 查看Pod详情
kubectl describe pod <pod-name> -n <namespace>

# 查看Pod日志
kubectl logs <pod-name> -n <namespace>
```

### Q4: 无法访问Ray Dashboard

**检查清单**:
1. 环境状态是否为"运行中"
2. port-forward命令是否正在运行
3. 端口8265是否被占用
4. 浏览器是否阻止了弹出窗口

**解决方案**:
```bash
# 检查端口占用
lsof -i:8265

# 手动建立端口转发
kubectl port-forward -n <namespace> svc/<env-name>-head-svc 8265:8265

# 手动访问
open http://localhost:8265
```

### Q5: 环境删除失败

**可能原因**:
- 资源正在被使用
- 权限不足
- 网络问题

**解决方案**:
```bash
# 强制删除（谨慎使用）
kubectl delete raycluster <env-name> -n <namespace> --force --grace-period=0

# 或删除整个命名空间（如果环境独占命名空间）
kubectl delete namespace <namespace>
```

### Q6: 前端显示CORS错误

**问题**: 浏览器控制台显示CORS相关错误

**解决方案**:
1. 确认后端API服务器正在运行
2. 检查后端CORS配置
3. 重启后端服务：
   ```bash
   pkill -f "/tmp/api-server"
   cd cmd/api-server
   go build -o /tmp/api-server .
   nohup /tmp/api-server > /tmp/api-server.log 2>&1 &
   ```

### Q7: 环境名称不合法

**问题**: `metadata.name: Invalid value`

**说明**: 系统会自动将名称转换为合法的Kubernetes名称：
- 转换为小写
- 空格替换为连字符
- 移除特殊字符

**建议**: 使用小写字母、数字和连字符命名环境

## 最佳实践

### 1. 资源规划

- **开发环境**: 1-2个Worker，每个1-2Gi内存
- **测试环境**: 2-3个Worker，每个2-4Gi内存
- **生产环境**: 根据实际需求配置，建议预留20%资源余量

### 2. 命名规范

- 使用有意义的名称，如 `rl-training-prod`
- 包含环境类型，如 `dev-`, `test-`, `prod-`
- 避免使用特殊字符和空格

### 3. 监控建议

- 定期检查环境状态
- 监控资源使用情况
- 及时清理不用的环境

### 4. 安全建议

- 使用RBAC控制访问权限
- 定期更新镜像版本
- 不要在环境中存储敏感信息

## 获取帮助

如需更多帮助，请参考：

- [快速测试指南](QUICK_TEST_GUIDE.md)
- [故障排查指南](ENVIRONMENT_DETAIL_TROUBLESHOOTING.md)
- [实施总结](IMPLEMENTATION_SUMMARY.md)
- [认证指南](AUTHENTICATION_GUIDE.md)

或提交Issue到GitHub仓库。