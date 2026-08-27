import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const editorRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = join(editorRoot, '..');
const cloud = readFileSync(join(editorRoot, 'assets/js/cloud.js'), 'utf8');
const common = readFileSync(join(editorRoot, 'assets/js/common.js'), 'utf8');
const bridge = readFileSync(join(workspaceRoot, 'scripts/serve-editor-bridge.mjs'), 'utf8');
const packageJson = JSON.parse(readFileSync(join(workspaceRoot, 'package.json'), 'utf8'));

assert.equal(/Authorization\s*:|Bearer\s+\$?\{|ghHeaders|cloudToken/.test(cloud), false,
  '浏览器云端发布代码不应包含 Token 或 Authorization 逻辑');
assert.ok(cloud.includes('const BRIDGE_API = "/api/github";'), '浏览器应改为同源 gh 桥接 API');
assert.equal(common.includes('id="cloudToken"'), false, '发布面板不应再渲染 Token 输入框');
assert.ok(common.includes('id="cloudBridgeStatus"'), '发布面板应显示 gh 桥接状态');
assert.equal(bridge.includes("const host = '127.0.0.1';"), true, '桥接服务必须绑定回环地址');
assert.ok(bridge.includes(".listen(port, host"), '桥接服务必须显式使用回环 host 监听');
assert.ok(bridge.includes("'/api/github/publish'"), '桥接服务应提供发布接口');
assert.ok(bridge.includes("'HTTP_PROXY'"), '桥接服务应清理可能失效的代理环境变量');
assert.equal(bridge.includes('Authorization'), false, '桥接服务不得接收或构造浏览器 Token');
assert.equal(packageJson.scripts['editor:bridge'], 'node scripts/serve-editor-bridge.mjs', '应提供桥接启动命令');

console.log('gh-bridge.test.mjs: Token 已移除，localhost gh 桥接契约通过');
