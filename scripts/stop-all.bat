@echo off
REM 停止所有代理
echo Stopping all agents...

REM 停止所有 Node.js 进程
taskkill /F /IM node.exe 2>nul

REM 等待进程完全停止
timeout /t 2 /nobreak > nul

echo All agents have been stopped.
pause