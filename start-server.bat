@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo  杀戮尖塔 · 描述学 本地服务器
echo ========================================
echo.
echo 项目目录: %CD%
echo.

REM 若 8080 已被占用，尝试结束旧的 python http.server
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080.*LISTENING"') do (
  echo 端口 8080 已被占用 PID=%%a，正在结束旧进程...
  taskkill /F /PID %%a >nul 2>&1
  timeout /t 1 /nobreak >nul
)

echo 正在启动服务器...
echo.
echo  请在浏览器打开:
echo    http://127.0.0.1:8080/
echo    http://127.0.0.1:8080/guide.html
echo.
echo  按 Ctrl+C 停止服务器
echo ========================================
echo.

python -m http.server 8080 --bind 127.0.0.1
if errorlevel 1 (
  echo.
  echo [错误] 启动失败。请确认已安装 Python 且可在命令行运行 python 命令。
  pause
)
