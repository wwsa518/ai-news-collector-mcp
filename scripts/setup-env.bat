@echo off
REM 环境设置脚本
echo Setting up development environment...

REM 创建必要的目录
if not exist logs mkdir logs
if not exist data mkdir data
if not exist agents mkdir agents
if not exist shared mkdir shared
if not exist scripts mkdir scripts

REM 复制环境配置文件
if not exist .env (
    echo Creating .env file from template...
    copy .env.example .env
    echo Please edit .env file with your configuration
) else (
    echo .env file already exists
)

REM 安装依赖
echo Installing dependencies...
call npm install

REM 构建项目
echo Building project...
call npm run build

REM 设置环境变量
setx NODE_ENV "development"
setx DATABASE_TYPE "sqlite"
setx REDIS_HOST "localhost"
setx LOG_LEVEL "info"

echo.
echo Environment setup completed!
echo.
echo Next steps:
echo 1. Install Docker Desktop for Windows
echo 2. Start Redis using Docker: docker run --name redis -p 6379:6379 -d redis:7-alpine
echo 3. Edit .env file with your API keys
echo 4. Run: scripts\check-env.bat to verify setup
echo 5. Run: scripts\start-all.bat to start all agents
echo.
pause