[CmdletBinding()]
param([ValidateRange(1, 65535)][int]$Port = 8787)

$ErrorActionPreference = 'Stop'
$workspaceRoot = Split-Path -Parent $PSScriptRoot
$editorUrl = "http://127.0.0.1:$Port/feihua-editors/"
$stdoutPath = Join-Path ([IO.Path]::GetTempPath()) 'feihua-editor-bridge.out.log'
$stderrPath = Join-Path ([IO.Path]::GetTempPath()) 'feihua-editor-bridge.err.log'

function Test-EditorBridge {
  try {
    $response = Invoke-WebRequest -Uri $editorUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content -match '文心棋.*内容编辑器'
  } catch {
    return $false
  }
}

function Find-Node {
  $fromPath = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($fromPath) { return $fromPath.Source }
  $profileRoot = [Environment]::GetFolderPath('UserProfile')
  $bundledNode = Join-Path $profileRoot '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
  if (Test-Path -LiteralPath $bundledNode) { return $bundledNode }
  throw '未找到 Node.js。请安装 Node.js，或在 Codex 中打开此项目后重试。'
}

if (Test-EditorBridge) {
  Start-Process $editorUrl
  Write-Output "编辑器已在运行：$editorUrl"
  exit 0
}

$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  throw "端口 $Port 已被进程 $($listener.OwningProcess) 占用，但它不是编辑器桥接。请关闭该进程或使用其他端口后重试。"
}

$node = Find-Node
$env:EDITOR_BRIDGE_PORT = [string]$Port
$process = Start-Process -FilePath $node -ArgumentList 'scripts/serve-editor-bridge.mjs' `
  -WorkingDirectory $workspaceRoot -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru

for ($attempt = 1; $attempt -le 20; $attempt++) {
  Start-Sleep -Milliseconds 250
  if (Test-EditorBridge) {
    Start-Process $editorUrl
    Write-Output "编辑器已启动：$editorUrl"
    exit 0
  }
  if ($process.HasExited) {
    $details = if (Test-Path -LiteralPath $stderrPath) { Get-Content -LiteralPath $stderrPath -Raw } else { '' }
    throw "编辑器桥接意外退出。$details"
  }
}

throw "编辑器桥接在 5 秒内未就绪。日志：$stderrPath"
