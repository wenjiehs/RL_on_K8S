# 基于Kubernetes的强化学习云控制台系统

## Core Features

- 多集群管理与连接（支持多Context选择）

- 环境管理（Ray/Horovod/DeepSpeed/Custom）

- KubeRay集成（自动创建RayCluster）

- 环境CRUD操作（创建、查看、删除、扩缩容）

- 环境详情页（详细配置信息展示）

- Ray Dashboard连接（一键访问测试）

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
  "Backend": "Go + Kubernetes client-go + dynamic client",
  "Kubernetes": "v1.28+ with KubeRay Operator v1.5.0-rc.0"
}

## Design

采用前后端分离架构，后端使用Go实现RESTful API，通过Kubernetes client-go与集群交互。Ray环境使用KubeRay Operator管理（通过dynamic client创建RayCluster CRD），其他框架使用标准Deployment。前端使用React + TDesign实现现代化UI，支持实时状态监控、环境CRUD操作、环境详情查看、Ray Dashboard一键连接、Namespace切换和友好的用户交互。资源配置已优化（Ray Head 4Gi内存）以适配资源受限的云环境。Dashboard访问通过kubectl port-forward实现。

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

[ ] 训练管理

[ ] 监控诊断

[ ] 数据管理
