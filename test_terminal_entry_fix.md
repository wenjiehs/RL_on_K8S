# 环境详情页Terminal入口修复

## 修复内容

### 问题
- 环境详情页的Terminal入口无法使用
- 用户只需要复用环境列表页已有的Terminal功能

### 解决方案
1. **移除不必要的Terminal页面**：
   - 删除了 `frontend/src/pages/Terminal.tsx`
   - 从 `App.tsx` 中移除Terminal路由
   - 从 `pages/index.ts` 中移除Terminal导出

2. **在环境详情页添加WebTerminal组件**：
   - 导入 `WebTerminal` 组件
   - 添加 `terminalVisible` 状态变量
   - 更新 `handleOpenTerminal` 函数，直接显示Terminal而不是跳转页面
   - 在组件末尾添加 `WebTerminal` 组件

3. **复用环境列表页的逻辑**：
   - 使用相同的检查逻辑（只允许运行中的Ray环境）
   - 使用相同的错误提示信息
   - 使用相同的WebTerminal组件

## 功能特点

### 环境详情页Terminal入口
- ✅ Terminal按钮只在环境状态为 `running` 时启用
- ✅ 只支持 `ray` 框架的环境
- ✅ 点击按钮直接弹出Terminal对话框
- ✅ 使用与环境列表页相同的WebTerminal组件
- ✅ 传递正确的环境名称和命名空间参数

### 用户体验
- ✅ 一致的操作体验（与环境列表页相同）
- ✅ 清晰的状态提示和错误处理
- ✅ 无需页面跳转，直接在当前页面打开Terminal

## 测试步骤

1. 访问环境详情页：`http://localhost:5173/environments/{env-id}`
2. 确保环境状态为 "running" 且框架为 "ray"
3. 点击 "Terminal" 按钮
4. 应该弹出Terminal对话框并连接到环境的head pod

## 技术实现

### 关键代码变更

```typescript
// 添加WebTerminal导入
import WebTerminal from '../components/WebTerminal';

// 添加Terminal状态
const [terminalVisible, setTerminalVisible] = useState(false);

// 更新Terminal处理函数
const handleOpenTerminal = () => {
  if (!detail) return;
  
  if (detail.status !== 'running') {
    MessagePlugin.warning('Only running environments can be connected');
    return;
  }
  if (detail.framework !== 'ray') {
    MessagePlugin.warning('Terminal connection is only available for Ray environments');
    return;
  }
  
  setTerminalVisible(true);
};

// 添加WebTerminal组件
{detail && (
  <WebTerminal
    visible={terminalVisible}
    onClose={() => setTerminalVisible(false)}
    envName={detail.name}
    namespace={detail.namespace}
  />
)}
```

## 结果

现在环境详情页的Terminal入口可以正常使用，与环境列表页保持一致的用户体验！