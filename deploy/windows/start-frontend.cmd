@echo off
setlocal

cd /d "%~dp0..\..\frontend"
if not exist ".next\BUILD_ID" (
  echo Frontend production build not found. Run npm ci and npm run build in frontend first.
  exit /b 1
)

call npm run start:lan
exit /b %ERRORLEVEL%
