#!/bin/bash

# AI News Collector MCP - 部署脚本
# 支持多种部署模式和配置

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "Checking dependencies..."
    
    # 检查Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # 检查Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        log_warning "Node.js is not installed, using Docker only"
    fi
    
    log_success "Dependencies check completed"
}

# 创建必要目录
create_directories() {
    log_info "Creating necessary directories..."
    
    mkdir -p data logs monitoring
    
    # 设置权限
    chmod 755 data logs
    chmod 644 .env 2>/dev/null || true
    
    log_success "Directories created successfully"
}

# 复制环境配置文件
setup_environment() {
    log_info "Setting up environment configuration..."
    
    if [ ! -f .env ]; then
        cp .env.example .env
        log_warning "Created .env file from .env.example"
        log_warning "Please update .env file with your configuration"
    fi
    
    log_success "Environment configuration completed"
}

# 构建Docker镜像
build_docker() {
    log_info "Building Docker image..."
    
    docker-compose build
    
    log_success "Docker image built successfully"
}

# 启动服务
start_services() {
    local services=${1:-"default"}
    
    log_info "Starting services: $services"
    
    case $services in
        "default")
            docker-compose up -d app redis
            ;;
        "mcp")
            docker-compose up -d app redis mcp-server
            ;;
        "monitoring")
            docker-compose up -d app redis prometheus grafana
            ;;
        "all")
            docker-compose up -d
            ;;
        *)
            log_error "Unknown service: $services"
            echo "Available services: default, mcp, monitoring, all"
            exit 1
            ;;
    esac
    
    log_success "Services started successfully"
}

# 停止服务
stop_services() {
    local services=${1:-"default"}
    
    log_info "Stopping services: $services"
    
    case $services in
        "default")
            docker-compose stop app redis
            ;;
        "mcp")
            docker-compose stop app redis mcp-server
            ;;
        "monitoring")
            docker-compose stop app redis prometheus grafana
            ;;
        "all")
            docker-compose down
            ;;
        *)
            log_error "Unknown service: $services"
            echo "Available services: default, mcp, monitoring, all"
            exit 1
            ;;
    esac
    
    log_success "Services stopped successfully"
}

# 重启服务
restart_services() {
    local services=${1:-"default"}
    
    log_info "Restarting services: $services"
    
    stop_services $services
    start_services $services
    
    log_success "Services restarted successfully"
}

# 查看服务状态
show_status() {
    log_info "Service status:"
    docker-compose ps
}

# 查看日志
show_logs() {
    local service=${1:-"app"}
    
    log_info "Showing logs for: $service"
    docker-compose logs -f $service
}

# 健康检查
health_check() {
    log_info "Performing health check..."
    
    # 检查API服务
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        log_success "API service is healthy"
    else
        log_error "API service is not responding"
        return 1
    fi
    
    # 检查Redis服务
    if docker-compose exec redis redis-cli ping > /dev/null 2>&1; then
        log_success "Redis service is healthy"
    else
        log_error "Redis service is not responding"
        return 1
    fi
    
    log_success "All services are healthy"
}

# 创建备份
backup_data() {
    log_info "Creating backup..."
    
    local backup_dir="./backups"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/backup_$timestamp.tar.gz"
    
    mkdir -p $backup_dir
    
    # 备份数据目录
    tar -czf $backup_file data/ logs/ .env
    
    log_success "Backup created: $backup_file"
    echo "Backup file: $backup_file"
}

# 恢复备份
restore_backup() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        log_error "Backup file is required"
        echo "Usage: $0 restore <backup-file>"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_info "Restoring from backup: $backup_file"
    
    # 停止服务
    stop_services all
    
    # 恢复数据
    tar -xzf $backup_file
    
    # 启动服务
    start_services default
    
    log_success "Backup restored successfully"
}

# 清理旧数据
cleanup() {
    log_info "Cleaning up old data..."
    
    # 清理Docker镜像
    docker image prune -f
    
    # 清理旧日志
    find logs/ -name "*.log" -mtime +30 -delete 2>/dev/null || true
    
    # 清理旧备份
    find backups/ -name "*.tar.gz" -mtime +7 -delete 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# 显示帮助信息
show_help() {
    echo "AI News Collector MCP - 部署脚本"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  setup                     初始化环境和依赖"
    echo "  start [service]          启动服务 (default|mcp|monitoring|all)"
    echo "  stop [service]           停止服务 (default|mcp|monitoring|all)"
    echo "  restart [service]        重启服务 (default|mcp|monitoring|all)"
    echo "  status                   显示服务状态"
    echo "  logs [service]           查看服务日志"
    echo "  health                   健康检查"
    echo "  backup                   创建数据备份"
    echo "  restore <file>           从备份恢复"
    echo "  cleanup                  清理旧数据"
    echo "  help                     显示帮助信息"
    echo ""
    echo "Examples:"
    echo "  $0 setup"
    echo "  $0 start monitoring"
    echo "  $0 logs app"
    echo "  $0 backup"
    echo "  $0 restore ./backups/backup_20231201_120000.tar.gz"
}

# 主函数
main() {
    local command=${1:-"help"}
    
    case $command in
        "setup")
            check_dependencies
            create_directories
            setup_environment
            build_docker
            ;;
        "start")
            start_services ${2:-"default"}
            ;;
        "stop")
            stop_services ${2:-"default"}
            ;;
        "restart")
            restart_services ${2:-"default"}
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs ${2:-"app"}
            ;;
        "health")
            health_check
            ;;
        "backup")
            backup_data
            ;;
        "restore")
            restore_backup $2
            ;;
        "cleanup")
            cleanup
            ;;
        "help")
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"