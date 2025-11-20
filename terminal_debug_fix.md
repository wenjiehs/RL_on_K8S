# 环境详情页Terminal功能调试修复

## 问题分析

环境列表页Terminal正常工作，但详情页Terminal无法使用。经过分析发现以下问题：

### 1. 状态不一致问题
- Terminal按钮使用 `currentStatus` 而不是 `detail.status`
- `currentStatus` 和 `detail.status` 可能不同步
- 导致按钮状态判断错误

### 2. 错误处理不完善
- 缺少对 `detail` 为空的详细错误处理
- 调试信息不足，难以定位问题

## 修复方案

### 1. 统一状态检查
```typescript
// 修复前
disabled={currentStatus !== 'running'}

// 修复后  
disabled={!detail || detail.status !== 'running'}
```

### 2. 增强错误处理和调试
```typescript
const handleOpenTerminal = () => {
  console.log('handleOpenTerminal called');
  console.log('detail:', detail);
  console.log('detail.status:', detail?.status);
  console.log('detail.framework:', detail?.framework);
  
  if (!detail) {
    console.log('No detail available');
    MessagePlugin.error('Environment details not loaded');
    return;
  }
  
  if (detail.status !== 'running') {
    console.log('Environment not running, status:', detail.status);
    MessagePlugin.warning('Only running environments can be connected');
    return;
  }
  if (detail.framework !== 'ray') {
    console.log('Not Ray framework, framework:', detail.framework);
    MessagePlugin.warning('Terminal connection is only available for Ray environments');
    return;
  }
  
  console.log('Setting terminal visible to true');
  setTerminalVisible(true);
};
```

### 3. WebTerminal组件调试
```typescript
useEffect(() => {
  console.log('WebTerminal useEffect called');
  console.log('visible:', visible);
  console.log('terminalRef.current:', terminalRef.current);
  console.log('envName:', envName);
  console.log('namespace:', namespace);
  
  if (!visible || !terminalRef.current) return;
  // ...
}, [visible, envName, namespace]);
```

## 测试步骤

1. 打开浏览器开发者工具的Console面板
2. 访问环境详情页：`http://localhost:5173/environments/{env-id}`
3. 确保环境状态为 "running" 且框架为 "ray"
4. 点击 "Terminal" 按钮
5. 查看Console输出，确认函数被正确调用
6. 确认Terminal对话框正常弹出

## 预期结果

- Terminal按钮在环境运行时应该可点击
- 点击按钮应该看到Console调试信息
- Terminal对话框应该正常弹出
- WebTerminal组件应该正确初始化

## 可能的进一步调试

如果问题仍然存在，请检查：

1. **浏览器Console错误**：查看是否有JavaScript错误
2. **网络请求**：检查WebSocket连接是否正常建立
3. **后端日志**：查看API服务器是否有相关错误信息
4. **环境数据**：确认环境的status和framework字段正确

## 对比环境列表页

环境列表页正常工作的关键：
- 使用 `terminalEnv` 状态变量存储当前环境
- 直接传递环境对象给WebTerminal组件
- 状态检查使用 `row.status` 而不是异步状态

详情页现在采用相同的方式：
- 直接使用 `detail` 对象
- 统一的状态检查逻辑
- 增强的错误处理和调试