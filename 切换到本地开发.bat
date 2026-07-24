@echo off
title Switch to Local Dev
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\switch-to-local.ps1"
echo.
pause
