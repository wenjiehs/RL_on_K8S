# CFS权限问题完整解决方案

## 问题诊断结果

通过详细诊断,我们发现了CFS权限问题的根本原因:

### 1. 用户身份信息
```bash
uid=1000(ray) gid=100(users) groups=100(users),27(sudo)
```
- Ray容器运行用户: UID 1000, GID 100 (users组)

### 2. 目录权限
```bash
drwxr-x--- 2 root root 16384 Nov 17 05:57 /cfs
```
- 所有者: root (UID 0, GID 0)
- 权限: 750 (rwxr-x---)
  - Owner(root): rwx ✅
  - Group(root): r-x ✅  
  - **Others: --- ❌ (无任何权限)**

**问题核心:** Ray用户(UID 1000)不属于root组,且目录对Others没有权限,导致Permission Denied。

### 3. 文件系统类型
```bash
10.32.5.135@tcp:/83d8ea56/cfs on /cfs type lustre (rw,flock,lazystatfs)
```
**重要发现:** CFS Turbo使用 **Lustre** 文件系统,不是NFS!

Lustre特性:
- 高性能并行文件系统
- 权限管理与POSIX兼容
- 支持大规模存储(35TB)
- 需要特殊的权限配置

---

## 解决方案

### 方案1: 使用临时Pod修复权限(推荐)

**优点:**
- 快速有效
- 不需要修改代码
- 立即生效

**步骤:**

1. **运行修复脚本**
```bash
./scripts/fix-cfs-permissions.sh
```

脚本会:
- 创建临时Pod (以root权限运行)
- 创建 `/cfs/rl-data` 目录
- 修改所有者为 `1000:100` (ray:users)
- 设置权限为 755
- 自动清理临时Pod

2. **验证修复结果**
```bash
# 在Ray Pod中测试
kubectl exec -it virgil-ray-test4-head-jkf4g -n default -- bash

# 测试访问
ls -la /cfs
ls -la /cfs/rl-data

# 测试写入
mkdir /cfs/rl-data/test
echo "test" > /cfs/rl-data/test/file.txt
cat /cfs/rl-data/test/file.txt
```

---

### 方案2: 修改RayCluster配置(长期方案)

**优点:**
- 自动化
- 每次创建环境都生效
- 符合Kubernetes最佳实践

**实施步骤:**

#### 步骤1: 修改environment.go

在 `createRayCluster` 函数中添加SecurityContext和InitContainer:

```go
func createRayCluster(ctx context.Context, name, namespace, image string, workers int32, labels map[string]string) error {
    // ... 现有代码 ...
    
    // 定义SecurityContext
    securityContext := &corev1.PodSecurityContext{
        FSGroup:    int64Ptr(100),   // users组
        RunAsUser:  int64Ptr(1000),  // ray用户
        RunAsGroup: int64Ptr(100),   // users组
    }
    
    // 定义InitContainer修复CFS权限
    initContainer := corev1.Container{
        Name:  "fix-cfs-permissions",
        Image: "busybox:latest",
        Command: []string{
            "sh", "-c",
            "mkdir -p /cfs/rl-data && chown -R 1000:100 /cfs/rl-data && chmod -R 755 /cfs/rl-data || true",
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
        ObjectMeta: metav1.ObjectMeta{
            Labels: labels,
        },
        Spec: corev1.PodSpec{
            SecurityContext:  securityContext,
            InitContainers:   []corev1.Container{initContainer},
            Containers:       []corev1.Container{headContainer},
            Volumes:          []corev1.Volume{volume},
        },
    }
    
    // 同样应用到WorkerGroupSpec
    workerPodTemplate := corev1.PodTemplateSpec{
        ObjectMeta: metav1.ObjectMeta{
            Labels: labels,
        },
        Spec: corev1.PodSpec{
            SecurityContext:  securityContext,
            InitContainers:   []corev1.Container{initContainer},
            Containers:       []corev1.Container{workerContainer},
            Volumes:          []corev1.Volume{volume},
        },
    }
    
    // ... 其余代码 ...
}

// 辅助函数
func int64Ptr(i int64) *int64 {
    return &i
}
```

#### 步骤2: 重新编译和部署

```bash
# 编译后端
cd cmd/api-server
go build -o ../../bin/api-server

# 重启API服务器
pkill -f "bin/api-server"
./bin/api-server > /tmp/api-server.log 2>&1 &
```

#### 步骤3: 测试新环境

```bash
# 删除旧环境
kubectl delete raycluster virgil-ray-test4 -n default

# 在前端创建新环境
# 新环境会自动:
# 1. 设置正确的SecurityContext
# 2. 运行InitContainer修复权限
# 3. Ray容器可以正常访问/cfs
```

---

### 方案3: 修改PV挂载选项(备选)

如果Lustre支持,可以尝试修改挂载选项:

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
    - flock
    - lazystatfs
    - user_xattr  # 添加扩展属性支持
  csi:
    driver: com.tencent.cloud.csi.cfsturbo
    volumeHandle: cfs-rl-data-pv
    volumeAttributes:
      host: 10.32.5.135
      path: /
      rootdir: /cfs
      fsid: 83d8ea56
```

**注意:** 此方案需要重新创建PV,可能影响现有数据。

---

## 验证清单

完成修复后,请验证以下项目:

- [ ] 可以在Ray Pod中执行 `ls /cfs`
- [ ] 可以在Ray Pod中执行 `ls /cfs/rl-data`
- [ ] 可以创建目录: `mkdir /cfs/rl-data/test`
- [ ] 可以创建文件: `touch /cfs/rl-data/test/file.txt`
- [ ] 可以写入文件: `echo "test" > /cfs/rl-data/test/file.txt`
- [ ] 可以读取文件: `cat /cfs/rl-data/test/file.txt`
- [ ] 文件所有者正确: `ls -l /cfs/rl-data/test/file.txt` 显示 `ray users`

---

## 常见问题

### Q1: 为什么是Lustre而不是NFS?

A: 腾讯云CFS Turbo使用Lustre文件系统以提供更高性能:
- 吞吐量: 高达40GB/s
- IOPS: 百万级
- 容量: PB级扩展
- 适合大规模AI训练场景

### Q2: 为什么不直接chmod 777?

A: 安全原因:
- 777权限允许任何用户读写执行
- 可能导致数据泄露或被篡改
- 不符合最小权限原则
- 推荐使用755或750

### Q3: InitContainer会影响启动速度吗?

A: 影响很小:
- InitContainer只运行一次
- 通常在1-2秒内完成
- 相比Pod启动时间(10-30秒)可忽略

### Q4: 如果权限修复失败怎么办?

A: 可能的原因和解决方案:
1. **Lustre不支持chown**: 联系CFS管理员在服务端修改
2. **SELinux限制**: 检查节点SELinux状态
3. **CSI驱动问题**: 更新CSI驱动版本
4. **网络问题**: 检查CFS连接状态

---

## 推荐实施顺序

1. **立即修复** (5分钟)
   ```bash
   ./scripts/fix-cfs-permissions.sh
   ```

2. **验证修复** (2分钟)
   ```bash
   kubectl exec -it virgil-ray-test4-head-jkf4g -n default -- ls -la /cfs/rl-data
   ```

3. **长期方案** (30分钟)
   - 修改environment.go添加SecurityContext
   - 重新编译部署
   - 测试新环境

4. **文档更新** (10分钟)
   - 更新README
   - 记录权限配置
   - 添加故障排查指南

---

## 相关文档

- [Lustre文件系统文档](http://lustre.org/)
- [Kubernetes SecurityContext](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/)
- [腾讯云CFS Turbo](https://cloud.tencent.com/document/product/582)
- [KubeRay配置指南](https://docs.ray.io/en/latest/cluster/kubernetes/index.html)

---

## 总结

CFS权限问题的根本原因是:
1. **用户不匹配**: Ray用户(1000:100) vs root(0:0)
2. **权限限制**: 目录权限750,Others无权限
3. **文件系统**: Lustre的POSIX权限模型

**推荐解决方案:**
- **短期**: 运行修复脚本 `./scripts/fix-cfs-permissions.sh`
- **长期**: 在RayCluster配置中添加SecurityContext和InitContainer

这样可以确保:
- ✅ 现有环境立即可用
- ✅ 新环境自动配置正确
- ✅ 符合安全最佳实践
- ✅ 易于维护和扩展