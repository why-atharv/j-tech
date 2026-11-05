@echo off
title POKEMONS WORLD DOME
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install || goto :error
)

echo Building the game...
call npm run build || goto :error

set MODE=
if /i "%1"=="tunnel" set MODE=--tunnel
start "POKEMONS WORLD SERVER" cmd /k node server/index.js %MODE%

echo Waiting for the server...
:wait
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:3000/ ) | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  timeout /t 1 /nobreak >nul
  goto :wait
)

set EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe
if not exist "%EDGE%" set EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe
if not exist "%EDGE%" (
  start "" "http://localhost:3000/?view=dome&fov=160"
  goto :eof
)

start "" "%EDGE%" --kiosk "http://localhost:3000/?view=dome&fov=160" --edge-kiosk-type=fullscreen --user-data-dir="%LOCALAPPDATA%\PokemonsWorldDome" --no-first-run --autoplay-policy=no-user-gesture-required --ignore-gpu-blocklist --enable-gpu-rasterization --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion
echo.
echo Dome is running in Edge kiosk mode. Press Alt+F4 on the dome to close it.
echo Close the "POKEMONS WORLD SERVER" window to stop the game.
goto :eof

:error
echo.
echo Something went wrong. Make sure Node.js 18+ is installed: https://nodejs.org
pause
