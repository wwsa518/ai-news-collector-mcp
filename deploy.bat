@echo off
REM AI News Collector MCP - Windows部署脚本

setlocal enabledelayedexpansion

REM 颜色定义
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

REM 日志函数
:log_info
echo %BLUE%[INFO]%NC% %~1
goto :eof

:log_success
echo %GREEN%[SUCCESS]%NC% %~1
goto :eof

:log_warning
echo %YELLOW%[WARNING]%NC% %~1
goto :eof

:log_error
echo %RED%[ERROR]%NC% %~1
goto :eof

REM 检查依赖
:check_dependencies
call :log_info "Checking dependencies..."

REM 检查Docker
docker --version >nul 2>&1
if errorlevel 1 (
    call :log_error "Docker is not installed"
    exit /b 1
)

REM 检查Docker Compose
docker-compose --version >nul 2>&1
if errorlevel 1 (
    call :log_error "Docker Compose is not installed"
    exit /b 1
)

call :log_success "Dependencies check completed"
goto :eof

REM 创建必要目录
:create_directories
call :log_info "Creating necessary directories..."

if not exist "data" mkdir data
if not exist "logs" mkdir logs
if not exist "monitoring" mkdir monitoring

call :log_success "Directories created successfully"
goto :eof

REM 复制环境配置文件
:setup_environment
call :log_info "Setting up environment configuration..."

if not exist ".env" (
    copy ".env.example" ".env" >nul
    call :log_warning "Created .env file from .env.example"
    call :log_warning "Please update .env file with your configuration"
)

call :log_success "Environment configuration completed"
goto :eof

REM 构建Docker镜像
:build_docker
call :log_info "Building Docker image..."
docker-compose build
if errorlevel 1 (
    call :log_error "Failed to build Docker image"
    exit /b 1
)
call :log_success "Docker image built successfully"
goto :eof

REM 启动服务
:start_services
set "services=%~1"
if "%services%"=="" set "services=default"

call :log_info "Starting services: %services%"

if "%services%"=="default" (
    docker-compose up -d app redis
) else if "%services%"=="mcp" (
    docker-compose up -d app redis mcp-server
) else if "%services%"=="monitoring" (
    docker-compose up -d app redis prometheus grafana
) else if "%services%"=="all" (
    docker-compose up -d
) else (
    call :log_error "Unknown service: %services%"
    echo Available services: default, mcp, monitoring, all
    exit /b 1
)

call :log_success "Services started successfully"
goto :eof

REM 停止服务
:stop_services
set "services=%~1"
if "%services%"=="" set "services=default"

call :log_info "Stopping services: %services%"

if "%services%"=="default" (
    docker-compose stop app redis
) else if "%services%"=="mcp" (
    docker-compose stop app redis mcp-server
) else if "%services%"=="monitoring" (
    docker-compose stop app redis prometheus grafana
) else if "%services%"=="all" (
    docker-compose down
) else (
    call :log_error "Unknown service: %services%"
    echo Available services: default, mcp, monitoring, all
    exit /b 1
)

call :log_success "Services stopped successfully"
goto :eof

REM 重启服务
:restart_services
set "services=%~1"
if "%services%"=="" set "services=default"

call :log_info "Restarting services: %services%"
call :stop_services %services%
call :start_services %services%
call :log_success "Services restarted successfully"
goto :eof

REM 查看服务状态
:show_status
call :log_info "Service status:"
docker-compose ps
goto :eof

REM 查看日志
:show_logs
set "service=%~1"
if "%service%"=="" set "service=app"

call :log_info "Showing logs for: %service%"
docker-compose logs -f %service%
goto :eof

REM 健康检查
:health_check
call :log_info "Performing health check..."

REM 检查API服务
curl -f http://localhost:3001/health >nul 2>&1
if errorlevel 1 (
    call :log_error "API service is not responding"
    exit /b 1
) else (
    call :log_success "API service is healthy"
)

REM 检查Redis服务
docker-compose exec redis redis-cli ping >nul 2>&1
if errorlevel 1 (
    call :log_error "Redis service is not responding"
    exit /b 1
) else (
    call :log_success "Redis service is healthy"
)

call :log_success "All services are healthy"
goto :eof

REM 创建备份
:backup_data
call :log_info "Creating backup..."

set "backup_dir=./backups"
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "datetime=%%a"
set "timestamp=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%-%datetime:~10,2%-%datetime:~12,2%"
set "backup_file=%backup_dir%/backup_%timestamp%.tar.gz"

if not exist "%backup_dir%" mkdir "%backup_dir%"

REM 备份数据目录
tar -czf "%backup_file%" data/ logs/ .env

call :log_success "Backup created: %backup_file%"
echo Backup file: %backup_file%
goto :eof

REM 清理旧数据
:cleanup
call :log_info "Cleaning up old data..."

REM 清理Docker镜像
docker image prune -f

REM 清理旧日志
forfiles /p logs /m *.log /d -30 /c "cmd /c del @path" 2>nul

REM 清理旧备份
forfiles /p backups /m *.tar.gz /d -7 /c "cmd /c del @path" 2>nul

call :log_success "Cleanup completed"
goto :eof

REM 显示帮助信息
:show_help
echo AI News Collector MCP - Windows部署脚本
echo.
echo Usage: %~nx0 ^<command^> [options]
echo.
echo Commands:
echo   setup                     初始化环境和依赖
echo   start [service]          启动服务 (default^|mcp^|monitoring^|all)
echo   stop [service]           停止服务 (default^|mcp^|monitoring^|all)
echo   restart [service]        重启服务 (default^|mcp^|monitoring^|all)
echo   status                   显示服务状态
echo   logs [service]           查看服务日志
echo   health                   健康检查
echo   backup                   创建数据备份
echo   cleanup                  清理旧数据
echo   help                     显示帮助信息
echo.
echo Examples:
echo   %~nx0 setup
echo   %~nx0 start monitoring
echo   %~nx0 logs app
echo   %~nx0 backup
goto :eof

REM 主函数
:main
set "command=%~1"
if "%command%"=="" set "command=help"

if "%command%"=="setup" (
    call :check_dependencies
    call :create_directories
    call :setup_environment
    call :build_docker
) else if "%command%"=="start" (
    call :start_services %~2
) else if "%command%"=="stop" (
    call :stop_services %~2
) else if "%command%"=="restart" (
    call :restart_services %~2
) else if "%command%"=="status" (
    call :show_status
) else if "%command%"=="logs" (
    call :show_logs %~2
) else if "%command%"=="health" (
    call :health_check
) else if "%command%"=="backup" (
    call :backup_data
) else if "%command%"=="cleanup" (
    call :cleanup
) else if "%command%"=="help" (
    call :show_help
) else (
    call :log_error "Unknown command: %command%"
    call :show_help
    exit /b 1
)

goto :eof

REM 运行主函数
call :main %*