# 基于Kubernetes的强化学习云控制台系统

## Core Features

- 多集群管理与连接（支持多Context选择）

- 环境管理（Ray/Horovod/DeepSpeed/Custom）

- KubeRay集成（自动创建RayCluster）

- 环境CRUD操作（创建、查看、删除、扩缩容）

- 环境详情页（详细配置信息展示）

- Ray Dashboard连接（一键访问测试）

- Web终端连接Ray Head节点（WebSocket实时交互）

- 实时集群状态监控

- 名称自动规范化

- 优化的镜像选择体验

- 资源优化配置（适配资源受限集群）

- Namespace切换支持

## Tech Stack

{
  "Web": {
    "arch": "react",
    "component": "tdesign"
  },
  "Backend": "Go + Kubernetes client-go + dynamic client + WebSocket",
  "Kubernetes": "v1.28+ with KubeRay Operator v1.5.0-rc.0",
  "Terminal": "WebSocket + xterm.js + K8s SPDY"
}

## Design

采用前后端分离架构，后端使用Go实现RESTful API和WebSocket服务，通过Kubernetes client-go与集群交互。Ray环境使用KubeRay Operator管理（通过dynamic client创建RayCluster CRD），其他框架使用标准Deployment。前端使用React + TDesign实现现代化UI，集成xterm.js提供Web终端体验，支持基础终端（WebTerminal）功能。WebSocket通过SPDY协议桥接到Kubernetes Pod exec，实现实时双向Shell交互。整体强调操作流程的直观性和数据的可视化展示。

## Plan

Note: 

- [ ] is holding
- [/] is doing
- [X] is done

---

[X] 需求分析

[X] 项目初始化

[X] 后端API开发

[X] 集群连接功能

[X] 多Context支持

[X] 导航栏集成

[X] 环境管理后端

[X] 环境管理前端

[X] 环境列表查看

[X] 环境删除功能修复

[X] Ray Pod OOM修复

[X] Namespace切换支持

[X] 环境扩缩容

[X] 名称规范化

[X] KubeRay集成

[X] 资源优化

[X] UI优化

[X] 文档完善

[X] 环境详情后端API

[X] 环境详情前端页面

[X] Ray Dashboard连接

[X] CORS配置修复

[X] 认证问题排查

[X] Web终端后端WebSocket服务

[X] Web终端前端组件开发

[X] 环境列表终端按钮集成

[X] 终端功能测试

[X] 修复Terminal功能异常和WebTerminal组件

[X] 修复Data Management页面空白和前端依赖问题

[X] 解决前端服务启动问题和端口冲突

[X] 修复前端组件TypeScript错误和运行时异常

[X] 添加WebTerminal输入功能和命令执行功能

[X] 删除AdvancedTerminal功能并保留WebTerminal

[X] 修复Data页面toUpperCase错误

[X] 修复WebSocket连接参数不匹配问题

[X] 修复WebSocket CORS配置问题

[X] 测试WebSocket终端连接功能

[X] 完善WebTerminal功能支持实时交互和自动重连

[X] 修复终端显示乱码问题（ANSI转义序列清理）

[X] 修复终端输入输出问题

[/] 更新完整用法文档和提交GitHub

[ ] 前端集成启动/暂停/恢复按钮

[ ] 测试Ray集群训练任务提交

[ ] 实现训练指标收集和可视化

[ ] 开发任务详情页和实时监控功能

[ ] 实现Checkpoint管理和恢复功能
