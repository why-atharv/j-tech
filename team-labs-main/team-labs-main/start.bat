@echo off
title POKEMONS WORLD
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install || goto :error
)

echo Building the game...
call npm run build || goto :error

start "" http://localhost:3000
node server/index.js
goto :eof

:error
echo.
echo Something went wrong. Make sure Node.js 18+ is installed: https://nodejs.org
pause
