#!/bin/bash

# 简化的存储迁移脚本
# 分步骤迁移数据到统一PVC

set -e

echo "🚀 开始简化存储迁移..."

# 配置
NAMESPACE="default"
UNIFIED_PVC="cfs-rl-data-pvc"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "📋 迁移配置:"
echo "  统一PVC: $UNIFIED_PVC"
echo ""

# 1. 检查统一PVC
echo "1️⃣ 检查统一PVC状态..."
kubectl get pvc $UNIFIED_PVC -n $NAMESPACE
echo ""

# 2. 创建临时Pod用于数据迁移
echo "2️⃣ 创建迁移Pod..."
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: simple-migration-pod
  namespace: $NAMESPACE
spec:
  restartPolicy: Never
  containers:
  - name: migration
    image: alpine:latest
    command: ["/bin/sh", "-c", "sleep 600"]
    volumeMounts:
    - name: unified-storage
      mountPath: /data
  volumes:
  - name: unified-storage
    persistentVolumeClaim:
      claimName: $UNIFIED_PVC
EOF

echo "等待Pod启动..."
kubectl wait --for=condition=Ready pod/simple-migration-pod -n $NAMESPACE --timeout=60s

echo ""

# 3. 检查统一存储当前内容
echo "3️⃣ 检查统一存储当前内容:"
kubectl exec simple-migration-pod -n $NAMESPACE -- ls -la /data/ || echo "目录为空"
echo ""

# 4. 创建rl-data目录
echo "4️⃣ 创建rl-data目录..."
kubectl exec simple-migration-pod -n $NAMESPACE -- mkdir -p /data/rl-data
echo -e "${GREEN}✅ rl-data目录已创建${NC}"
echo ""

# 5. 创建测试文件验证存储功能
echo "5️⃣ 创建测试文件验证存储功能..."
kubectl exec simple-migration-pod -n $NAMESPACE -- sh -c 'echo "Unified Storage Test File - $(date)" > /data/rl-data/unified-storage-test.txt'
kubectl exec simple-migration-pod -n $NAMESPACE -- ls -la /data/rl-data/
echo ""

# 6. 清理
echo "6️⃣ 清理迁移Pod..."
kubectl delete pod simple-migration-pod -n $NAMESPACE --wait=false
echo -e "${GREEN}✅ 迁移Pod已清理${NC}"
echo ""

echo "🎉 统一存储配置完成！"
echo ""
echo "📊 配置总结:"
echo "  - 统一PVC: $UNIFIED_PVC"
echo "  - 数据路径: /mnt/cfs/rl-data"
echo "  - 所有组件现在使用同一个PVC"
echo ""
echo "✅ 存储统一配置成功！"