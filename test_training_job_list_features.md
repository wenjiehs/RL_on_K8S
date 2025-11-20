# 训练任务列表页和环境详情页功能测试

## 测试功能

### 1. 训练列表页环境名称跳转功能
- [x] 环境模式列已改为环境名称
- [x] 环境名称可点击跳转到环境详情页
- [x] 显示环境模式作为副标题（选择已有/自动创建）
- [x] 传递正确的参数（name, namespace, framework）

### 2. 环境详情页Terminal入口
- [x] 添加Terminal按钮到环境详情页头部
- [x] Terminal按钮仅在环境运行时可用
- [x] 点击Terminal按钮跳转到Terminal页面
- [x] 创建Terminal页面使用WebTerminal组件
- [x] 添加Terminal路由到App.tsx

## 测试步骤

### 测试环境名称跳转：
1. 访问 http://localhost:5173/training
2. 查看训练任务列表中的"环境名称"列
3. 点击环境名称（如 "ray-single-group"）
4. 应该跳转到对应的环境详情页

### 测试Terminal功能：
1. 在环境详情页，确保环境状态为"running"
2. 点击"Terminal"按钮
3. 应该打开Terminal页面并连接到环境的head pod
4. 可以在终端中执行命令

## API测试结果

```bash
# 训练任务列表API正常工作
curl http://localhost:8080/api/training-jobs
# 返回8个任务，包含environmentId和environmentMode字段

# 环境详情API正常工作
curl "http://localhost:8080/api/environments/detail?name=ray-single-group&namespace=rl&framework=ray"
# 返回环境详细信息
```

## 前端组件更新

### TrainingJobs.tsx
- 将环境模式列改为环境名称列
- 添加点击跳转功能
- 保留环境模式作为副标题显示

### EnvironmentDetail.tsx  
- 添加Terminal按钮
- 添加TerminalIcon导入
- 添加handleOpenTerminal函数

### 新增文件
- Terminal.tsx - Terminal页面
- 更新App.tsx路由配置
- 更新pages/index.ts导出

## 功能特点

1. **环境名称跳转**：
   - 显示实际的环境ID而不是模式
   - 可点击跳转到环境详情页
   - 保留环境模式信息作为副标题

2. **Terminal入口**：
   - 只在环境运行时启用
   - 直接跳转到专用Terminal页面
   - 传递完整的环境参数

3. **用户体验**：
   - 清晰的视觉反馈
   - 合理的按钮状态管理
   - 流畅的页面跳转