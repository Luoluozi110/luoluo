import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const editorRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = join(editorRoot, '..');
const port = 18000 + (process.pid % 1000);
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [join(workspaceRoot, 'scripts/serve-editor-bridge.mjs')], {
  cwd: workspaceRoot,
  env: { ...process.env, EDITOR_BRIDGE_PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true
});

let childError = '';
child.stderr.setEncoding('utf8').on('data', chunk => { childError += chunk; });

async function waitUntilReady() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode != null) throw new Error(childError || `桥接提前退出：${child.exitCode}`);
    try {
      const response = await fetch(`${base}/feihua-editors/`);
      if (response.ok) return;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('桥接测试服务未在规定时间内启动');
}

try {
  await waitUntilReady();
  const preflight = await fetch(`${base}/api/github/status`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://luoluozi110.github.io',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Private-Network': 'true'
    }
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://luoluozi110.github.io');
  assert.equal(preflight.headers.get('access-control-allow-private-network'), 'true');
  assert.match(preflight.headers.get('access-control-allow-methods') || '', /GET/);

  const rejected = await fetch(`${base}/api/github/status`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://attacker.example', 'Access-Control-Request-Method': 'GET' }
  });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get('access-control-allow-origin'), null);
} finally {
  child.kill();
}

console.log('bridge-cors.integration.test.mjs: 正式编辑器回环桥接预检与来源限制通过');
