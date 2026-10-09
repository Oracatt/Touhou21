@echo off
cd /d "%~dp0"
call npm run build
if errorlevel 1 exit /b 1
runtime\ts-stg.exe dist/main.js --root . --backend quickjs %*
