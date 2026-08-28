@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-editor-bridge.ps1"
if errorlevel 1 (
  echo.
  echo 编辑器未能启动。请查看上方提示后重试。
  pause
)
