@echo off
REM 健康检查脚本
echo Checking agent health...

REM 检查协调代理
echo Checking Coordinator Agent (port 3000)...
curl -s http://localhost:3000/health 2>nul || echo Coordinator Agent: NOT RUNNING

REM 检查数据采集代理
echo Checking Collector Agent (port 3001)...
curl -s http://localhost:3001/health 2>nul || echo Collector Agent: NOT RUNNING

REM 检查数据处理代理
echo Checking Processor Agent (port 3002)...
curl -s http://localhost:3002/health 2>nul || echo Processor Agent: NOT RUNNING

REM 检查分析代理
echo Checking Analyzer Agent (port 3003)...
curl -s http://localhost:3003/health 2>nul || echo Analyzer Agent: NOT RUNNING

echo Health check completed.
pause