# AI News Collector MCP

一个基于AI的新闻事件智能采集与分析系统，支持MCP (Model Context Protocol) 协议。

## 🚀 快速开始

### 前置要求
- Node.js 18+
- Docker & Docker Compose
- Git

### 1. 克隆项目
```bash
git clone <repository-url>
cd ai-news-collector-mcp
```

### 2. 初始化环境
```bash
# Linux/macOS
./deploy.sh setup

# Windows
deploy.bat setup
```

### 3. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，配置必要的参数
```

### 4. 启动服务
```bash
# 启动基础服务
./deploy.sh start default

# 启动包含监控的服务
./deploy.sh start monitoring

# 启动所有服务
./deploy.sh start all
```

### 5. 验证部署
```bash
# 健康检查
./deploy.sh health

# 查看服务状态
./deploy.sh status
```

## 📋 服务端点

### API服务 (http://localhost:3001)
- `GET /health` - 健康检查
- `POST /api/test` - 测试接口
- `GET /api/test-data` - 生成测试数据
- `GET /api/system/info` - 系统信息

### MCP服务器
系统包含基础的MCP服务器，提供以下工具：
- `test_function` - 简单测试函数
- `health_check` - 健康检查
- `generate_test_data` - 生成测试数据

## 🔧 开发

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
# 启动API服务器
npm run api-server

# 启动MCP服务器
npm run mcp-server

# 启动主应用
npm run dev
```

### 运行测试
```bash
npm test
npm run test:watch
```

### 构建项目
```bash
npm run build
```

## 🐳 Docker部署

### 支持的服务组合
- `default` - 主应用 + Redis
- `mcp` - 包含MCP服务器
- `monitoring` - 包含Prometheus + Grafana
- `all` - 所有服务

### 常用命令
```bash
# 启动服务
./deploy.sh start [service]

# 停止服务
./deploy.sh stop [service]

# 重启服务
./deploy.sh restart [service]

# 查看日志
./deploy.sh logs [service]

# 创建备份
./deploy.sh backup

# 清理数据
./deploy.sh cleanup
```

## 📊 监控

### Prometheus
- 地址: http://localhost:9090
- 配置文件: `monitoring/prometheus.yml`

### Grafana
- 地址: http://localhost:3002
- 默认用户: admin
- 默认密码: admin

## 🔍 测试

系统包含完整的测试套件：
- 单元测试
- 集成测试
- API测试

运行测试：
```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监视模式运行测试
npm run test:watch
```

## 📁 项目结构

```
ai-news-collector-mcp/
├── src/                    # 源代码
│   ├── api/               # API服务
│   ├── mcp/               # MCP服务器
│   ├── models/            # 数据模型
│   ├── config/            # 配置管理
│   ├── types/             # 类型定义
│   ├── utils/             # 工具函数
│   └── index.ts           # 主入口
├── tests/                 # 测试文件
├── data/                  # 数据存储
├── logs/                  # 日志文件
├── monitoring/            # 监控配置
├── docker-compose.yml     # Docker编排
├── deploy.sh             # 部署脚本 (Linux/macOS)
├── deploy.bat            # 部署脚本 (Windows)
└── README.md             # 项目说明
```

## ⚙️ 配置

### 环境变量
主要配置项：
- `RSSHUB_URL` - RSSHub服务地址
- `REDIS_HOST` - Redis主机地址
- `PYTHON_SERVICE_URL` - Python服务地址
- `OPENAI_API_KEY` - OpenAI API密钥

### 外部服务集成
- **RSSHub**: 默认使用 http://124.221.80.250:5678
- **Redis**: 支持外部Redis服务器配置
- **Python服务**: 支持外部Python分析服务集成

## 🛠️ 开发计划

### 当前阶段
- ✅ 基础框架搭建
- ✅ 简单测试模块
- ✅ MCP服务器
- ✅ API服务
- ✅ Docker部署
- 🔄 监控系统

### 下一阶段
- 📋 数据采集模块
- 📋 存储与缓存
- 📋 Python分析服务
- 📋 高级功能模块

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License