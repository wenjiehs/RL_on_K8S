# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed - 2025-11-20

#### Environment创建配置重构
基于`rl/ray-single-group` RayCluster的生产配置，重构了Environment创建功能。

**主要改进**:
- ✅ 使用training-config.yaml中指定的Ray镜像
- ✅ 采用ray-single-group的资源配置（32核/128Gi/8GPU）
- ✅ 采用ray-single-group的网络配置（hostNetwork等）
- ✅ 采用ray-single-group的存储配置（CFS + HostPath）
- ✅ 采用ray-single-group的节点调度配置（亲和性和容忍度）

**详细说明**: 见 [docs/ENVIRONMENT_CONFIG_UPDATE.md](docs/ENVIRONMENT_CONFIG_UPDATE.md)

**配置对比**: 见 [docs/ENVIRONMENT_CONFIG_COMPARISON.md](docs/ENVIRONMENT_CONFIG_COMPARISON.md)

**修改文件**:
- `cmd/api-server/environment.go` - 重构createRayCluster函数

**新增文件**:
- `docs/ENVIRONMENT_CONFIG_UPDATE.md` - 配置更新说明
- `docs/ENVIRONMENT_CONFIG_COMPARISON.md` - 配置对比文档
- `scripts/create-environment-example.sh` - 创建示例脚本

---

## 历史版本

### [1.0.0] - 2025-11-XX

#### 初始发布
- 基础的Environment管理功能
- 简单的RayCluster创建
- 基础的资源配置
