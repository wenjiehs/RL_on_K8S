# Parquet预览功能浏览器测试指南

## 测试环境

- **前端地址**：http://localhost:5173
- **后端地址**：http://localhost:8080
- **测试数据路径**：`/tmp/rl-data/exp-001/`

## 已生成的测试数据

### 1. 训练数据 (Training Data)
- **路径**：`/tmp/rl-data/exp-001/train/2025-11-17/training_episodes.parquet`
- **行数**：1000
- **列数**：10
- **Schema**：
  - episode_id (int64)
  - timestamp (datetime)
  - state_dim_0, state_dim_1, state_dim_2 (float64)
  - action (int64)
  - reward (float64)
  - done (bool)
  - q_value (float64)
  - loss (float64)

### 2. 评估数据 (Evaluation Data)
- **路径**：`/tmp/rl-data/exp-001/eval/2025-11-17/evaluation_results.parquet`
- **行数**：100
- **列数**：7
- **Schema**：
  - episode_id (int64)
  - total_reward (float64)
  - episode_length (int64)
  - success_rate (float64)
  - avg_q_value (float64)
  - exploration_rate (float64)
  - timestamp (datetime)

### 3. 模型元数据 (Model Metadata)
- **路径**：`/tmp/rl-data/exp-001/model/2025-11-17/checkpoint_metadata.parquet`
- **行数**：5
- **列数**：8
- **Schema**：
  - checkpoint_id (string)
  - epoch (int64)
  - train_loss (float64)
  - val_loss (float64)
  - accuracy (float64)
  - learning_rate (float64)
  - timestamp (datetime)
  - model_size_mb (float64)

## 浏览器测试步骤

### 步骤1：访问数据集管理页面

1. 打开浏览器访问：**http://localhost:5173**
2. 点击顶部导航栏的 **"环境管理"** 菜单
3. 在页面中找到 **Tab导航栏**，点击 **"数据集管理"** 标签页

### 步骤2：创建测试数据集

1. 点击页面右上角的 **"创建数据集"** 按钮
2. 在弹出的对话框中填写：
   - **数据集名称**：`test-dataset-001`
   - **实验ID**：`exp-001`
   - **数据类型**：选择 `train`（训练数据）
   - **描述**：`测试Parquet预览功能的训练数据集`
   - **集群Context**：选择当前连接的集群
3. 点击 **"创建"** 按钮
4. 等待创建成功提示

### 步骤3：打开文件浏览器

1. 在数据集列表中找到刚创建的 `test-dataset-001`
2. 点击该数据集行右侧的 **"浏览"** 按钮（图标：📁）
3. 文件浏览器对话框将从右侧滑出

### 步骤4：导航到Parquet文件

文件浏览器界面说明：
- **左侧面板**：快速导航（根目录、最近访问）
- **右侧面板**：文件列表（支持列表/网格视图切换）
- **顶部工具栏**：路径导航、搜索、视图切换

导航步骤：
1. 在文件列表中，双击 **`train`** 文件夹
2. 双击 **`2025-11-17`** 文件夹
3. 现在应该能看到 **`training_episodes.parquet`** 文件

### 步骤5：预览Parquet文件

1. 找到 `training_episodes.parquet` 文件
2. 点击文件行右侧的 **"预览"** 按钮（图标：👁️）
3. 预览抽屉将从右侧滑出，显示以下内容：

#### 预览内容说明

**A. 文件基本信息**
- 文件名：training_episodes.parquet
- 文件大小：约 XX KB
- 修改时间：2025-11-17

**B. Schema信息（列定义）**
- 以彩色Tag形式展示所有列
- 每个Tag显示：`列名 (数据类型)`
- 例如：`episode_id (INT64)`, `reward (DOUBLE)`, `done (BOOLEAN)`

**C. 数据预览表格**
- 显示前100行数据（默认）
- 表格列标题包含列名和类型
- 支持横向滚动查看所有列
- 空值显示为灰色 `null`
- 对象类型自动JSON序列化

**D. 统计信息**
- 总行数：1000
- 预览行数：100
- Schema列数：10

### 步骤6：测试其他Parquet文件

重复步骤3-5，测试其他两个Parquet文件：

1. **评估数据**：
   - 路径：`eval/2025-11-17/evaluation_results.parquet`
   - 预期：100行，7列

2. **模型元数据**：
   - 路径：`model/2025-11-17/checkpoint_metadata.parquet`
   - 预期：5行，8列

## 预期结果验证

### ✅ 成功标准

1. **文件浏览器**
   - ✅ 能够正常打开文件浏览器对话框
   - ✅ 左侧导航面板显示正确
   - ✅ 文件列表正确显示目录和文件
   - ✅ 双击文件夹能够进入子目录
   - ✅ 路径导航面包屑正确显示当前位置

2. **Parquet预览**
   - ✅ 点击预览按钮后抽屉正常打开
   - ✅ Schema标签正确显示所有列名和类型
   - ✅ 数据表格正确显示前100行
   - ✅ 列类型标注清晰（在列标题中）
   - ✅ 空值显示为灰色"null"
   - ✅ 统计信息（总行数、预览行数）正确

3. **UI/UX体验**
   - ✅ 页面加载流畅，无明显卡顿
   - ✅ 表格支持横向滚动
   - ✅ 颜色主题符合设计规范
   - ✅ 关闭抽屉后能返回文件列表

### ❌ 常见问题排查

#### 问题1：文件浏览器打开后显示空白
**可能原因**：
- 后端服务未启动
- API路径配置错误
- 数据集路径不存在

**解决方法**：
```bash
# 检查后端服务
lsof -ti:8080

# 检查数据文件
ls -la /tmp/rl-data/exp-001/train/2025-11-17/

# 查看后端日志
tail -50 /tmp/api-server.log
```

#### 问题2：Parquet预览显示404错误
**可能原因**：
- Parquet预览API路由未注册
- 文件路径错误
- parquet-go依赖未安装

**解决方法**：
```bash
# 检查API路由
curl "http://localhost:8080/api/datasets/parquet-preview?path=/tmp/rl-data/exp-001/train/2025-11-17/training_episodes.parquet"

# 检查依赖
cd cmd/api-server && go list -m github.com/xitongsys/parquet-go
```

#### 问题3：Schema或数据显示不正确
**可能原因**：
- Parquet文件损坏
- 解析逻辑错误
- 前端数据渲染问题

**解决方法**：
```bash
# 重新生成测试数据
python3 scripts/generate_test_parquet_local.py

# 使用parquet-tools验证文件
pip install parquet-tools
parquet-tools show /tmp/rl-data/exp-001/train/2025-11-17/training_episodes.parquet
```

## API测试（可选）

如果浏览器测试遇到问题，可以先通过API测试验证后端功能：

### 测试Parquet预览API

```bash
# 测试训练数据
curl "http://localhost:8080/api/datasets/parquet-preview?path=/tmp/rl-data/exp-001/train/2025-11-17/training_episodes.parquet" | jq

# 测试评估数据
curl "http://localhost:8080/api/datasets/parquet-preview?path=/tmp/rl-data/exp-001/eval/2025-11-17/evaluation_results.parquet" | jq

# 测试模型元数据
curl "http://localhost:8080/api/datasets/parquet-preview?path=/tmp/rl-data/exp-001/model/2025-11-17/checkpoint_metadata.parquet" | jq
```

### 预期API响应格式

```json
{
  "type": "parquet",
  "schema": [
    {
      "name": "episode_id",
      "type": "INT64"
    },
    {
      "name": "reward",
      "type": "DOUBLE"
    }
  ],
  "data": [
    {
      "episode_id": 0,
      "reward": 0.123
    }
  ],
  "totalRows": 1000,
  "previewRows": 100
}
```

## 测试完成后

测试完成后，请记录以下信息：

1. **功能测试结果**
   - [ ] 文件浏览器正常工作
   - [ ] Parquet预览正常显示
   - [ ] Schema信息正确
   - [ ] 数据表格正确
   - [ ] UI/UX体验良好

2. **发现的问题**
   - 问题描述
   - 复现步骤
   - 错误截图
   - 浏览器控制台日志

3. **改进建议**
   - UI优化建议
   - 功能增强建议
   - 性能优化建议

## 下一步

测试通过后，可以继续开发：
- 环境数据挂载功能
- Sidecar容器集成
- 数据版本控制
- 审计日志功能