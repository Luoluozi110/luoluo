#!/usr/bin/env node
/** 一键启动本机编辑器：不依赖 PowerShell，也不会加载任何 PowerShell Profile。 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.EDITOR_BRIDGE_PORT) || 8787;
const editorUrl = `http://127.0.0.1:${port}/feihua-editors/`;

function bridgeReady() {
  return new Promise(resolveReady => {
    const request = http.get(editorUrl, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolveReady(response.statusCode === 200 && /文心棋.*内容编辑器/.test(body)));
    });
    request.setTimeout(2000, () => request.destroy());
    request.once('error', () => resolveReady(false));
  });
}

function openEditor() {
  const browser = spawn('cmd.exe', ['/d', '/s', '/c', `start "" "${editorUrl}"`], {
    detached: true, stdio: 'ignore', windowsHide: false
  });
  browser.unref();
}

if (await bridgeReady()) {
  openEditor();
  console.log(`编辑器已在运行：${editorUrl}`);
  process.exit(0);
}

let childError = '';
const child = spawn(process.execPath, [resolve(workspaceRoot, 'scripts/serve-editor-bridge.mjs')], {
  cwd: workspaceRoot,
  stdio: 'inherit',
  windowsHide: false,
  env: { ...process.env, EDITOR_BRIDGE_PORT: String(port) }
});
const childExit = new Promise(resolveExit => {
  child.once('error', error => {
    childError = error.message;
    resolveExit({ code: 1, signal: '' });
  });
  child.once('exit', (code, signal) => {
    childError ||= `桥接进程退出（代码 ${code ?? '未知'}${signal ? `，信号 ${signal}` : ''}）`;
    resolveExit({ code, signal });
  });
});

for (let attempt = 1; attempt <= 20; attempt += 1) {
  await new Promise(resolveWait => setTimeout(resolveWait, 250));
  if (await bridgeReady()) {
    openEditor();
    console.log(`编辑器已启动：${editorUrl}`);
    console.log('桥接服务运行中；请保持此窗口开启，按 Ctrl+C 可停止。');
    const result = await childExit;
    if (result.code && result.code !== 0) console.error(childError);
    process.exit(result.code ?? 1);
  }
  if (childError) break;
}

console.error(`编辑器桥接未能启动：${childError || `端口 ${port} 可能被其他程序占用`}`);
process.exit(1);
