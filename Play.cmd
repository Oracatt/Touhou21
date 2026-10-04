@echo off
cd /d "%~dp0"
runtime\ts-stg.exe main.js --root . --backend v8 %*
