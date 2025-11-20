# 训练任务预览命令功能测试

## 功能概述
实现了训练任务预览命令功能，允许用户在启动训练前查看将要执行的完整VERL训练命令。

## 实现内容

### 后端实现
1. **新增文件**: `cmd/api-server/training-job-command.go`
   - `generateTrainingCommand()`: 根据训练任务配置生成VERL命令
   - `handlePreviewTrainingCommand()`: 处理预览命令API请求
   - `TrainingCommandConfig`: 训练命令配置结构体

2. **路由注册**: 在 `main.go` 中添加 `/api/training-jobs/preview-command` 路由

### 前端实现
1. **更新文件**: `frontend/src/pages/TrainingJobs.tsx`
   - 添加预览命令相关状态变量
   - `handlePreviewCommand()`: 调用预览API
   - `handleCopyCommand()`: 复制命令到剪贴板
   - 在操作列添加"预览命令"按钮
   - 添加预览命令对话框

## API接口

### 请求
```
POST /api/training-jobs/preview-command
Content-Type: application/json

{
  "jobId": "job-1763612618"
}
```

### 响应
```json
{
  "success": true,
  "command": "PYTHONUNBUFFERED=1 python3 -m verl.trainer.main_ppo \\",
  "jobId": "job-1763612618",
  "jobName": "virigltest2"
}
```

## 生成的命令示例
```bash
PYTHONUNBUFFERED=1 python3 -m verl.trainer.main_ppo \
    data.train_files=openassistant \
    data.val_files=openassistant \
    data.train_batch_size=256 \
    data.max_prompt_length=512 \
    data.max_response_length=256 \
    actor_rollout_ref.model.path=/mnt/cfs-turbo/cfs/Qwen3-8B \
    actor_rollout_ref.actor.optim.lr=1e-6 \
    actor_rollout_ref.actor.ppo_mini_batch_size=64 \
    actor_rollout_ref.actor.ppo_micro_batch_size_per_gpu=4 \
    actor_rollout_ref.rollout.name=vllm \
    actor_rollout_ref.rollout.log_prob_micro_batch_size_per_gpu=8 \
    actor_rollout_ref.rollout.tensor_model_parallel_size=1 \
    actor_rollout_ref.rollout.gpu_memory_utilization=0.3 \
    actor_rollout_ref.ref.log_prob_micro_batch_size_per_gpu=4 \
    critic.optim.lr=1e-5 \
    critic.model.path=/mnt/cfs-turbo/cfs/Qwen3-8B \
    critic.ppo_micro_batch_size_per_gpu=4 \
    algorithm.kl_ctrl.kl_coef=0.001 \
    trainer.logger='[console]' \
    trainer.val_before_train=false \
    trainer.default_local_dir=/mnt/cfs-turbo/cfs/checkpoint/20251119 \
    trainer.n_gpus_per_node=8 \
    trainer.nnodes=2 \
    trainer.save_freq=1 \
    trainer.test_freq=10 \
    trainer.total_epochs=8 \
    +distributed.backend=nccl \
    2>&1 | tee verl_demo.log
```

## 测试步骤

### 1. 后端测试
```bash
# 启动后端服务
go run cmd/api-server/*.go

# 测试预览命令API
curl -s http://localhost:8080/api/training-jobs/preview-command \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jobId": "job-1763612618"}'
```

### 2. 前端测试
1. 访问训练任务列表页: http://localhost:5173/training-jobs
2. 点击任意训练任务的"预览命令"按钮
3. 查看弹出的预览命令对话框
4. 验证生成的命令内容
5. 测试"复制命令"功能

## 功能特点

### 命令生成逻辑
- **数据配置**: 使用训练任务的数据集路径
- **模型配置**: 使用基础模型路径
- **训练参数**: 使用预设的PPO训练参数
- **资源配置**: 根据GPU数量调整并行配置
- **输出配置**: 使用指定的输出目录

### 用户界面
- **预览按钮**: 在操作列中添加代码图标按钮
- **对话框**: 显示完整命令的只读文本框
- **复制功能**: 一键复制命令到剪贴板
- **提示信息**: 显示使用注意事项

### 错误处理
- **任务不存在**: 返回404错误
- **数据库错误**: 返回500错误
- **请求格式错误**: 返回400错误
- **前端错误提示**: 友好的错误消息

## 下一步计划
1. 实现实际的训练启动功能
2. 添加训练参数的自定义配置
3. 支持不同的训练算法选择
4. 添加训练日志查看功能