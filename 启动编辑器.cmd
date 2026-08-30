@echo off
setlocal
set "NODE_EXE=node.exe"
where node.exe >nul 2>nul
if errorlevel 1 set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%NODE_EXE%" (
  echo Node.js was not found. Install Node.js or open this project in Codex, then retry.
  pause
  exit /b 1
)
"%NODE_EXE%" "%~dp0scripts\start-editor-bridge.mjs"
if errorlevel 1 (
  echo.
  echo The editor failed to start. Review the message above, then retry.
  pause
)
