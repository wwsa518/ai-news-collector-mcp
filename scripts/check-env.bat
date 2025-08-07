@echo off
REM 环境检查脚本
echo Checking development environment...

echo.
echo Node.js Version:
node --version

echo.
echo NPM Version:
npm --version

echo.
echo Python Version:
python --version

echo.
echo Git Version:
git --version

echo.
echo Docker Version:
docker --version 2>nul || echo Docker: NOT INSTALLED

echo.
echo Redis CLI:
redis-cli ping 2>nul || echo Redis: NOT RUNNING

echo.
echo Environment Variables:
echo NODE_ENV: %NODE_ENV%
echo DATABASE_TYPE: %DATABASE_TYPE%
echo REDIS_HOST: %REDIS_HOST%

echo.
echo Project Structure:
if exist agents (
    echo Agents directory: EXISTS
) else (
    echo Agents directory: MISSING
)

if exist shared (
    echo Shared directory: EXISTS
) else (
    echo Shared directory: MISSING
)

if exist scripts (
    echo Scripts directory: EXISTS
) else (
    echo Scripts directory: MISSING
)

echo.
echo Environment check completed!
pause