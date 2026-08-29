import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { JSDOM } = require('C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let html = readFileSync(join(root, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (match, src) =>
  `<script>${readFileSync(join(root, src.split('?')[0]), 'utf8')}</script>`);

const dom = new JSDOM(html, { url: 'https://editor.local/', runScripts: 'dangerously', pretendToBeVisual: true });
const { window } = dom;
const { document, localStorage } = window;
await new Promise(resolve => document.readyState !== 'loading'
  ? resolve()
  : document.addEventListener('DOMContentLoaded', resolve, { once: true }));

window.Common.refreshWorkspaceUI();
const summary = document.getElementById('workspaceSummary');
assert.match(summary.textContent, /条内容/);
assert.equal(window.Common.getWorkspaceHealth().ready, 10, '全局状态应覆盖十个内容模块');

window.Common.openCommandPalette();
assert.equal(document.getElementById('commandOverlay').classList.contains('show'), true, '快捷操作面板可打开');
assert.match(document.getElementById('commandList').textContent, /新增题目/);

const search = document.getElementById('commandSearch');
search.value = '天象';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
const sky = document.querySelector('[data-command="tab:sky"]');
assert.ok(sky, '快捷操作可检索模块');
sky.click();
assert.equal(document.getElementById('sky-section').classList.contains('active'), true, '快捷操作可切换模块');

localStorage.setItem('feihua_editors_v1_cloud', JSON.stringify({
  mode: 'repo', owner: 'example', repo: 'content', token: 'legacy-secret'
}));
window.Common.showManagement();
const saved = JSON.parse(localStorage.getItem('feihua_editors_v1_cloud'));
assert.equal(Object.hasOwn(saved, 'token'), false, '旧版本地 Token 会被迁移移除');
assert.equal(document.getElementById('cloudToken'), null, '编辑器不再渲染 GitHub Token 输入框');
assert.ok(document.getElementById('cloudBridgeStatus'), '编辑器会显示本机 gh 桥接状态');

console.log('workspace-ux.test.mjs: 工作台状态、Token 移除与 gh 桥接提示通过');
