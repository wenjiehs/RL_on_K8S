# 部署和发布指南

本文档说明如何将代码推送到GitHub以及如何部署应用。

## GitHub推送指南

### 方法1: 使用SSH（推荐）

如果您还没有配置SSH密钥：

```bash
# 1. 生成SSH密钥（如果还没有）
ssh-keygen -t ed25519 -C "your_email@example.com"

# 2. 启动ssh-agent
eval "$(ssh-agent -s)"

# 3. 添加SSH密钥
ssh-add ~/.ssh/id_ed25519

# 4. 复制公钥到剪贴板
cat ~/.ssh/id_ed25519.pub | pbcopy  # macOS
# 或
cat ~/.ssh/id_ed25519.pub  # 手动复制

# 5. 在GitHub上添加SSH密钥
# 访问 https://github.com/settings/keys
# 点击 "New SSH key"
# 粘贴公钥并保存

# 6. 修改远程仓库URL为SSH
cd /Users/virgilliang/codebuddy/RL_on_K8S
git remote set-url origin git@github.com:wenjiehs/RL_on_K8S.git

# 7. 推送代码
git push origin main
```

### 方法2: 使用Personal Access Token

```bash
# 1. 创建Personal Access Token
# 访问 https://github.com/settings/tokens
# 点击 "Generate new token (classic)"
# 选择权限：repo (完整仓库访问)
# 生成并复制token

# 2. 使用token推送
cd /Users/virgilliang/codebuddy/RL_on_K8S
git push https://<YOUR_TOKEN>@github.com/wenjiehs/RL_on_K8S.git main

# 或者配置credential helper
git config --global credential.helper store
git push origin main
# 输入用户名和token（作为密码）
```

### 方法3: 使用GitHub CLI

```bash
# 1. 安装GitHub CLI
brew install gh

# 2. 登录
gh auth login

# 3. 推送代码
cd /Users/virgilliang/codebuddy/RL_on_K8S
git push origin main
```

## 当前提交内容

本次提交包含以下重要更新：

### 新增功能
- ✅ 环境详情页完整实现
- ✅ Ray Dashboard一键连接
- ✅ 实时状态监控（5秒自动刷新）
- ✅ 完善的文档系统

### 新增文件
- `docs/USER_GUIDE.md` - 用户使用指南
- `docs/API_REFERENCE.md` - API参考文档
- `docs/QUICK_TEST_GUIDE.md` - 快速测试指南
- `docs/AUTHENTICATION_GUIDE.md` - 认证配置指南
- `docs/IMPLEMENTATION_SUMMARY.md` - 实施总结
- `frontend/src/pages/EnvironmentDetail.tsx` - 环境详情页组件
- `.gitignore` - Git忽略文件配置

### 修改文件
- `README.md` - 完全重写，包含完整使用指南
- `cmd/api-server/main.go` - CORS配置修复
- `cmd/api-server/environment.go` - 新增详情API
- `frontend/src/pages/Environments.tsx` - 添加详情页跳转
- 其他前端组件优化

## 验证推送

推送成功后，访问以下链接验证：

```
https://github.com/wenjiehs/RL_on_K8S
```

检查项：
- [ ] README.md显示正确
- [ ] docs目录包含所有新文档
- [ ] 代码变更已同步
- [ ] .gitignore生效（二进制文件未提交）

## 部署应用

### 本地开发环境

```bash
# 后端
cd cmd/api-server
go build -o /tmp/api-server .
nohup /tmp/api-server > /tmp/api-server.log 2>&1 &

# 前端
cd frontend
npm install
npm run dev
```

### 生产环境部署

#### 1. 后端部署

```bash
# 构建
cd cmd/api-server
go build -o api-server .

# 使用systemd管理（Linux）
sudo tee /etc/systemd/system/rl-api.service > /dev/null <<EOF
[Unit]
Description=RL on K8S API Server
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/RL_on_K8S/cmd/api-server
ExecStart=/path/to/RL_on_K8S/cmd/api-server/api-server
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable rl-api
sudo systemctl start rl-api
```

#### 2. 前端部署

```bash
# 构建生产版本
cd frontend
npm run build

# 使用Nginx部署
sudo tee /etc/nginx/sites-available/rl-frontend > /dev/null <<EOF
server {
    listen 80;
    server_name your-domain.com;
    
    root /path/to/RL_on_K8S/frontend/dist;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/rl-frontend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 3. Docker部署

```bash
# 创建Dockerfile（后端）
cat > cmd/api-server/Dockerfile <<EOF
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o api-server .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/api-server .
EXPOSE 8080
CMD ["./api-server"]
EOF

# 创建Dockerfile（前端）
cat > frontend/Dockerfile <<EOF
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF

# 构建和运行
docker build -t rl-api:latest -f cmd/api-server/Dockerfile .
docker build -t rl-frontend:latest -f frontend/Dockerfile ./frontend

docker run -d -p 8080:8080 --name rl-api rl-api:latest
docker run -d -p 80:80 --name rl-frontend rl-frontend:latest
```

#### 4. Kubernetes部署

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rl-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: rl-api
  template:
    metadata:
      labels:
        app: rl-api
    spec:
      containers:
      - name: api
        image: your-registry/rl-api:latest
        ports:
        - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: rl-api
spec:
  selector:
    app: rl-api
  ports:
  - port: 8080
    targetPort: 8080
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rl-frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: rl-frontend
  template:
    metadata:
      labels:
        app: rl-frontend
    spec:
      containers:
      - name: frontend
        image: your-registry/rl-frontend:latest
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: rl-frontend
spec:
  type: LoadBalancer
  selector:
    app: rl-frontend
  ports:
  - port: 80
    targetPort: 80
```

## 环境变量配置

### 后端环境变量

```bash
# .env
PORT=8080
LOG_LEVEL=info
```

### 前端环境变量

```bash
# .env.production
VITE_API_URL=https://api.your-domain.com
```

## 监控和日志

### 查看日志

```bash
# 后端日志
tail -f /tmp/api-server.log

# systemd日志
sudo journalctl -u rl-api -f

# Docker日志
docker logs -f rl-api
```

### 健康检查

```bash
# API健康检查
curl http://localhost:8080/api/cluster/status

# 前端健康检查
curl http://localhost:5173/
```

## 故障排查

### 推送失败

1. 检查网络连接
2. 验证GitHub认证
3. 确认仓库权限

### 部署失败

1. 检查端口占用
2. 验证依赖安装
3. 查看错误日志

## 回滚策略

```bash
# Git回滚
git revert HEAD
git push origin main

# Docker回滚
docker stop rl-api rl-frontend
docker run -d -p 8080:8080 --name rl-api rl-api:previous
docker run -d -p 80:80 --name rl-frontend rl-frontend:previous
```

## 相关文档

- [用户指南](USER_GUIDE.md)
- [API参考](API_REFERENCE.md)
- [故障排查](ENVIRONMENT_DETAIL_TROUBLESHOOTING.md)
- [快速测试](QUICK_TEST_GUIDE.md)