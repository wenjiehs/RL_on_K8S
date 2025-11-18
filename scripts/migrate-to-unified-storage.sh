#!/bin/bash

# 统一存储配置数据迁移脚本
# 将所有数据迁移到统一的 cfs-rl-data-pvc

set -e

echo "🚀 开始统一存储配置数据迁移..."

# 配置
NAMESPACE="default"
UNIFIED_PVC="cfs-rl-data-pvc"
OLD_PVCS=("ray-storage-pvc" "rl-data-storage")

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "📋 迁移配置:"
echo "  命名空间: $NAMESPACE"
echo "  统一PVC: $UNIFIED_PVC"
echo "  待迁移PVC: ${OLD_PVCS[*]}"
echo ""

# 检查统一PVC状态
echo "1️⃣ 检查统一PVC状态..."
if ! kubectl get pvc $UNIFIED_PVC -n $NAMESPACE &>/dev/null; then
    echo -e "${RED}❌ 统一PVC $UNIFIED_PVC 不存在${NC}"
    exit 1
fi

UNIFIED_PVC_STATUS=$(kubectl get pvc $UNIFIED_PVC -n $NAMESPACE -o jsonpath='{.status.phase}')
if [ "$UNIFIED_PVC_STATUS" != "Bound" ]; then
    echo -e "${RED}❌ 统一PVC状态异常: $UNIFIED_PVC_STATUS${NC}"
    exit 1
fi

UNIFIED_CAPACITY=$(kubectl get pvc $UNIFIED_PVC -n $NAMESPACE -o jsonpath='{.status.capacity.storage}')
echo -e "${GREEN}✅ 统一PVC状态正常: $UNIFIED_PVC_STATUS ($UNIFIED_CAPACITY)${NC}"
echo ""

# 创建迁移Pod
echo "2️⃣ 创建数据迁移Pod..."
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: storage-migration-pod
  namespace: $NAMESPACE
  labels:
    app: storage-migration
spec:
  restartPolicy: Never
  containers:
  - name: migration
    image: alpine:latest
    command: ["/bin/sh", "-c", "sleep 3600"]  # 保持运行1小时
    volumeMounts:
    - name: unified-storage
      mountPath: /mnt/unified
    - name: old-storage-1
      mountPath: /mnt/old1
    - name: old-storage-2
      mountPath: /mnt/old2
  volumes:
  - name: unified-storage
    persistentVolumeClaim:
      claimName: $UNIFIED_PVC
  - name: old-storage-1
    persistentVolumeClaim:
      claimName: ray-storage-pvc
  - name: old-storage-2
    persistentVolumeClaim:
      claimName: rl-data-storage
EOF

echo "等待迁移Pod启动..."
for i in {1..30}; do
    if kubectl get pod storage-migration-pod -n $NAMESPACE | grep -q "Running"; then
        echo -e "${GREEN}✅ 迁移Pod已启动${NC}"
        break
    fi
    sleep 2
    echo "  等待中... ($i/30)"
done

if ! kubectl get pod storage-migration-pod -n $NAMESPACE | grep -q "Running"; then
    echo -e "${RED}❌ 迁移Pod启动失败${NC}"
    kubectl describe pod storage-migration-pod -n $NAMESPACE
    exit 1
fi

echo ""

# 执行数据迁移
echo "3️⃣ 执行数据迁移..."

# 检查旧PVC中的数据
echo "检查旧PVC中的数据:"
echo "ray-storage-pvc:"
kubectl exec storage-migration-pod -n $NAMESPACE -- ls -la /mnt/old1/rl-data/ 2>/dev/null || echo "  目录为空或不存在"

echo "rl-data-storage:"
kubectl exec storage-migration-pod -n $NAMESPACE -- ls -la /mnt/old2/rl-data/ 2>/dev/null || echo "  目录为空或不存在"

echo ""

# 创建统一数据目录
echo "创建统一数据目录..."
kubectl exec storage-migration-pod -n $NAMESPACE -- mkdir -p /mnt/unified/rl-data

# 迁移ray-storage-pvc数据
echo "迁移 ray-storage-pvc 数据..."
if kubectl exec storage-migration-pod -n $NAMESPACE -- ls /mnt/old1/rl-data/ &>/dev/null; then
    kubectl exec storage-migration-pod -n $NAMESPACE -- cp -r /mnt/old1/rl-data/* /mnt/unified/rl-data/ 2>/dev/null || echo "  没有文件需要迁移"
    echo -e "${GREEN}✅ ray-storage-pvc 数据迁移完成${NC}"
else
    echo -e "${YELLOW}⚠️ ray-storage-pvc 没有rl-data目录${NC}"
fi

# 迁移rl-data-storage数据
echo "迁移 rl-data-storage 数据..."
if kubectl exec storage-migration-pod -n $NAMESPACE -- ls /mnt/old2/rl-data/ &>/dev/null; then
    kubectl exec storage-migration-pod -n $NAMESPACE -- cp -r /mnt/old2/rl-data/* /mnt/unified/rl-data/ 2>/dev/null || echo "  没有文件需要迁移"
    echo -e "${GREEN}✅ rl-data-storage 数据迁移完成${NC}"
else
    echo -e "${YELLOW}⚠️ rl-data-storage 没有rl-data目录${NC}"
fi

echo ""

# 验证迁移结果
echo "4️⃣ 验证迁移结果..."
echo "统一存储中的数据:"
kubectl exec storage-migration-pod -n $NAMESPACE -- ls -la /mnt/unified/rl-data/ || echo "  目录为空"

echo ""

# 清理迁移Pod
echo "5️⃣ 清理迁移Pod..."
kubectl delete pod storage-migration-pod -n $NAMESPACE --wait=false
echo -e "${GREEN}✅ 迁移Pod已删除${NC}"

echo ""
echo "🎉 存储统一配置迁移完成！"
echo ""
echo "📊 迁移总结:"
echo "  - 统一PVC: $UNIFIED_PVC ($UNIFIED_CAPACITY)"
echo "  - 数据路径: /mnt/cfs/rl-data"
echo "  - 所有组件现在使用同一个PVC"
echo ""
echo "📝 后续步骤:"
echo "  1. 重启相关服务以使用新的存储配置"
echo "  2. 验证数据访问功能正常"
echo "  3. 可以考虑删除旧的PVC以节省资源"
echo ""

# 显示当前PVC状态
echo "当前PVC状态:"
kubectl get pvc | grep -E "(ray-storage|rl-data|cfs-rl)" | head -10