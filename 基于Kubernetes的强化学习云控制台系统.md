# 基于Kubernetes的强化学习云控制台系统

## Core Features

- 多集群管理与连接（支持多Context选择）

- 环境管理（Ray/Horovod/DeepSpeed/Custom）

- KubeRay集成（自动创建RayCluster）

- 环境CRUD操作（创建、查看、删除、扩缩容）

- 环境详情页（详细配置信息展示）

- Ray Dashboard连接（一键访问测试）

- Web终端连接Ray Head节点（浏览器内Shell交互）

- 实时集群状态监控

- 名称自动规范化

- 优化的镜像选择体验

- 资源优化配置（适配资源受限集群）

- Namespace切换支持

- 数据集直接文件系统访问（无需CRD）

- 三级分层存储架构（/cfs/rl-data/{experiment_id}/{data_type}/{date}/）

- 四种数据类型分类管理（raw/train/eval/model）

- 数据集统计可视化（存储占用、类型分布）

- 文件分片上传支持

- 统一的Data Management页面（Tab组件整合Datasets和Storage Stats）

- 文件浏览器（目录导航、文件列表、列表/网格视图切换）

- 文件操作（下载、删除、预览）

- 文本文件预览（支持txt/log/json/yaml/md/py/sh等）

- 图片文件预览

- Parquet文件预览（Schema展示、数据表格、分页加载）

- 腾讯云CFS Turbo集成（CSI驱动挂载，35TB容量）

- CFS存储配置API（状态查询、初始化、配置管理）

- Ray环境自动挂载CFS存储（Head和Worker节点）

- 创建环境页面存储状态显示（实时检测、可视化指示器）

- 自动存储初始化（智能检测、一键创建PVC）

- 存储配置详情展示（挂载路径、容量、访问模式）

## Tech Stack

{
  "Web": {
    "arch": "react",
    "component": "tdesign"
  },
  "Backend": "Go + Kubernetes client-go + 直接文件系统访问 + WebSocket + parquet-go (xitongsys/parquet-go v1.6.2)",
  "Kubernetes": "v1.28+ with KubeRay Operator v1.5.0-rc.0",
  "Terminal": "xterm.js + Gorilla WebSocket + K8s remotecommand",
  "Storage": "腾讯云CFS Turbo (CSI驱动 com.tencent.cloud.csi.cfsturbo, fsid: 83d8ea56, 10.32.5.135, 35TB)",
  "DataFormat": "Apache Parquet (with pyarrow/snappy compression)"
}

## Design

采用前后端分离架构，后端使用Go实现RESTful API和WebSocket服务，通过Kubernetes client-go与集群交互。数据管理采用直接文件系统访问方式，无需Kubernetes CRD，通过扫描/cfs/rl-data目录结构自动发现数据集。Ray环境使用KubeRay Operator管理（通过dynamic client创建RayCluster CRD），其他框架使用标准Deployment。前端使用React + TDesign实现现代化UI，集成xterm.js提供浏览器内终端体验。WebSocket通过SPDY协议桥接到Kubernetes Pod exec，实现实时双向Shell交互。支持终端尺寸自适应、多会话隔离、优雅断线重连。导航采用扁平化一级菜单设计，Data Management页面使用Tab组件整合Datasets和Storage Stats功能，提供统一的namespace管理和更清晰的功能入口。数据管理采用Material Design风格，深蓝主色调(#0052D9)+浅灰背景(#F3F3F3)，数据类型使用语义化色彩标识(raw橙色、train蓝色、eval绿色、model紫色)。文件浏览器采用左右分栏布局，左侧快速导航面板显示根目录和最近访问路径，右侧文件列表支持列表/网格视图切换，提供文件搜索、下载、删除、预览等操作。Parquet预览使用xitongsys/parquet-go库解析文件，前端以表格形式展示Schema和数据（默认前100行），支持列类型标注和空值显示。存储后端使用腾讯云CFS Turbo（35TB容量），通过腾讯云CSI驱动(com.tencent.cloud.csi.cfsturbo)挂载到Kubernetes集群，PVC使用cfs-turbo-sc StorageClass，支持ReadWriteMany访问模式，数据持久化存储在/cfs/rl-data目录下。后端提供完整的CFS存储配置管理API，包括存储状态查询、PVC自动创建、StorageClass管理等功能。Ray环境创建时自动挂载CFS存储卷到/cfs路径，Head和Worker节点均可访问共享存储。创建环境对话框集成存储状态实时检测，使用TDesign Alert组件显示存储就绪状态（绿色成功提示）或未初始化状态（黄色警告提示），提供存储配置详情面板展示挂载路径、数据路径、StorageClass和访问模式，支持自动初始化选项（默认勾选），在创建环境时自动创建PVC，提供清晰的用户反馈和加载状态指示。

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

[X] 代码提交到GitHub

[X] 数据管理-CFS后端API实现

[X] 数据管理-文件上传API

[X] 数据管理-统计API

[X] 数据管理-前端Tab集成

[X] 数据管理-CFS目录结构实现

[X] 数据管理-文件浏览器后端API

[X] 数据管理-文件浏览器前端组件

[X] 数据管理-文件预览功能

[X] 数据管理-Parquet预览后端

[X] 数据管理-Parquet预览前端

[X] 数据管理-测试数据生成脚本

[X] 数据管理-CFS Turbo PV/PVC配置

[X] 数据管理-CFS挂载测试验证

[X] 数据管理-后端CFS路径配置

[X] 数据管理-前端存储集成

[X] 后端依赖问题修复

[X] 导航结构重构-页面合并

[X] 导航结构重构-TypeScript编译修复

[X] 数据管理-移除CRD依赖-前端DatasetList迁移

[X] 数据管理-移除CRD依赖-前端StorageStats迁移

[X] 数据管理-移除CRD依赖-前端CreateDatasetDialog迁移

[X] 数据管理-移除CRD依赖-清理旧代码

[ ] 训练管理

[ ] 监控诊断

[ ] 数据管理-环境数据挂载

[ ] 数据管理-Sidecar容器集成

[ ] 数据管理-版本控制

[ ] 数据管理-审计日志
