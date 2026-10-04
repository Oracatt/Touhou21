@echo off
cd /d "%~dp0"
runtime\ts-stg.exe main.js --root "%~dp0" --backend quickjs
