@echo off
call "%~dp0Play.cmd" --configure-display %*
exit /b %errorlevel%
