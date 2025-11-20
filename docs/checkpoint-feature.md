# Checkpoint 功能文档

## 功能概述

Checkpoint功能允许用户在训练任务详情页查看、下载和删除模型检查点文件。

## 架构设计

### 存储路径规范

**统一路径标识符**: 为了避免路径混乱，系统**统一使用 `jobName` 作为路径标识符**。

- **标准路径格式**: `/mnt/cfs-turbo/cfs/{job-name}/checkpoint`
- **优先级规则**: 
  1. 如果数据库中配置了 `outputDirectory`，直接使用
  2. 如果没有配置，使用 `jobName` 自动生成路径
- **示例**: 
  - Job Name: `test-gpu-manual` → 路径: `/mnt/cfs-turbo/cfs/test-gpu-manual/checkpoint`
  - Job Name: `train1` → 路径: `/mnt/cfs-turbo/cfs/train1/checkpoint`

**设计原因**:
- ❌ **旧方案问题**: 前端使用 `Date.now()` (毫秒)，后端使用 `time.Now().Unix()` (秒) 生成不同的 ID，导致路径不一致
- ✅ **新方案优势**: 使用用户定义的 `jobName`，路径更易识别，且前后端完全一致

### 数据流程
```
前端 → API Server → CFS Data Accessor Pod → CFS存储
```

## API接口

### 1. 列出Checkpoints
**接口**: `GET /api/training-jobs/checkpoints?id={jobId}`

**响应**:
```json
{
  "success": true,
  "checkpoints": [
    {
      "name": "checkpoint-1000.pt",
      "path": "/mnt/cfs-turbo/cfs/job-001/checkpoint/checkpoint-1000.pt",
      "size": 2147483648,
      "sizeStr": "2.00 GB",
      "step": 1000,
      "loss": 0.42,
      "timestamp": "2025-11-20T15:30:00Z"
    }
  ],
  "jobId": "job-001"
}
```

### 2. 下载Checkpoint
**接口**: `GET /api/training-jobs/checkpoint/download?id={jobId}&path={checkpointPath}`

**说明**: 
- 流式下载checkpoint文件
- 通过cfs-data-accessor的HTTP服务(端口8080)下载
- 设置Content-Disposition头触发浏览器下载

### 3. 删除Checkpoint
**接口**: `DELETE /api/training-jobs/checkpoint/delete?id={jobId}&path={checkpointPath}`

**响应**:
```json
{
  "success": true,
  "message": "Checkpoint deleted successfully"
}
```

## 前端组件

### CheckpointManager组件

**位置**: `frontend/src/components/CheckpointManager.tsx`

**功能**:
- 展示checkpoint列表（名称、步数、Loss、大小、时间）
- 下载checkpoint文件
- 删除checkpoint（带二次确认）
- 自动刷新（训练运行中每30秒刷新一次）

**使用方式**:
```tsx
import CheckpointManager from '../components/CheckpointManager';

<CheckpointManager jobId={jobData.id} jobStatus={jobData.status} />
```

## 后端实现

### 文件: `cmd/api-server/checkpoint-handlers.go`

**主要函数**:
1. `handleListCheckpointsHandler` - 处理列表请求
2. `listCheckpointsFromCFSAccessor` - 从CFS Data Accessor获取文件列表
3. `handleDownloadCheckpointHandler` - 处理下载请求
4. `downloadFileFromCFSAccessor` - 流式下载文件
5. `handleDeleteCheckpointHandler` - 处理删除请求
6. `deleteCheckpointViaCFSAccessor` - 执行删除操作

**辅助函数**:
- `formatSize` - 格式化文件大小
- `extractStepFromFilename` - 从文件名提取训练步数
- `parseTimestamp` - 解析时间戳

## 技术特点

### 1. 统一路径标识符
- **强制使用 jobName**: 所有新创建的训练任务都使用 `jobName` 作为路径标识符
- **自动路径生成**: 如果未指定 `outputDirectory`，系统自动使用 `jobName` 生成
- **一致性保证**: 前端、后端、训练命令中的路径完全一致

### 2. 统一存储访问
- 所有checkpoint访问通过cfs-data-accessor Pod统一管理
- 避免直接挂载CFS到API Server，简化架构

### 3. 流式传输
- 使用`io.Copy`实现大文件流式下载
- 降低内存占用，支持GB级文件下载

### 4. 智能解析
- 自动从文件名提取训练步数（支持多种命名格式）
- 支持时间戳解析和格式化

### 5. 安全隔离
- 所有文件操作在cfs-data-accessor Pod中执行
- API Server仅负责请求转发和流式传输

## 支持的Checkpoint命名格式

系统支持以下checkpoint文件命名格式：
- `checkpoint-{step}` (如: checkpoint-1000)
- `step_{step}.pt` (如: step_1000.pt)
- `step{step}` (如: step1000)
- `model-{step}.bin` (如: model-1000.bin)
- `checkpoint_step{step}.pth` (如: checkpoint_step1000.pth)

## 测试方法

### 1. 创建测试checkpoint（使用 jobName）
在cfs-data-accessor Pod中创建测试文件：
```bash
kubectl exec -it -n rl cfs-data-accessor-xxx -- sh
mkdir -p /mnt/cfs-turbo/cfs/my-training-job/checkpoint
echo "test checkpoint" > /mnt/cfs-turbo/cfs/my-training-job/checkpoint/checkpoint-1000.pt
```

### 2. 验证路径一致性
确保以下路径都使用 `jobName`:
- 数据库 `outputDirectory` 字段
- 训练命令中的 `trainer.default_local_dir`
- 日志文件路径 `tee /mnt/cfs-turbo/cfs/{jobName}/checkpoint/training.log`
- Checkpoint 列表API返回的路径

### 3. 验证功能
1. 访问训练任务详情页
2. 查看checkpoint列表
3. 测试下载功能
4. 测试删除功能（带确认对话框）

## 未来扩展

可能的功能扩展：
1. 支持从checkpoint文件读取Loss、Accuracy等指标
2. 支持checkpoint对比功能
3. 支持checkpoint自动备份
4. 支持从checkpoint恢复训练
5. 支持checkpoint版本管理

## 注意事项

1. **路径规范**: 系统统一使用 `jobName` 作为路径标识符
2. **命名建议**: jobName 应使用有意义的名称，避免特殊字符（推荐使用字母、数字、连字符）
3. 确保cfs-data-accessor Pod正常运行
4. 确保CFS存储已正确挂载
5. 大文件下载可能需要较长时间
6. 删除操作不可恢复，请谨慎操作
7. 训练运行中的checkpoint可能正在写入，删除需谨慎

## 迁移指南（针对旧数据）

如果您有使用旧路径格式（基于 jobID 或 environmentID）的训练任务：

1. **查看当前数据库配置**:
   ```bash
   sqlite3 training.db "SELECT id, name, output_directory FROM training_jobs;"
   ```

2. **更新为 jobName 格式**:
   ```bash
   sqlite3 training.db "UPDATE training_jobs SET output_directory='/mnt/cfs-turbo/cfs/' || name || '/checkpoint' WHERE output_directory LIKE '%job-%';"
   ```

3. **迁移实际文件**（如果需要）:
   ```bash
   kubectl exec -it -n rl cfs-data-accessor-xxx -- sh
   mv /mnt/cfs-turbo/cfs/job-1763646388 /mnt/cfs-turbo/cfs/train1
   ```
