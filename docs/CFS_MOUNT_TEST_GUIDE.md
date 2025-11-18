# CFS存储卷挂载测试指南

## 🎯 测试目标

验证Ray环境的CFS存储卷挂载功能，确保：
1. ✅ createRayCluster函数正确配置CFS存储卷
2. ✅ 前端CreateEnvironmentDialog显示存储状态
3. ✅ Ray环境创建时自动挂载CFS存储
4. ✅ 容器内可以正常访问CFS文件系统

## 📋 测试前准备

### 服务状态检查
```bash
# 检查API服务器
curl -s "http://localhost:8080/api/storage/status?namespace=default"

# 检查前端服务
lsof -ti:5173,5174,5175 2>/dev/null
```

### 集群连接
确保已连接到Kubernetes集群：
```bash
export KUBECONFIG="$HOME/Downloads/cls-jrnaysd3-config"
kubectl get nodes
```

## 🧪 测试步骤

### 步骤1：验证前端存储状态显示

1. **打开浏览器访问**：http://localhost:5175/
2. **进入环境管理页面**：点击 "Environments"
3. **创建新环境**：点击 "Create Environment" 按钮
4. **检查存储状态显示**：
   - 应该看到绿色的 "CFS Storage Ready" 提示
   - 或黄色的 "CFS Storage Not Initialized" 提示
   - 存储配置详情面板应显示：
     - Mount Path: `/mnt/cfs`
     - Data Path: `/mnt/cfs/rl-data`
     - Storage Class: `cfs-turbo-sc`
     - Access Mode: `ReadWriteMany`

### 步骤2：创建Ray环境测试CFS挂载

1. **填写环境信息**：
   - Name: `cfs-mount-test-$(date +%s)`
   - Framework: `Ray`
   - Namespace: `default`
   - 其他配置保持默认

2. **提交创建**：
   - 如果存储未初始化，确保勾选 "Automatically initialize storage"
   - 点击 "Create" 按钮

3. **等待环境就绪**：
   - 在环境列表中等待状态变为 "Ready"
   - 大约需要30-60秒

### 步骤3：验证CFS挂载

1. **打开Web终端**：
   - 在环境行点击 "Terminal" 按钮
   - 等待终端连接建立

2. **执行验证命令**：

```bash
# 1. 检查CFS挂载点
ls -la /mnt/cfs

# 2. 检查rl-data目录
ls -la /mnt/cfs/rl-data

# 3. 测试写入权限
mkdir -p /mnt/cfs/rl-data/test-$(date +%Y%m%d)
echo "CFS mount test successful at $(date)" > /mnt/cfs/rl-data/test-$(date +%Y%m%d)/verify.txt

# 4. 验证文件内容
cat /mnt/cfs/rl-data/test-$(date +%Y%m%d)/verify.txt

# 5. 检查磁盘空间
df -h /mnt/cfs

# 6. 查看挂载信息
mount | grep cfs
```

### 步骤4：验证多节点访问

1. **检查worker节点**：
```bash
# 在head节点查看worker pod名称
kubectl get pods -n default -l ray.io/cluster=<your-cluster-name>

# 登录到worker pod
kubectl exec -it <worker-pod-name> -n default -- bash

# 在worker中验证CFS访问
ls -la /mnt/cfs/rl-data
cat /mnt/cfs/rl-data/test-*/verify.txt
```

## 📊 预期结果

### 成功指标
- ✅ 前端显示正确的CFS存储状态
- ✅ Ray环境创建成功
- ✅ `/mnt/cfs` 目录存在且可访问
- ✅ `/mnt/cfs/rl-data` 目录存在
- ✅ 可以创建目录和文件
- ✅ 文件内容可以正常读取
- ✅ `df -h` 显示CFS存储容量（约10TB）
- ✅ `mount` 命令显示NFS/CFS挂载信息
- ✅ head和worker节点都能访问相同的CFS文件系统

### 故障排除

#### 权限问题
如果遇到 `Permission denied`：
```bash
# 检查用户权限
id
ls -la /mnt/cfs

# 修复权限（如果需要）
sudo chown -R 1000:100 /mnt/cfs/rl-data
sudo chmod -R 755 /mnt/cfs/rl-data
```

#### 挂载问题
如果 `/mnt/cfs` 不存在：
```bash
# 检查PVC状态
kubectl get pvc -n default

# 检查PV状态
kubectl get pv

# 检查Pod挂载
kubectl describe pod <pod-name> -n default
```

#### API问题
如果前端无法获取存储状态：
```bash
# 检查API服务器日志
tail -f api-server-new.log

# 手动测试API
curl -s "http://localhost:8080/api/storage/status?namespace=default" | jq .
```

## 🔧 技术实现细节

### 后端配置
- **createRayCluster函数**：已添加完整的CFS存储卷配置
- **SecurityContext**：设置fsGroup=100, runAsUser=1000, runAsGroup=100
- **InitContainer**：使用busybox修复CFS权限
- **VolumeMounts**：head和worker都挂载CFS存储卷
- **Volumes**：使用PVC `ray-storage-pvc`

### 前端配置
- **存储状态检测**：自动获取CFS存储状态
- **可视化指示器**：根据PVC状态显示不同颜色的Alert
- **存储配置详情**：显示挂载路径、存储类等信息
- **自动初始化**：支持自动创建PVC和初始化存储

### 存储配置
```yaml
# CFS存储配置
Mount Path: /mnt/cfs
Data Path: /mnt/cfs/rl-data
Storage Class: cfs-turbo-sc
PVC Name: ray-storage-pvc
Access Mode: ReadWriteMany
```

## 📝 测试报告

请将测试结果记录在此：

### 测试环境
- 日期：____
- 集群：____
- 前端版本：____
- 后端版本：____

### 测试结果
- [ ] 前端存储状态显示正常
- [ ] Ray环境创建成功
- [ ] CFS挂载点可访问
- [ ] 文件读写权限正常
- [ ] 多节点访问一致
- [ ] 存储容量显示正确

### 问题描述
（记录任何遇到的问题和解决方案）

---

**测试完成后，请将结果反馈给开发团队。**