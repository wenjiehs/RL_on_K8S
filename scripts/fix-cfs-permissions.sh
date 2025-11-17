#!/bin/bash
# CFS权限修复脚本
# 用途: 修复CFS Turbo (Lustre) 目录权限问题

set -e

echo "🔧 CFS权限修复脚本"
echo "=================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
CFS_PVC_NAME="cfs-rl-data-pvc"
NAMESPACE="default"
MOUNT_PATH="/cfs"
TARGET_UID=1000
TARGET_GID=100

echo "📋 配置信息:"
echo "  PVC名称: $CFS_PVC_NAME"
echo "  命名空间: $NAMESPACE"
echo "  挂载路径: $MOUNT_PATH"
echo "  目标UID: $TARGET_UID (ray用户)"
echo "  目标GID: $TARGET_GID (users组)"
echo ""

# 检查PVC是否存在
echo "1️⃣ 检查PVC状态..."
if ! kubectl get pvc $CFS_PVC_NAME -n $NAMESPACE &>/dev/null; then
    echo -e "${RED}❌ PVC $CFS_PVC_NAME 不存在${NC}"
    exit 1
fi

PVC_STATUS=$(kubectl get pvc $CFS_PVC_NAME -n $NAMESPACE -o jsonpath='{.status.phase}')
if [ "$PVC_STATUS" != "Bound" ]; then
    echo -e "${RED}❌ PVC状态异常: $PVC_STATUS${NC}"
    exit 1
fi
echo -e "${GREEN}✅ PVC状态正常: $PVC_STATUS${NC}"
echo ""

# 方案1: 创建临时Pod修复权限
echo "2️⃣ 创建临时Pod修复权限..."
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: cfs-permission-fixer
  namespace: $NAMESPACE
spec:
  restartPolicy: Never
  containers:
  - name: fixer
    image: busybox:latest
    command:
    - sh
    - -c
    - |
      echo "开始修复权限..."
      
      # 显示当前权限
      echo "当前权限:"
      ls -ld $MOUNT_PATH
      
      # 创建rl-data目录
      mkdir -p $MOUNT_PATH/rl-data
      
      # 修改所有者和权限
      chown -R $TARGET_UID:$TARGET_GID $MOUNT_PATH/rl-data || true
      chmod -R 755 $MOUNT_PATH/rl-data || true
      
      # 尝试修改根目录权限（可能失败，但不影响）
      chmod 755 $MOUNT_PATH || true
      
      # 显示修复后的权限
      echo "修复后权限:"
      ls -ld $MOUNT_PATH
      ls -ld $MOUNT_PATH/rl-data
      
      echo "权限修复完成！"
      sleep 5
    volumeMounts:
    - name: cfs-volume
      mountPath: $MOUNT_PATH
    securityContext:
      runAsUser: 0  # 以root运行
      privileged: true
  volumes:
  - name: cfs-volume
    persistentVolumeClaim:
      claimName: $CFS_PVC_NAME
EOF

echo "等待Pod启动..."
sleep 3

# 等待Pod完成
echo "等待权限修复完成..."
kubectl wait --for=condition=Ready pod/cfs-permission-fixer -n $NAMESPACE --timeout=60s || true
sleep 5

# 查看日志
echo ""
echo "3️⃣ 查看修复日志:"
kubectl logs cfs-permission-fixer -n $NAMESPACE || true
echo ""

# 清理临时Pod
echo "4️⃣ 清理临时Pod..."
kubectl delete pod cfs-permission-fixer -n $NAMESPACE --ignore-not-found=true
echo -e "${GREEN}✅ 临时Pod已清理${NC}"
echo ""

# 验证权限
echo "5️⃣ 验证权限修复结果..."
echo "请在Ray环境中执行以下命令验证:"
echo ""
echo -e "${YELLOW}  ls -la $MOUNT_PATH${NC}"
echo -e "${YELLOW}  ls -la $MOUNT_PATH/rl-data${NC}"
echo -e "${YELLOW}  touch $MOUNT_PATH/rl-data/test.txt${NC}"
echo -e "${YELLOW}  echo 'test' > $MOUNT_PATH/rl-data/test.txt${NC}"
echo -e "${YELLOW}  cat $MOUNT_PATH/rl-data/test.txt${NC}"
echo ""

echo -e "${GREEN}🎉 权限修复脚本执行完成！${NC}"
echo ""
echo "📝 注意事项:"
echo "  1. 如果仍有权限问题，可能需要联系CFS管理员"
echo "  2. Lustre文件系统的权限管理与NFS不同"
echo "  3. 建议在Ray环境中使用/cfs/rl-data子目录"
echo ""