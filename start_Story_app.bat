@echo off
setlocal
cd /d "%~dp0"

echo [Story Maker] Starting system...

where node >nul 2>nul
if errorlevel 1 goto NODE_MISSING

where npm >nul 2>nul
if errorlevel 1 goto NPM_MISSING

if not exist node_modules (
    echo [INFO] node_modules not found. Installing dependencies...
    call npm install
)

if not exist node_modules goto INSTALL_ERROR

set "APP_URL=http://127.0.0.1:5199/"

echo [INFO] Checking development server at %APP_URL%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; $url='%APP_URL%'; try { $r=Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400 -and (($r.Content -match 'Story Maker') -or ($r.Content -match 'vite/client'))) { exit 0 } } catch {}; if (Get-NetTCPConnection -LocalPort 5199 -State Listen -ErrorAction SilentlyContinue) { exit 2 }; exit 1"
if errorlevel 2 goto PORT_IN_USE
if errorlevel 1 goto START_SERVER

:SERVER_ALREADY_RUNNING
echo [INFO] Story Maker is already running on 5199.
start "" "%APP_URL%"
echo [INFO] Opened %APP_URL%
exit /b 0

:START_SERVER
echo [INFO] Launching development server at %APP_URL%...
call npm run dev -- --host 127.0.0.1 --port 5199 --strictPort --open --base ./

if errorlevel 1 goto RUN_ERROR

pause
exit /b

:PORT_IN_USE
echo [ERROR] Port 5199 is already in use by another application.
echo [INFO] Close that application or choose another port before starting Story Maker.
pause
exit /b

:NODE_MISSING
echo [ERROR] Node.js is not installed.
pause
exit /b

:NPM_MISSING
echo [ERROR] npm is not found.
pause
exit /b

:INSTALL_ERROR
echo [ERROR] Installation failed.
pause
exit /b

:RUN_ERROR
echo [ERROR] Failed to start server.
pause
exit /b

