#!/bin/bash

echo "=== 训练列表页操作列响应式测试 ==="
echo ""

echo "1. 检查前端服务状态..."
if curl -s http://localhost:5173 > /dev/null; then
    echo "✅ 前端服务正常运行 (http://localhost:5173)"
else
    echo "❌ 前端服务未运行"
    exit 1
fi

echo ""
echo "2. 检查后端API状态..."
if curl -s http://localhost:8080/api/training-jobs > /dev/null; then
    echo "✅ 后端API正常运行 (http://localhost:8080)"
else
    echo "❌ 后端API未运行"
    exit 1
fi

echo ""
echo "3. 获取训练任务数据..."
RESPONSE=$(curl -s http://localhost:8080/api/training-jobs)
JOB_COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('jobs', [])))" 2>/dev/null || echo "0")

if [ "$JOB_COUNT" -gt 0 ]; then
    echo "✅ 找到 $JOB_COUNT 个训练任务"
    
    echo ""
    echo "4. 测试不同状态的任务..."
    echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
jobs = data.get('jobs', [])
statuses = {}
for job in jobs:
    status = job.get('status', 'unknown')
    if status not in statuses:
        statuses[status] = []
    statuses[status].append(job.get('experimentName', 'N/A'))

for status, job_names in statuses.items():
    print(f'  {status}: {len(job_names)} 个任务')
    for name in job_names[:2]:  # 只显示前2个
        print(f'    - {name}')
"
else
    echo "⚠️  没有找到训练任务，请先创建一些测试任务"
fi

echo ""
echo "5. 响应式测试指南："
echo "   请在浏览器中访问 http://localhost:5173/training-jobs"
echo ""
echo "   桌面端测试 (>1200px):"
echo "   - 调整浏览器窗口宽度 >1200px"
echo "   - 验证按钮在一行显示"
echo "   - 检查按钮间距和大小"
echo ""
echo "   平板端测试 (768px-1200px):"
echo "   - 调整浏览器窗口宽度到 768px-1200px"
echo "   - 验证按钮自动换行"
echo "   - 检查按钮尺寸调整"
echo ""
echo "   移动端测试 (<768px):"
echo "   - 调整浏览器窗口宽度 <768px"
echo "   - 验证紧凑布局"
echo "   - 检查按钮可点击性"
echo ""
echo "   功能测试:"
echo "   - 点击不同状态任务的按钮"
echo "   - 验证预览命令功能"
echo "   - 测试删除确认对话框"
echo "   - 检查加载状态显示"

echo ""
echo "=== 测试完成 ==="