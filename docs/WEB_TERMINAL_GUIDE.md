# Web终端连接Ray Head节点使用指南

## 功能概述

Web终端功能允许用户直接在浏览器中连接到Ray集群的Head节点，无需本地安装kubectl或其他工具，即可进行交互式Shell操作。

## 技术架构

```
浏览器 (xterm.js) 
    ↓ WebSocket
Go API Server (Gorilla WebSocket)
    ↓ SPDY Protocol
Kubernetes API Server
    ↓ exec
Ray Head Pod (bash shell)
```

## 功能特性

- ✅ **浏览器内终端**：基于xterm.js的全功能终端模拟器
- ✅ **实时交互**：通过WebSocket实现双向实时通信
- ✅ **自适应尺寸**：终端窗口自动适配浏览器大小
- ✅ **状态指示**：实时显示连接状态（连接中/已连接/已断开）
- ✅ **安全隔离**：每个用户会话独立，互不干扰
- ✅ **优雅断线**：支持连接关闭和错误处理

## 使用步骤

### 1. 前置条件

- 已连接到Kubernetes集群
- 已创建Ray环境且状态为"运行中"
- Ray Head Pod已就绪

### 2. 连接终端

1. 进入"环境管理"页面
2. 找到目标Ray环境（状态必须为"running"）
3. 点击操作列中的"Terminal"按钮（💻图标）
4. 等待终端弹窗打开并建立连接

### 3. 使用终端

连接成功后，您可以：

```bash
# 查看Ray集群状态
ray status

# 查看Python版本
python --version

# 列出当前目录文件
ls -la

# 查看环境变量
env | grep RAY

# 运行Python脚本
python -c "import ray; print(ray.__version__)"

# 查看Ray Dashboard地址
echo $RAY_DASHBOARD_HOST

# 退出终端
exit
```

### 4. 关闭终端

- 点击弹窗右上角的关闭按钮
- 或在终端中输入 `exit` 命令

## 技术实现细节

### 后端实现 (cmd/api-server/terminal.go)

**核心组件：**
- `TerminalSession`：管理WebSocket连接和终端会话
- `handleTerminalConnect`：处理WebSocket升级和连接
- `findRayHeadPod`：查找Ray Head Pod

**关键功能：**
```go
// WebSocket消息格式
type TerminalMessage struct {
    Type string `json:"type"` // "input", "resize", "ping"
    Data string `json:"data"` // 终端输入数据
    Rows uint16 `json:"rows,omitempty"` // 终端行数
    Cols uint16 `json:"cols,omitempty"` // 终端列数
}
```

**连接流程：**
1. 升级HTTP连接为WebSocket
2. 查找Ray Head Pod
3. 创建Kubernetes exec请求
4. 建立SPDY流连接
5. 双向数据传输

### 前端实现 (frontend/src/components/WebTerminal.tsx)

**核心依赖：**
- `xterm`：终端模拟器核心库
- `xterm-addon-fit`：自适应尺寸插件
- `xterm-addon-web-links`：链接点击支持

**主要功能：**
```typescript
// 终端配置
const terminal = new Terminal({
  cursorBlink: true,
  fontSize: 14,
  theme: { /* 自定义主题 */ },
  rows: 30,
  cols: 100,
});

// WebSocket连接
const ws = new WebSocket(
  `ws://localhost:8080/api/terminal/connect?name=${envName}&namespace=${namespace}`
);

// 处理终端输入
terminal.onData((data) => {
  ws.send(JSON.stringify({ type: 'input', data }));
});

// 处理终端输出
ws.onmessage = (event) => {
  terminal.write(event.data);
};
```

## API接口

### WebSocket连接端点

```
ws://localhost:8080/api/terminal/connect
```

**查询参数：**
- `name`：环境名称（必需）
- `namespace`：命名空间（必需）

**消息格式：**

客户端发送：
```json
{
  "type": "input",
  "data": "ls -la\n"
}
```

服务端发送：
```
原始终端输出数据（字节流）
```

## 故障排查

### 连接失败

**问题：** 点击Terminal按钮后无法连接

**可能原因：**
1. Ray Head Pod未就绪
2. WebSocket连接被防火墙阻止
3. 后端服务未启动

**解决方案：**
```bash
# 检查Pod状态
kubectl get pods -n <namespace> -l ray.io/node-type=head

# 检查Pod日志
kubectl logs -n <namespace> <ray-head-pod-name>

# 检查后端服务
curl http://localhost:8080/api/cluster/status
```

### 终端无响应

**问题：** 终端已连接但输入无响应

**可能原因：**
1. WebSocket连接中断
2. Pod容器崩溃
3. 网络延迟过高

**解决方案：**
- 刷新页面重新连接
- 检查Pod状态
- 查看浏览器控制台错误信息

### 中文显示乱码

**问题：** 终端中文字符显示异常

**解决方案：**
```bash
# 在终端中设置UTF-8编码
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
```

## 安全注意事项

1. **访问控制**：确保只有授权用户可以访问终端
2. **命令审计**：建议记录所有终端操作日志
3. **资源限制**：避免在终端中执行资源密集型操作
4. **敏感信息**：不要在终端中输入密码等敏感信息

## 最佳实践

1. **使用前检查**：确认环境状态为"running"
2. **及时关闭**：使用完毕后及时关闭终端连接
3. **避免长时间运行**：不要在终端中运行长时间任务
4. **使用Ray命令**：优先使用Ray提供的管理命令

## 常用命令参考

```bash
# Ray集群管理
ray status                    # 查看集群状态
ray list actors              # 列出所有actors
ray list tasks               # 列出所有tasks
ray memory                   # 查看内存使用

# 系统信息
top                          # 查看进程
df -h                        # 查看磁盘使用
free -h                      # 查看内存使用
nvidia-smi                   # 查看GPU状态（如果有）

# Python环境
pip list                     # 查看已安装包
python -m ray.scripts.scripts status  # Ray状态脚本
```

## 未来改进

- [ ] 支持多标签页（同时连接多个Pod）
- [ ] 添加命令历史记录
- [ ] 支持文件上传/下载
- [ ] 添加终端录制功能
- [ ] 支持自定义终端主题
- [ ] 添加命令自动补全

## 相关文档

- [xterm.js 官方文档](https://xtermjs.org/)
- [Kubernetes Pod Exec API](https://kubernetes.io/docs/tasks/debug/debug-application/get-shell-running-container/)
- [Gorilla WebSocket](https://github.com/gorilla/websocket)
- [Ray 官方文档](https://docs.ray.io/)