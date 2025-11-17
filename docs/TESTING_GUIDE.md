# Web终端功能测试指南

## 测试环境状态

### ✅ 服务已启动

- **后端API服务**: http://localhost:8080
- **前端开发服务**: http://localhost:5173
- **集群连接状态**: 已连接到 cls-cluster (context: cls)

## 测试步骤

### 1. 访问前端界面

打开浏览器访问：http://localhost:5173

### 2. 验证集群连接

1. 查看顶部导航栏，应显示"已连接"状态
2. 集群名称应显示为"cls-cluster"

### 3. 创建Ray环境（如果还没有）

1. 进入"环境管理"页面
2. 点击"创建环境"按钮
3. 填写以下信息：
   - 名称：test-ray-terminal
   - 框架：Ray
   - 镜像：rayproject/ray:2.9.0（默认）
   - Worker数量：1
   - Namespace：default
4. 点击"创建"
5. 等待环境状态变为"running"（可能需要1-2分钟）

### 4. 测试Web终端连接

#### 步骤A：打开终端
1. 在环境列表中找到状态为"running"的Ray环境
2. 点击操作列中的"Terminal"按钮（💻图标）
3. 观察终端弹窗打开

#### 步骤B：验证连接状态
1. 查看弹窗标题栏右侧的连接状态
2. 应显示"● Connected"（绿色）
3. 终端中应显示欢迎消息：
   ```
   ✓ Connected to Ray Head Pod
   Connected to Ray Head Pod: <pod-name>
   ```

#### 步骤C：执行测试命令

在终端中依次执行以下命令：

```bash
# 1. 测试基本命令
pwd
ls -la

# 2. 查看Ray集群状态
ray status

# 3. 检查Python环境
python --version
python -c "import ray; print(f'Ray version: {ray.__version__}')"

# 4. 查看环境变量
env | grep RAY

# 5. 查看系统资源
free -h
df -h

# 6. 测试Ray功能
python -c "import ray; ray.init(); print('Ray initialized successfully')"
```

#### 步骤D：测试终端功能

1. **测试输入响应**：
   - 输入命令并按回车
   - 验证命令执行结果正确显示

2. **测试终端尺寸**：
   - 调整浏览器窗口大小
   - 验证终端自动适配

3. **测试特殊字符**：
   ```bash
   echo "Hello 世界"
   echo "Special chars: !@#$%^&*()"
   ```

4. **测试命令历史**：
   - 按上下箭头键
   - 验证可以浏览命令历史

5. **测试Tab补全**：
   ```bash
   cd /tmp
   ls -l<Tab>  # 按Tab键
   ```

#### 步骤E：测试断线重连

1. 在终端中执行：`exit`
2. 观察连接状态变为"● Disconnected"（红色）
3. 关闭弹窗
4. 重新点击"Terminal"按钮
5. 验证可以重新连接

### 5. 测试边界情况

#### 测试1：非Running状态环境
1. 找到状态为"pending"或"stopped"的环境
2. 验证"Terminal"按钮为禁用状态

#### 测试2：非Ray环境
1. 如果有其他框架的环境（Horovod/DeepSpeed）
2. 验证这些环境没有"Terminal"按钮

#### 测试3：多终端会话
1. 打开第一个终端
2. 在新标签页中打开同一环境的第二个终端
3. 验证两个终端可以独立工作

#### 测试4：长时间连接
1. 保持终端连接5分钟以上
2. 执行命令验证连接仍然有效

## 预期结果

### ✅ 成功标准

- [ ] 终端弹窗正常打开
- [ ] 连接状态正确显示
- [ ] 可以执行基本Shell命令
- [ ] Ray命令正常工作
- [ ] 终端输出格式正确
- [ ] 中文字符显示正常
- [ ] 特殊字符处理正确
- [ ] 命令历史功能正常
- [ ] 窗口尺寸自适应
- [ ] 断线重连功能正常
- [ ] 多会话隔离正常

### ❌ 常见问题

#### 问题1：连接失败
**现象**：点击Terminal按钮后显示"Connection error"

**排查步骤**：
```bash
# 1. 检查Ray Head Pod状态
kubectl get pods -n default -l ray.io/node-type=head

# 2. 查看Pod日志
kubectl logs -n default <ray-head-pod-name>

# 3. 检查后端日志
# 查看终端输出的后端日志

# 4. 检查WebSocket连接
# 打开浏览器开发者工具 -> Network -> WS
```

#### 问题2：终端无响应
**现象**：终端已连接但输入无反应

**排查步骤**：
```bash
# 1. 检查WebSocket连接状态
# 浏览器开发者工具 -> Console

# 2. 检查Pod容器状态
kubectl describe pod <ray-head-pod-name> -n default

# 3. 重启连接
# 关闭终端弹窗，重新打开
```

#### 问题3：中文乱码
**现象**：中文字符显示为乱码

**解决方案**：
```bash
# 在终端中执行
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
```

## 性能测试

### 延迟测试
```bash
# 在终端中执行
time echo "test"
# 应在100ms内返回结果
```

### 吞吐量测试
```bash
# 输出大量文本
cat /var/log/syslog | head -1000
# 验证输出流畅，无卡顿
```

### 并发测试
1. 同时打开3个终端会话
2. 在每个终端中执行不同命令
3. 验证互不干扰

## 测试报告模板

```markdown
## Web终端功能测试报告

**测试时间**: YYYY-MM-DD HH:MM
**测试人员**: [Your Name]
**环境**: 
- 集群: cls-cluster
- Ray版本: 2.9.0
- 浏览器: Chrome/Firefox/Safari

### 功能测试结果

| 测试项 | 状态 | 备注 |
|--------|------|------|
| 终端连接 | ✅/❌ | |
| 命令执行 | ✅/❌ | |
| Ray命令 | ✅/❌ | |
| 中文显示 | ✅/❌ | |
| 尺寸调整 | ✅/❌ | |
| 断线重连 | ✅/❌ | |
| 多会话 | ✅/❌ | |

### 性能测试结果

- 连接建立时间: ___ ms
- 命令响应延迟: ___ ms
- 大文本输出流畅度: ✅/❌

### 发现的问题

1. [问题描述]
   - 重现步骤：
   - 预期结果：
   - 实际结果：
   - 严重程度：高/中/低

### 改进建议

1. [建议内容]

### 总体评价

[测试总结]
```

## 下一步

测试完成后，可以：
1. 记录测试结果
2. 报告发现的问题
3. 提出改进建议
4. 继续开发其他功能（训练管理、监控诊断等）