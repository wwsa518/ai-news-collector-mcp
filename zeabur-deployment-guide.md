# Zeabur 部署指南

## 概述
本指南介绍如何将 AI News Collector MCP 部署到 Zeabur 平台。

## 部署方式

### 方式一：通过 GitHub Actions 自动部署

1. **配置 GitHub Secrets**
   - `ZEABUR_TOKEN`: 你的 Zeabur API Token
   - `ZEABUR_PROJECT_ID`: 你的 Zeabur 项目ID

2. **推送代码到 main 分支**
   - GitHub Actions 会自动构建并部署到 Zeabur

### 方式二：手动部署到 Zeabur

1. **登录 Zeabur 控制台**
   - 访问 [zeabur.com](https://zeabur.com)

2. **创建新项目**
   - 选择 "Deploy from Git"
   - 选择你的 GitHub 仓库

3. **配置构建设置**
   - 构建命令：`npm run build`
   - 启动命令：`dumb-init node dist/index.js`
   - Node.js 版本：20

4. **设置环境变量**
   ```env
   NODE_ENV=production
   LOG_LEVEL=info
   PORT=3000
   API_PORT=3001
   DATABASE_TYPE=sqlite
   DATABASE_URL=file:./data/ai_news.db
   REDIS_HOST=localhost
   REDIS_PORT=6379
   RSSHUB_URL=http://124.221.80.250:5678
   CORS_ORIGIN=*
   ```

5. **暴露端口**
   - 端口：3001
   - 协议：HTTP

6. **配置健康检查**
   - 路径：`/health`
   - 间隔：30秒
   - 超时：10秒
   - 重试次数：3

## 配置文件说明

### zeabur.toml
主要的部署配置文件，包含：
- 构建设置
- 环境变量
- 端口配置
- 健康检查
- 资源限制
- 域名配置

### .github/workflows/deploy-zeabur.yml
GitHub Actions 工作流文件，用于自动化部署。

## 部署后验证

1. **访问健康检查**
   ```
   https://your-app-name.zeabur.app/health
   ```

2. **访问系统信息**
   ```
   https://your-app-name.zeabur.app/api/system/info
   ```

3. **测试 API 端点**
   ```
   POST https://your-app-name.zeabur.app/api/test
   ```

## 监控和日志

1. **Zeabur 控制台**
   - 查看应用状态
   - 监控资源使用
   - 查看部署日志

2. **健康检查**
   - 自动监控应用状态
   - 失败时自动重启

3. **日志收集**
   - JSON 格式日志
   - 7天日志保留

## 故障排除

### 常见问题

1. **构建失败**
   - 检查 Node.js 版本是否为 20
   - 确认所有依赖已正确安装

2. **启动失败**
   - 检查环境变量配置
   - 确认端口 3001 已正确暴露

3. **健康检查失败**
   - 确认应用已正确启动
   - 检查 `/health` 端点是否正常

### 获取帮助

- 查看 Zeabur 官方文档
- 检查 GitHub Actions 日志
- 查看 Zeabur 控制台日志

## 性能优化

### 资源配置
- 内存：512MB
- CPU：0.5 核心
- 自动扩缩容

### 缓存策略
- Node.js 模块缓存
- 构建产物缓存

### 持久化存储
- 数据库文件持久化
- 日志文件持久化

## 安全配置

### 环境变量
- 敏感信息通过环境变量配置
- 使用 Zeabur 的 Secrets 管理

### 网络安全
- CORS 配置
- 安全头部设置
- 请求限制

## 备份和恢复

### 数据备份
- SQLite 数据库文件
- 日志文件
- 配置文件

### 恢复策略
- 从 Zeabur 控制台恢复
- 通过 Git 恢复配置

## 更新和升级

### 应用更新
- 推送代码到 main 分支
- 自动触发重新部署

### 依赖更新
- 定期更新依赖包
- 测试兼容性

### 版本回滚
- 使用 Git 回滚
- 重新部署指定版本