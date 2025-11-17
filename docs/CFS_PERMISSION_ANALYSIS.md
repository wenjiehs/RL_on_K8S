# CFS权限问题深度分析

## 可能的原因分析

### 1. UID/GID不匹配（最常见）
**症状:** `Permission denied`
**原因:** 
- Ray容器以非root用户运行（通常UID 1000）
- CFS目录所有者是root（UID 0）或其他用户
- NFS默认使用客户端的UID/GID进行权限检查

**验证方法:**
```bash
# 在Pod中查看当前用户
id
# 输出示例: uid=1000(ray) gid=1000(ray) groups=1000(ray)

# 查看/cfs目录权限
ls -ld /cfs
# 输出示例: drwxr-xr-x 2 root root 4096 Nov 17 14:00 /cfs
```

**解决方案:**
- 方案A: 设置Pod SecurityContext (FSGroup: 1000)
- 方案B: 修改CFS目录所有者为1000:1000
- 方案C: 修改目录权限为777（不推荐，安全风险）

---

### 2. NFS挂载选项问题
**症状:** `Permission denied` 或 `Operation not permitted`
**原因:**
- NFS挂载时使用了限制性选项（如`root_squash`）
- 缺少必要的挂载选项（如`no_root_squash`）
- 挂载选项与CFS服务端配置不匹配

**验证方法:**
```bash
# 查看实际挂载选项
mount | grep cfs
# 输出示例: 10.32.5.135:/83d8ea56/cfs on /cfs type nfs4 (rw,relatime,vers=4.0,...)
```

**关键挂载选项说明:**
- `root_squash`: 将root用户映射为nobody（默认，导致权限问题）
- `no_root_squash`: 保留root权限（需要服务端支持）
- `all_squash`: 将所有用户映射为nobody
- `anonuid=1000,anongid=1000`: 匿名用户映射到指定UID/GID

**解决方案:**
修改PV的mountOptions:
```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: cfs-rl-data-pv
spec:
  mountOptions:
    - vers=4.0
    - noresvport
    - nolock
    - no_root_squash  # 添加此选项
```

---

### 3. SELinux/AppArmor限制
**症状:** `Permission denied` 即使权限看起来正确
**原因:**
- Kubernetes节点启用了SELinux或AppArmor
- 容器的安全上下文限制了文件系统访问
- NFS挂载点没有正确的SELinux标签

**验证方法:**
```bash
# 检查节点SELinux状态
kubectl get nodes -o jsonpath='{.items[*].status.nodeInfo.osImage}'

# 在Pod中检查
getenforce  # 如果返回Enforcing则SELinux已启用
```

**解决方案:**
```yaml
# 在Pod SecurityContext中添加
securityContext:
  seLinuxOptions:
    level: "s0:c123,c456"
```

---

### 4. CFS Turbo特定限制
**症状:** 特定操作被拒绝
**原因:**
- 腾讯云CFS Turbo有特定的权限模型
- CSI驱动版本与CFS服务端不兼容
- CFS实例的访问控制列表（ACL）限制

**验证方法:**
```bash
# 检查CSI驱动版本
kubectl get csidriver com.tencent.cloud.csi.cfsturbo -o yaml

# 检查StorageClass配置
kubectl get sc cfs-turbo-sc -o yaml
```

**可能的限制:**
- CFS Turbo可能不支持`chown`操作
- 某些目录操作需要特定权限
- 文件系统级别的配额限制

**解决方案:**
- 使用InitContainer在挂载后立即设置权限
- 联系腾讯云支持调整CFS实例配置
- 使用SubPath挂载特定子目录

---

### 5. PVC/PV配置问题
**症状:** 挂载成功但无法访问
**原因:**
- PVC的accessModes配置错误
- PV的volumeMode不正确
- CSI驱动参数配置问题

**验证方法:**
```bash
# 检查PVC状态
kubectl get pvc cfs-rl-data-pvc -o yaml

# 检查PV绑定
kubectl get pv -o wide | grep cfs
```

**常见配置错误:**
```yaml
# 错误示例
accessModes:
  - ReadWriteOnce  # 应该是ReadWriteMany

volumeMode: Block  # 应该是Filesystem
```

**解决方案:**
确保PVC配置正确:
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: cfs-rl-data-pvc
spec:
  accessModes:
    - ReadWriteMany  # 必须是RWX
  volumeMode: Filesystem  # 必须是Filesystem
  storageClassName: cfs-turbo-sc
  resources:
    requests:
      storage: 10Ti
```

---

### 6. 目录不存在或路径错误
**症状:** `No such file or directory` 或 `Permission denied`
**原因:**
- CFS服务端的实际路径与配置不匹配
- 子目录未创建
- 挂载点路径配置错误

**验证方法:**
```bash
# 检查挂载点
df -h | grep cfs

# 尝试访问根目录
ls -la /

# 检查挂载是否成功
mount | grep cfs
```

**解决方案:**
- 确认CFS服务端路径: `/83d8ea56/cfs`
- 使用SubPath挂载子目录
- 创建必要的目录结构

---

### 7. 网络策略限制
**症状:** 间歇性访问失败
**原因:**
- Kubernetes NetworkPolicy阻止了NFS流量
- 防火墙规则限制了NFS端口（2049）
- CFS服务端的安全组配置

**验证方法:**
```bash
# 测试网络连通性
kubectl exec -it virgil-ray-test4-head-jkf4g -- nc -zv 10.32.5.135 2049

# 检查NetworkPolicy
kubectl get networkpolicy -n default
```

**解决方案:**
- 调整NetworkPolicy允许NFS流量
- 确保安全组开放端口2049
- 检查VPC路由配置

---

## 诊断流程

### 步骤1: 收集基础信息
```bash
# 1. 查看Pod用户信息
kubectl exec -it <pod-name> -- id

# 2. 查看目录权限
kubectl exec -it <pod-name> -- ls -ld /cfs

# 3. 查看挂载信息
kubectl exec -it <pod-name> -- mount | grep cfs

# 4. 查看PVC状态
kubectl get pvc cfs-rl-data-pvc -o yaml

# 5. 查看PV配置
kubectl get pv -o yaml | grep -A 30 cfs
```

### 步骤2: 测试权限
```bash
# 1. 测试读权限
kubectl exec -it <pod-name> -- ls /cfs

# 2. 测试写权限
kubectl exec -it <pod-name> -- touch /cfs/test.txt

# 3. 测试目录创建
kubectl exec -it <pod-name> -- mkdir /cfs/testdir

# 4. 以root用户测试（如果可能）
kubectl exec -it <pod-name> -- sudo ls /cfs
```

### 步骤3: 分析错误信息
```bash
# 查看Pod日志
kubectl logs <pod-name> -n default

# 查看事件
kubectl get events -n default --sort-by='.lastTimestamp'

# 查看CSI驱动日志
kubectl logs -n kube-system -l app=csi-cfsturbo
```

---

## 快速修复方案对比

| 方案 | 难度 | 安全性 | 持久性 | 推荐度 |
|------|------|--------|--------|--------|
| SecurityContext (FSGroup) | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| InitContainer修改权限 | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 修改挂载选项 | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 服务端修改权限 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| chmod 777 | ⭐ | ⭐ | ⭐⭐⭐ | ⭐ |

---

## 推荐解决方案

### 方案1: SecurityContext + InitContainer（最佳实践）

```go
// 在environment.go中修改createRayCluster函数
func createRayCluster(...) {
    // 定义SecurityContext
    securityContext := &corev1.PodSecurityContext{
        FSGroup:    int64Ptr(1000),
        RunAsUser:  int64Ptr(1000),
        RunAsGroup: int64Ptr(1000),
    }
    
    // 定义InitContainer
    initContainer := corev1.Container{
        Name:  "fix-cfs-permissions",
        Image: "busybox:latest",
        Command: []string{
            "sh", "-c",
            "mkdir -p /cfs/rl-data && chown -R 1000:1000 /cfs/rl-data || true",
        },
        VolumeMounts: []corev1.VolumeMount{
            {
                Name:      "rl-data",
                MountPath: "/cfs",
            },
        },
        SecurityContext: &corev1.SecurityContext{
            RunAsUser: int64Ptr(0), // InitContainer以root运行
        },
    }
    
    // 应用到HeadGroupSpec
    headPodTemplate := corev1.PodTemplateSpec{
        Spec: corev1.PodSpec{
            SecurityContext:  securityContext,
            InitContainers:   []corev1.Container{initContainer},
            Containers:       []corev1.Container{headContainer},
            Volumes:          []corev1.Volume{volume},
        },
    }
}
```

### 方案2: 修改PV挂载选项

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: cfs-rl-data-pv
spec:
  capacity:
    storage: 10Ti
  accessModes:
    - ReadWriteMany
  mountOptions:
    - vers=4.0
    - noresvport
    - nolock
    - no_root_squash  # 关键选项
  csi:
    driver: com.tencent.cloud.csi.cfsturbo
    volumeHandle: cfs-rl-data-pv
    volumeAttributes:
      host: 10.32.5.135
      path: /83d8ea56/cfs
      fsid: 83d8ea56
```

---

## 下一步行动

1. **立即诊断**: 运行诊断命令收集详细信息
2. **选择方案**: 根据诊断结果选择合适的修复方案
3. **实施修复**: 修改代码或配置
4. **测试验证**: 创建新环境并测试权限
5. **文档记录**: 记录问题和解决方案

需要我帮您执行哪个步骤？