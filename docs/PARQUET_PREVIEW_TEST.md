# Parquet文件预览功能测试指南

## 功能概述

Parquet预览功能允许用户在Web界面中直接查看Parquet文件的Schema和数据内容，无需下载文件。

## 测试准备

### 1. 安装Python依赖

```bash
pip install pandas pyarrow numpy
```

### 2. 生成测试数据

```bash
# 运行测试数据生成脚本
python3 scripts/generate_test_parquet.py
```

脚本将创建以下测试文件：
- `/cfs/rl-data/exp-001/train/2025-11-17/training_episodes.parquet` (1000行)
- `/cfs/rl-data/exp-001/eval/2025-11-17/evaluation_results.parquet` (100行)
- `/cfs/rl-data/exp-001/model/2025-11-17/checkpoint_metadata.parquet` (5行)
- `/cfs/rl-data/exp-001/raw/2025-11-17/raw_episodes.csv`
- `/cfs/rl-data/exp-001/raw/2025-11-17/config.json`

### 3. 启动服务

**后端服务：**
```bash
cd cmd/api-server
go run *.go
```

**前端服务：**
```bash
cd frontend
npm run dev
```

## 测试步骤

### 步骤1：访问数据集管理页面

1. 打开浏览器访问 http://localhost:5173
2. 连接到Kubernetes集群
3. 点击顶部导航栏的"环境管理"
4. 切换到"数据集管理"标签页

### 步骤2：创建数据集

1. 点击"创建数据集"按钮
2. 填写表单：
   - 名称：`test-dataset-001`
   - 实验ID：`exp-001`
   - 数据类型：选择 `train`、`eval` 或 `model`
   - 描述：`测试Parquet预览功能`
3. 点击"确定"创建数据集

### 步骤3：浏览文件

1. 在数据集列表中找到刚创建的数据集
2. 点击"浏览"按钮打开文件浏览器
3. 在左侧导航面板中点击对应的数据类型目录
4. 在右侧文件列表中找到 `.parquet` 文件

### 步骤4：预览Parquet文件

1. 点击Parquet文件名或"预览"按钮
2. 预览抽屉将从右侧滑出

## 预期结果

### Schema展示
- ✅ 显示"Parquet文件预览"标题
- ✅ Schema以Tag标签形式展示
- ✅ 每个Tag显示：`列名 (数据类型)`
- ✅ Tag使用不同颜色区分

### 数据表格
- ✅ 表格显示前100行数据
- ✅ 列标题显示列名和类型
- ✅ 数据正确对齐
- ✅ 空值显示为灰色"null"
- ✅ 对象类型自动JSON序列化
- ✅ 表格支持横向滚动

### 统计信息
- ✅ 显示总行数：`总行数: 1000`（训练数据）
- ✅ 显示预览行数：`预览行数: 100`

## 测试用例

### 用例1：训练数据预览
**文件：** `training_episodes.parquet`
**预期Schema：**
- episode_id (INT64)
- timestamp (TIMESTAMP)
- state_dim_0 (DOUBLE)
- state_dim_1 (DOUBLE)
- state_dim_2 (DOUBLE)
- action (BYTE_ARRAY)
- reward (DOUBLE)
- done (BOOLEAN)
- q_value (DOUBLE)
- loss (DOUBLE)

**预期数据：** 1000行，显示前100行

### 用例2：评估数据预览
**文件：** `evaluation_results.parquet`
**预期Schema：**
- episode_id (INT64)
- total_reward (DOUBLE)
- episode_length (INT64)
- success_rate (DOUBLE)
- avg_q_value (DOUBLE)
- exploration_rate (DOUBLE)
- timestamp (TIMESTAMP)

**预期数据：** 100行，全部显示

### 用例3：模型元数据预览
**文件：** `checkpoint_metadata.parquet`
**预期Schema：**
- checkpoint_id (BYTE_ARRAY)
- epoch (INT64)
- train_loss (DOUBLE)
- val_loss (DOUBLE)
- accuracy (DOUBLE)
- learning_rate (DOUBLE)
- timestamp (TIMESTAMP)
- model_size_mb (DOUBLE)

**预期数据：** 5行，全部显示

## API测试

### 直接测试API端点

```bash
# 测试Parquet预览API
curl "http://localhost:8080/api/datasets/parquet-preview?path=/cfs/rl-data/exp-001/train/2025-11-17/training_episodes.parquet" | jq .
```

**预期响应：**
```json
{
  "type": "parquet",
  "schema": [
    {"name": "episode_id", "type": "INT64"},
    {"name": "timestamp", "type": "TIMESTAMP"},
    ...
  ],
  "data": [
    {
      "episode_id": 0,
      "timestamp": "2025-11-17T19:00:00Z",
      ...
    },
    ...
  ],
  "totalRows": 1000,
  "previewRows": 100,
  "message": "Showing first 100 of 1000 rows"
}
```

## 常见问题

### Q1: 文件路径不存在
**问题：** 提示"文件不存在"
**解决：** 确保已运行 `generate_test_parquet.py` 脚本生成测试数据

### Q2: 权限错误
**问题：** 提示"权限被拒绝"
**解决：** 检查 `/cfs/rl-data` 目录权限，确保API服务有读取权限

### Q3: Parquet解析失败
**问题：** 提示"Failed to create parquet reader"
**解决：** 
1. 检查文件是否损坏
2. 确保parquet-go库已正确安装
3. 查看后端日志获取详细错误信息

### Q4: 前端显示异常
**问题：** 表格显示不正常或数据错乱
**解决：**
1. 打开浏览器开发者工具查看Console错误
2. 检查API响应数据格式是否正确
3. 清除浏览器缓存重试

## 性能测试

### 大文件测试
创建包含10000+行的Parquet文件测试：
```python
# 修改 generate_test_parquet.py 中的 n_samples
n_samples = 10000  # 原值为1000
```

**预期行为：**
- ✅ 仍然只预览前100行
- ✅ 加载时间 < 2秒
- ✅ 内存占用合理

## 下一步

测试完成后，可以继续开发：
1. 环境数据挂载功能
2. Sidecar容器集成
3. 数据版本控制
4. 审计日志功能