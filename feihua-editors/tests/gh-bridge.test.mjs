import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const editorRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = join(editorRoot, '..');
const cloud = readFileSync(join(editorRoot, 'assets/js/cloud.js'), 'utf8');
const common = readFileSync(join(editorRoot, 'assets/js/common.js'), 'utf8');
const bridge = readFileSync(join(workspaceRoot, 'scripts/serve-editor-bridge.mjs'), 'utf8');
const launcher = readFileSync(join(workspaceRoot, 'scripts/start-editor-bridge.mjs'), 'utf8');
const launcherCmd = readFileSync(join(workspaceRoot, '启动编辑器.cmd'), 'utf8');
const packageJson = JSON.parse(readFileSync(join(workspaceRoot, 'package.json'), 'utf8'));

assert.equal(/Authorization\s*:|Bearer\s+\$?\{|ghHeaders|cloudToken/.test(cloud), false,
  '浏览器云端发布代码不应包含 Token 或 Authorization 逻辑');
assert.ok(cloud.includes('const BRIDGE_API = "/api/github";'), '浏览器应改为同源 gh 桥接 API');
assert.equal(common.includes('id="cloudToken"'), false, '发布面板不应再渲染 Token 输入框');
assert.ok(common.includes('id="cloudBridgeStatus"'), '发布面板应显示 gh 桥接状态');
assert.equal(bridge.includes("const host = '127.0.0.1';"), true, '桥接服务必须绑定回环地址');
assert.ok(bridge.includes(".listen(port, host"), '桥接服务必须显式使用回环 host 监听');
assert.ok(bridge.includes("const allowedStaticRoots = ['/feihua-editors/', '/feihuaqi-playable/'];"),
  '静态服务只能提供编辑器与游戏目录，不能暴露整个工作区');
assert.ok(bridge.includes("'/api/github/publish'"), '桥接服务应提供发布接口');
assert.ok(bridge.includes("'HTTP_PROXY'"), '桥接服务应清理可能失效的代理环境变量');
assert.equal(bridge.includes('Authorization'), false, '桥接服务不得接收或构造浏览器 Token');
assert.equal(packageJson.scripts['editor:bridge'], 'node scripts/serve-editor-bridge.mjs', '应提供桥接启动命令');
assert.equal(packageJson.scripts['editor:open'], 'node scripts/start-editor-bridge.mjs',
  '应提供一键启动命令');
assert.ok(launcher.includes('bridgeReady'), '启动器应检查既有桥接状态');
assert.ok(launcher.includes('EDITOR_BRIDGE_PORT: String(port)'), '启动器应把所选端口传给桥接进程');
assert.ok(launcher.includes('detached: true'), '启动器应在后台启动桥接');
assert.ok(launcher.includes('openEditor()'), '启动器就绪后应自动打开编辑器');
assert.equal(launcher.includes('powershell.exe'), false, '启动器不应调用 PowerShell');
assert.ok(launcherCmd.includes('start-editor-bridge.mjs'), '项目根目录应提供可双击的启动文件');

console.log('gh-bridge.test.mjs: Token 已移除，localhost gh 桥接契约通过');
