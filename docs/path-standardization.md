# 路径标准化方案

## 背景

在实现训练任务和 Checkpoint 功能时，发现路径标识符存在不一致的问题：

### 问题示例
```
数据库 outputDirectory: /mnt/cfs-turbo/cfs/job-1763646365504/checkpoint  (前端生成)
实际 jobID:            job-1763646388                                     (后端生成)
训练命令路径:          /mnt/cfs-turbo/cfs/job-1763646388/checkpoint       (使用 jobID)
```

### 根本原因
1. **前端**: 使用 `Date.now()` (JavaScript 毫秒级时间戳) 生成 outputDirectory
2. **后端**: 使用 `time.Now().Unix()` (Go 秒级时间戳) 生成 jobID
3. 两者在不同时间点调用，且精度不同，导致生成的 ID 完全不匹配

## 解决方案

**统一使用 `jobName` 作为路径标识符**

### 优势
1. ✅ **用户友好**: jobName 由用户定义，语义清晰（如 `train1`, `test-gpu-manual`）
2. ✅ **一致性强**: 前后端都使用同一个 jobName，不会出现不一致
3. ✅ **易于调试**: 路径直接反映任务名称，便于问题排查
4. ✅ **向后兼容**: 通过优先级检测机制，兼容旧的路径格式

### 标准路径格式
```
/mnt/cfs-turbo/cfs/{jobName}/checkpoint
```

### 示例
| Job Name | 路径 |
|----------|------|
| train1 | /mnt/cfs-turbo/cfs/train1/checkpoint |
| test-gpu-manual | /mnt/cfs-turbo/cfs/test-gpu-manual/checkpoint |
| dpo-llama-7b | /mnt/cfs-turbo/cfs/dpo-llama-7b/checkpoint |

## 实施细节

### 1. 前端修改 (CreateTrainingJobDialog.tsx)

**修改前**:
```typescript
const generateOutputDirectory = () => {
  if (!formData.jobName) return '';
  const jobId = `job-${Date.now()}`;  // ❌ 生成随机ID
  return `/mnt/cfs-turbo/cfs/${jobId}/checkpoint`;
};
```

**修改后**:
```typescript
// ✅ 删除 generateOutputDirectory 函数
// 在"自动创建环境"模式下，outputDirectory 留空，由后端生成
```

### 2. 后端修改 (training-job-create.go)

**修改前**:
```go
// 直接保存到数据库，outputDirectory 可能是前端生成的错误路径
```

**修改后**:
```go
// 如果没有指定输出目录，使用 jobName 生成
if req.OutputDirectory == "" {
    req.OutputDirectory = fmt.Sprintf("/mnt/cfs-turbo/cfs/%s/checkpoint", req.JobName)
    log.Printf("Output directory not specified, using job name: %s", req.OutputDirectory)
}
```

### 3. 训练命令生成 (training-job-command.go)

**修改前**:
```go
outputDir := job.OutputDirectory
if outputDir == "" {
    outputDir = fmt.Sprintf("/mnt/cfs-turbo/cfs/%s/checkpoint", job.ID)  // ❌ 使用 jobID
}
```

**修改后**:
```go
outputDir := job.OutputDirectory
if outputDir == "" {
    outputDir = fmt.Sprintf("/mnt/cfs-turbo/cfs/%s/checkpoint", job.Name)  // ✅ 使用 jobName
}
```

### 4. Checkpoint 路径检测 (checkpoint-handlers.go)

**优先级顺序**:
1. **outputDirectory** (最高优先级 - 如果已配置)
2. **jobName** (标准路径)

**修改前**:
```go
// 尝试多个路径：outputDirectory > environmentID > jobName > jobID
checkpointPaths := []string{
    outputDirectory,
    fmt.Sprintf("/mnt/cfs-turbo/cfs/%s/checkpoint", environmentID),
    fmt.Sprintf("/mnt/cfs-turbo/cfs/%s/checkpoint", jobName),
    fmt.Sprintf("/mnt/cfs-turbo/cfs/%s/checkpoint", jobID),
}
```

**修改后**:
```go
// 统一使用 jobName，优先级：outputDirectory > jobName
checkpointPaths := []string{}
if outputDirectory != "" {
    checkpointPaths = append(checkpointPaths, outputDirectory)
}
if jobName != "" {
    checkpointPaths = append(checkpointPaths, 
        fmt.Sprintf("/mnt/cfs-turbo/cfs/%s/checkpoint", jobName))
}
```

## 涉及文件清单

| 文件 | 修改内容 |
|------|---------|
| `frontend/src/components/CreateTrainingJobDialog.tsx` | 删除 `generateOutputDirectory` 函数，outputDirectory 由后端生成 |
| `cmd/api-server/training-job-create.go` | 添加 outputDirectory 自动生成逻辑（使用 jobName） |
| `cmd/api-server/training-job-command.go` | 修改默认路径生成逻辑（从 jobID 改为 jobName） |
| `cmd/api-server/checkpoint-handlers.go` | 简化路径检测逻辑，统一使用 jobName |
| `docs/checkpoint-feature.md` | 更新文档，说明新的路径规范 |
| `docs/path-standardization.md` | 新增此文档，记录标准化方案 |

## 向后兼容

### 旧数据迁移

对于已有的使用旧路径格式的训练任务，提供以下迁移方案：

#### 1. 查看当前路径配置
```bash
sqlite3 training.db "SELECT id, name, output_directory FROM training_jobs;"
```

#### 2. 批量更新数据库
```bash
sqlite3 training.db "UPDATE training_jobs SET output_directory='/mnt/cfs-turbo/cfs/' || name || '/checkpoint' WHERE output_directory LIKE '%job-%';"
```

#### 3. 迁移文件（如果需要）
```bash
kubectl exec -it -n rl cfs-data-accessor-xxx -- sh
# 示例：将 job-1763646388 迁移到 train1
mv /mnt/cfs-turbo/cfs/job-1763646388 /mnt/cfs-turbo/cfs/train1
```

### 兼容性保证

- ✅ **优先使用 outputDirectory**: 如果数据库中已有配置，直接使用
- ✅ **自动检测机制**: 系统会自动检测目录是否存在
- ✅ **降级处理**: 如果标准路径不存在，会回退到 outputDirectory 配置的路径

## 命名规范建议

### Job Name 命名规则
1. ✅ **推荐**: 使用字母、数字、连字符（`-`）
2. ✅ **推荐**: 语义清晰，如 `dpo-llama-7b`, `rlhf-gpt-2024`
3. ❌ **避免**: 特殊字符（`@`, `#`, `/` 等）
4. ❌ **避免**: 空格或中文字符
5. ❌ **避免**: 过长的名称（建议不超过 50 字符）

### 示例
```
✅ 好的命名:
- train1
- test-gpu-manual
- dpo-llama-7b-v2
- rlhf-experiment-001

❌ 避免的命名:
- job-1763646388 (无语义，难以识别)
- test@gpu#manual (包含特殊字符)
- 训练任务1 (包含中文)
- my_super_long_training_job_name_that_is_too_long (过长)
```

## 验证方法

### 1. 创建新训练任务
```bash
# 前端创建任务，jobName = "test-new-path"
# 检查数据库
sqlite3 training.db "SELECT id, name, output_directory FROM training_jobs WHERE name='test-new-path';"

# 预期结果：
# job-1763646xxx|test-new-path|/mnt/cfs-turbo/cfs/test-new-path/checkpoint
```

### 2. 验证训练命令
```bash
# 调用预览命令 API
curl -X POST http://localhost:8080/api/training-jobs/preview-command \
  -H "Content-Type: application/json" \
  -d '{"jobId":"job-xxx"}'

# 检查命令中的路径：
# trainer.default_local_dir=/mnt/cfs-turbo/cfs/test-new-path/checkpoint
# tee /mnt/cfs-turbo/cfs/test-new-path/checkpoint/training.log
```

### 3. 验证 Checkpoint 列表
```bash
# 调用 checkpoint 列表 API
curl http://localhost:8080/api/training-jobs/checkpoints?id=job-xxx

# 检查返回的路径是否正确
```

## 影响评估

### 正面影响
1. ✅ **路径一致性**: 完全消除前后端路径不一致问题
2. ✅ **用户体验**: 路径更易读、易记、易管理
3. ✅ **运维友好**: 问题排查时可直接通过任务名定位文件
4. ✅ **代码简化**: 减少路径检测逻辑，降低复杂度

### 潜在风险
1. ⚠️ **命名冲突**: 如果用户创建同名任务，可能覆盖旧数据
   - **缓解措施**: 前端添加任务名唯一性校验（可选）
2. ⚠️ **旧数据兼容**: 已有任务需要手动迁移
   - **缓解措施**: 提供自动化迁移脚本和文档

## 总结

通过统一使用 `jobName` 作为路径标识符，我们彻底解决了路径不一致的问题，同时提升了系统的可维护性和用户体验。所有新创建的训练任务都将自动使用这一标准，旧任务也可通过迁移脚本平滑过渡。

---

**文档更新时间**: 2025-11-20  
**实施状态**: ✅ 已完成  
**影响范围**: 前端、后端、文档  
**向下兼容**: ✅ 是
