# CFS权限问题修复指南

## 问题描述

在Ray环境中访问CFS挂载目录时遇到权限拒绝错误：

```bash
(base) ray@virgil-ray-test4-head-jkf4g:/$ ls -la /cfs
ls: cannot open directory '/cfs': Permission denied
```

但是挂载本身是成功的：
```bash
(base) ray@virgil-ray-test4-head-jkf4g:/$ df -h | grep cfs
10.32.5.135@tcp:/83d8ea56/cfs   35T   27T  9.0T  75% /cfs
```

## 原因分析

CFS Turbo使用NFS协议挂载，默认情况下：
1. CFS目录的所有者可能是root或特定UID
2. Ray容器以非root用户运行（通常是UID 1000）
3. 需要设置正确的fsGroup或修改目录权限

## 解决方案

### 方案1: 设置SecurityContext（推荐）

在创建RayCluster时，为Pod设置正确的SecurityContext：

```go
// 在RayCluster的Head和Worker Pod模板中添加
securityContext := &corev1.PodSecurityContext{
    FSGroup: int64Ptr(1000),  // Ray用户的GID
    RunAsUser: int64Ptr(1000), // Ray用户的UID
    RunAsGroup: int64Ptr(1000),
}
```

### 方案2: 使用InitContainer修复权限

添加InitContainer在Pod启动前修复目录权限：

```yaml
initContainers:
- name: fix-cfs-permissions
  image: busybox:latest
  command:
  - sh
  - -c
  - |
    chown -R 1000:1000 /cfs || true
    chmod -R 755 /cfs || true
  volumeMounts:
  - name: rl-data
    mountPath: /cfs
  securityContext:
    runAsUser: 0  # 以root运行InitContainer
```

### 方案3: 在CFS服务端设置权限

如果有CFS管理权限，可以在服务端设置：

```bash
# 在有权限的节点上执行
sudo chown -R 1000:1000 /path/to/cfs/mount
sudo chmod -R 755 /path/to/cfs/mount
```

## 实施步骤

### 步骤1: 修改environment.go

在`createRayCluster`函数中添加SecurityContext配置：

```go
// 在HeadGroupSpec中添加
headPodTemplate := corev1.PodTemplateSpec{
    Spec: corev1.PodSpec{
        SecurityContext: &corev1.PodSecurityContext{
            FSGroup:    int64Ptr(1000),
            RunAsUser:  int64Ptr(1000),
            RunAsGroup: int64Ptr(1000),
        },
        Containers: []corev1.Container{
            // ... 现有容器配置
        },
        Volumes: []corev1.Volume{volume},
    },
}

// 在WorkerGroupSpec中也添加相同配置
```

### 步骤2: 重新编译后端

```bash
cd cmd/api-server
go build -o ../../bin/api-server
```

### 步骤3: 重启API服务器

```bash
pkill -f "bin/api-server"
./bin/api-server > /tmp/api-server.log 2>&1 &
```

### 步骤4: 删除旧环境并重新创建

```bash
# 删除旧环境
kubectl delete raycluster virgil-ray-test4 -n default

# 在前端重新创建环境
```

### 步骤5: 验证权限

进入新创建的Ray Pod：

```bash
# 获取Pod名称
kubectl get pods -n default | grep ray

# 进入Pod
kubectl exec -it <pod-name> -n default -- bash

# 测试权限
ls -la /cfs
mkdir /cfs/test
echo "test" > /cfs/test/file.txt
cat /cfs/test/file.txt
```

## 快速修复（临时方案）

如果需要立即测试，可以在当前Pod中临时获取权限：

```bash
# 在Ray Pod中
# 方法1: 使用sudo（如果容器中有sudo）
sudo ls -la /cfs

# 方法2: 请求管理员在CFS服务端修改权限
# 联系集群管理员执行：
# kubectl exec -it <pod-name> -n default -- chown -R ray:ray /cfs
```

## 验证清单

- [ ] SecurityContext已添加到RayCluster配置
- [ ] 后端代码已重新编译
- [ ] API服务器已重启
- [ ] 旧环境已删除
- [ ] 新环境已创建
- [ ] 可以在Pod中访问/cfs目录
- [ ] 可以在/cfs目录中创建文件
- [ ] 可以读写/cfs目录中的文件

## 相关文档

- [Kubernetes SecurityContext文档](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/)
- [NFS权限管理最佳实践](https://kubernetes.io/docs/concepts/storage/volumes/#nfs)
- [Ray on Kubernetes配置指南](https://docs.ray.io/en/latest/cluster/kubernetes/index.html)

## 注意事项

1. **UID/GID匹配**: 确保Pod中的用户UID/GID与CFS目录权限匹配
2. **安全性**: 避免使用RunAsUser: 0（root），除非必要
3. **持久化**: SecurityContext配置会应用到所有新创建的Pod
4. **兼容性**: 某些容器镜像可能不支持非root用户运行

## 下一步

修复权限后，您可以：
1. 在Ray环境中正常访问CFS存储
2. 使用/cfs/rl-data目录存储训练数据
3. 在多个Worker节点间共享数据
4. 实现数据持久化和版本管理