@echo off
REM 启动所有代理
echo Starting all agents...

REM 创建日志目录
if not exist logs mkdir logs

REM 启动协调代理
start "Coordinator Agent" cmd /k "scripts\start-coordinator.bat"

REM 等待协调代理启动
timeout /t 3 /nobreak > nul

REM 启动其他代理
start "Collector Agent" cmd /k "scripts\start-collector.bat"
start "Processor Agent" cmd /k "scripts\start-processor.bat"
start "Analyzer Agent" cmd /k "scripts\start-analyzer.bat"

echo All agents are starting...
echo Use 'scripts\health-check.bat' to verify agent status.

pause