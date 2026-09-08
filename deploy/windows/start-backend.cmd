@echo off
setlocal

cd /d "%~dp0..\..\backend"
if not exist "dist\main.js" (
  echo Backend build not found. Run npm ci and npm run build in backend first.
  exit /b 1
)

call npm run start:prod:local
exit /b %ERRORLEVEL%
