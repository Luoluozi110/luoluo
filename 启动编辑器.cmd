@echo off
setlocal
set "NODE_EXE=node.exe"
where node.exe >nul 2>nul
if errorlevel 1 set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%NODE_EXE%" (
  echo 未找到 Node.js。请安装 Node.js，或在 Codex 中打开此项目后重试。
  pause
  exit /b 1
)
"%NODE_EXE%" "%~dp0scripts\start-editor-bridge.mjs"
if errorlevel 1 (
  echo.
  echo 编辑器未能启动。请查看上方提示后重试。
  pause
)
