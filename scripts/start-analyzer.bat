@echo off
REM 设置环境变量
set NODE_ENV=development
set AGENT_TYPE=analyzer
set AGENT_PORT=3003
set AGENT_CONFIG=.\agents\analyzer-agent\config.json

REM 创建日志目录
if not exist logs mkdir logs

REM 启动分析代理
echo Starting Analyzer Agent on port %AGENT_PORT%...
npm run dev -- --agent=%AGENT_TYPE% --port=%AGENT_PORT% --config=%AGENT_CONFIG%

pause