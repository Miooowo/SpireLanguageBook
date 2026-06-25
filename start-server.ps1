# 杀戮尖塔 · 描述学 — 本地 HTTP 服务器
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "========================================" -ForegroundColor DarkYellow
Write-Host " 杀戮尖塔 · 描述学 本地服务器" -ForegroundColor Yellow
Write-Host "========================================"
Write-Host "项目目录: $PWD`n"

# 结束占用 8080 的旧 python http.server
Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {
    $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
    if ($proc -and $proc.Name -eq "python") {
      Write-Host "结束占用 8080 的进程 PID=$($proc.Id)..." -ForegroundColor DarkGray
      Stop-Process -Id $proc.Id -Force
      Start-Sleep -Seconds 1
    }
  }

$url = "http://127.0.0.1:8080/"
Write-Host "启动中... 浏览器将打开:`n  $url`n  ${url}guide.html`n"
Write-Host "按 Ctrl+C 停止服务器`n" -ForegroundColor DarkGray

Start-Process $url
python -m http.server 8080 --bind 127.0.0.1
