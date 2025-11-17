# 更新日志

本文档记录项目的所有重要变更。

## [Unreleased]

### 新增
- 环境详情页功能
  - 显示完整的环境配置信息
  - 实时状态监控（5秒自动刷新）
  - Ray Dashboard一键连接
  - 支持复制kubectl port-forward命令
- 完善的文档系统
  - 用户使用指南
  - API参考文档
  - 部署和发布指南
  - 快速测试指南
  - 认证配置指南
  - 故障排查指南

### 后端改进
- 新增环境详情API端点
  - `GET /api/environments/detail` - 获取环境详细信息
  - `GET /api/environments/status` - 获取实时状态
  - `GET /api/environments/dashboard-url` - 获取Dashboard访问信息
- 修复CORS配置，支持多端口（5173、5174、5175）
- 优化错误处理和日志输出
- 添加Ray集群详细信息提取功能
- 实现Dashboard服务自动发现

### 前端改进
- 新增EnvironmentDetail页面组件
- 环境列表名称支持点击跳转详情
- 使用TDesign Card和Row/Col组件优化布局
- 实现实时状态监控和自动刷新
- 添加Dashboard连接状态指示
- 优化响应式设计

### 修复
- 🐛 修复CORS导致的JSON解析错误
- 🐛 修复API端点404问题
- 🐛 修复TypeScript类型错误
- 🐛 优化认证错误提示信息

### 文档
- 📝 完全重写README.md
- 📝 新增完整的用户指南
- 📝 新增API参考文档
- 📝 新增部署指南
- 📝 新增故障排查文档
- 📝 更新项目结构说明

### 技术债务
- 🔨 添加.gitignore文件
- 🔨 清理临时文件和构建产物
- 🔨 移除不应提交的二进制文件

## [0.2.0] - 2025-11-17

### 新增
- 环境管理功能
  - 创建Ray/Horovod/DeepSpeed/Custom环境
  - 查看环境列表
  - 删除环境
  - 环境扩缩容
- KubeRay集成
  - 自动创建RayCluster CRD
  - 支持自定义镜像选择
  - 资源优化配置（Ray Head 4Gi内存）
- Namespace切换支持
- 名称自动规范化

### 后端
- 实现环境CRUD API
- 集成Kubernetes dynamic client
- 支持多Context集群连接

### 前端
- 环境管理页面
- 创建环境对话框
- 扩缩容功能
- TDesign组件集成

## [0.1.0] - 2025-11-10

### 新增
- 项目初始化
- 基础架构搭建
  - Go后端API服务器
  - React前端应用
  - Kubernetes client-go集成
- 集群连接功能
  - 支持kubeconfig上传
  - 多Context选择
  - 集群状态检查
- 基础UI框架
  - TDesign组件库集成
  - 导航栏
  - 路由配置

### 技术栈
- 后端: Go 1.21+
- 前端: React 18 + TypeScript + Vite 5
- UI库: TDesign React
- Kubernetes: client-go + dynamic client

## 版本说明

版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)规范：

- 主版本号：不兼容的API修改
- 次版本号：向下兼容的功能性新增
- 修订号：向下兼容的问题修正

## 贡献指南

如需贡献代码，请：
1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

## 相关链接

- [用户指南](USER_GUIDE.md)
- [API参考](API_REFERENCE.md)
- [部署指南](DEPLOYMENT_GUIDE.md)
- [故障排查](ENVIRONMENT_DETAIL_TROUBLESHOOTING.md)