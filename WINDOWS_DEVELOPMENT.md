# Windows 子代理系统开发指南

## 项目结构

```
ai-news-collector-mcp/
├── agents/                    # 子代理目录
│   ├── coordinator-agent/     # 协调代理
│   │   ├── config.json        # 代理配置
│   │   ├── index.ts           # 代理主类
│   │   └── main.ts            # 代理入口
│   ├── collector-agent/       # 数据采集代理
│   │   └── config.json
│   ├── processor-agent/       # 数据处理代理
│   │   └── config.json
│   └── analyzer-agent/        # 分析代理
│       └── config.json
├── shared/                     # 共享资源
│   ├── types/                 # 共享类型定义
│   │   └── index.ts
│   ├── config/                # 共享配置
│   │   └── index.ts
│   ├── utils/                 # 共享工具
│   │   └── index.ts
│   └── communication.ts       # 通信协议
├── scripts/                   # Windows 启动脚本
│   ├── start-coordinator.bat
│   ├── start-collector.bat
│   ├── start-processor.bat
│   ├── start-analyzer.bat
│   ├── start-all.bat
│   ├── stop-all.bat
│   ├── health-check.bat
│   ├── check-env.bat
│   └── setup-env.bat
├── logs/                      # 日志目录
├── data/                      # 数据目录
└── .env.example              # 环境配置模板
```

## 快速开始

### 1. 环境设置
```batch
# 运行环境设置脚本
scripts\setup-env.bat
```

### 2. 安装依赖
```batch
# 安装 Node.js 依赖
npm install

# 安装 Python 依赖 (可选)
pip install -r requirements.txt
```

### 3. 配置环境变量
```batch
# 复制环境配置文件
copy .env.example .env

# 编辑 .env 文件，设置 API 密钥等配置
```

### 4. 启动服务

#### 启动所有代理
```batch
scripts\start-all.bat
```

#### 单独启动代理
```batch
# 启动协调代理
scripts\start-coordinator.bat

# 启动数据采集代理
scripts\start-collector.bat

# 启动数据处理代理
scripts\start-processor.bat

# 启动分析代理
scripts\start-analyzer.bat
```

#### 停止所有代理
```batch
scripts\stop-all.bat
```

### 5. 健康检查
```batch
scripts\health-check.bat
```

### 6. 环境检查
```batch
scripts\check-env.bat
```

## 代理端口配置

- **协调代理**: 3000
- **数据采集代理**: 3001
- **数据处理代理**: 3002
- **分析代理**: 3003

## 开发工作流程

### 1. 开发新功能
1. 在对应的代理目录下创建功能模块
2. 在 `shared/types/index.ts` 中定义相关类型
3. 在 `shared/config/index.ts` 中添加配置
4. 更新代理配置文件
5. 重启代理进行测试

### 2. 调试代理
```batch
# 单独启动代理进行调试
scripts\start-coordinator.bat
```

### 3. 查看日志
```batch
# 查看协调代理日志
type logs\coordinator.log

# 查看数据采集代理日志
type logs\collector.log
```

## 系统架构

### 代理职责
- **协调代理**: 任务分配、代理管理、健康监控
- **数据采集代理**: RSS采集、网页抓取、API集成
- **数据处理代理**: 内容清洗、实体识别、事件提取
- **分析代理**: 情感分析、风险检测、趋势分析

### 通信机制
- 基于 HTTP 的消息传递
- 支持请求-响应和事件通知
- 自动心跳检测和故障转移
- 负载均衡和任务分配

### 任务路由
- 根据任务类型自动路由到对应代理
- 支持任务优先级和队列管理
- 失败任务自动重试

## 配置说明

### 代理配置
每个代理都有自己的 `config.json` 文件，包含：
- `agent_name`: 代理名称
- `agent_type`: 代理类型
- `capabilities`: 代理能力列表
- `dependencies`: 依赖的其他代理
- `port`: 监听端口
- `host`: 监听地址

### 环境变量
- `NODE_ENV`: 运行环境 (development/production)
- `DATABASE_TYPE`: 数据库类型 (sqlite/postgres)
- `REDIS_HOST`: Redis 服务器地址
- `OPENAI_API_KEY`: OpenAI API 密钥

## 故障排除

### 常见问题
1. **端口占用**: 检查端口是否被其他程序占用
2. **Redis 连接失败**: 确保 Redis 服务正在运行
3. **代理启动失败**: 检查日志文件查看错误信息
4. **代理间通信失败**: 检查防火墙设置和网络连接

### 日志查看
```batch
# 查看所有日志
dir logs\

# 实时查看日志
powershell Get-Content logs\coordinator.log -Wait
```

## 部署说明

### 开发环境
- 使用 `.env` 文件进行本地配置
- 使用启动脚本管理代理
- 日志输出到控制台和文件

### 生产环境
- 使用环境变量进行配置
- 使用 PM2 或 Windows 服务管理代理
- 配置日志轮转和监控

## 扩展开发

### 添加新代理
1. 在 `agents/` 目录创建新的代理目录
2. 创建代理配置文件 `config.json`
3. 实现代理主类和入口文件
4. 更新共享类型和配置
5. 创建启动脚本

### 添加新功能
1. 在对应的代理中实现功能模块
2. 注册消息处理器
3. 更新任务路由配置
4. 添加测试用例

这个 Windows 子代理系统提供了完整的开发框架，支持模块化开发和水平扩展。