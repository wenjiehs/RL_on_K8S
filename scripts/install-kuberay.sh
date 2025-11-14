#!/bin/bash

# KubeRay Operator 安装脚本
# 适用于各种 Kubernetes 集群

set -e

echo "========================================="
echo "KubeRay Operator 安装脚本"
echo "========================================="
echo ""

# 检查 kubectl 是否可用
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl 未安装，请先安装 kubectl"
    exit 1
fi

# 检查集群连接
echo "📡 检查 Kubernetes 集群连接..."
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ 无法连接到 Kubernetes 集群"
    echo "请确保 kubeconfig 配置正确"
    exit 1
fi

echo "✅ 集群连接正常"
echo ""

# 方法 1: 使用官方 YAML 安装
echo "📦 方法 1: 使用官方 YAML 安装 KubeRay Operator..."
echo ""

# 创建命名空间
echo "1️⃣ 创建 kuberay-system 命名空间..."
kubectl create namespace kuberay-system --dry-run=client -o yaml | kubectl apply -f -

# 安装 CRDs（使用 server-side apply 避免 annotation 大小限制）
echo "2️⃣ 安装 KubeRay CRDs..."
kubectl apply --server-side -f https://raw.githubusercontent.com/ray-project/kuberay/v1.0.0/ray-operator/config/crd/bases/ray.io_rayclusters.yaml
kubectl apply --server-side -f https://raw.githubusercontent.com/ray-project/kuberay/v1.0.0/ray-operator/config/crd/bases/ray.io_rayjobs.yaml
kubectl apply --server-side -f https://raw.githubusercontent.com/ray-project/kuberay/v1.0.0/ray-operator/config/crd/bases/ray.io_rayservices.yaml

# 安装 Operator（使用 kustomize）
echo "3️⃣ 安装 KubeRay Operator..."
kubectl apply -k "github.com/ray-project/kuberay/ray-operator/config/default?ref=v1.0.0&timeout=90s"

echo ""
echo "⏳ 等待 Operator 启动..."
sleep 5

# 检查安装状态
echo ""
echo "========================================="
echo "📊 安装状态检查"
echo "========================================="
echo ""

echo "1️⃣ CRD 状态:"
kubectl get crd | grep ray.io || echo "⚠️  未找到 Ray CRDs"

echo ""
echo "2️⃣ Operator Pod 状态:"
kubectl get pods -n kuberay-system

echo ""
echo "3️⃣ 等待 Operator 就绪..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=kuberay-operator -n kuberay-system --timeout=120s || {
    echo "⚠️  Operator 启动超时，请检查日志:"
    echo "kubectl logs -n kuberay-system -l app.kubernetes.io/name=kuberay-operator"
}

echo ""
echo "========================================="
echo "✅ KubeRay Operator 安装完成！"
echo "========================================="
echo ""
echo "验证命令:"
echo "  kubectl get crd rayclusters.ray.io"
echo "  kubectl get pods -n kuberay-system"
echo ""
echo "查看日志:"
echo "  kubectl logs -n kuberay-system -l app.kubernetes.io/name=kuberay-operator"
echo ""