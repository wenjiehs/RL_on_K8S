#!/bin/bash

echo "=== 测试训练任务创建API ==="
echo ""

# 测试数据
TEST_DATA='{
  "experimentName": "browser-test-job",
  "algorithmType": "PPO",
  "environmentId": "a-ray-5",
  "dataPath": "/cfs/rl-data/test/train",
  "hyperparameters": {
    "learning_rate": 0.0003,
    "gamma": 0.99,
    "clip_range": 0.2
  },
  "namespace": "default"
}'

echo "发送请求..."
echo "$TEST_DATA" | jq '.'
echo ""

RESPONSE=$(curl -s -X POST http://localhost:8080/api/training-jobs/create \
  -H "Content-Type: application/json" \
  -d "$TEST_DATA")

echo "响应:"
echo "$RESPONSE" | jq '.'
echo ""

if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
  echo "✅ 创建成功！"
  JOB_ID=$(echo "$RESPONSE" | jq -r '.id')
  echo "任务ID: $JOB_ID"
else
  echo "❌ 创建失败"
  echo "错误: $(echo "$RESPONSE" | jq -r '.error // "未知错误"')"
fi