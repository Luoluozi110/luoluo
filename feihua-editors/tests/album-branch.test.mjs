import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { JSDOM } = require('C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let html = readFileSync(join(root, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => `<script>${readFileSync(join(root, src.split('?')[0]), 'utf8')}</script>`);
const dom = new JSDOM(html, { url: 'https://editor.local/', runScripts: 'dangerously', pretendToBeVisual: true });
const { window } = dom; const { document, localStorage } = window;
await new Promise(resolve => document.readyState !== 'loading' ? resolve() : document.addEventListener('DOMContentLoaded', resolve, { once: true }));
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name); } }
const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const fire = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }));
console.log('[1] 可视化分支编辑与原字段兼容');
{
  const original = window.ALBUM.exportRaw()[0];
  click(document.querySelector('#albumlist [data-album-edit="0"]'));
  ok(document.querySelectorAll('#album-branches-editor .album-branch-card').length === original.branches.length, '已有分支渲染为可视化卡片');
  ok(document.querySelectorAll('#album-branches-editor [data-effect-row]').length === original.branches.reduce((n, b) => n + b.effects.length, 0), '效果逐条渲染');
  const name = document.querySelector('#album-branches-editor [data-branch="0"] [data-branch-field="name"]');
  name.value = '可视化路线'; fire(name, 'input');
  click(document.getElementById('albumSave'));
  ok(window.ALBUM.get()[0].branches[0].name === '可视化路线', '分支名称写回 state');
  ok(window.ALBUM.get()[0].unlock && window.ALBUM.get()[0].reward && window.ALBUM.get()[0].text, '主线字段仍完整保留');
  const stored = JSON.parse(localStorage.getItem('feihua_editors_v1_album'));
  ok(stored[0].branches[0].name === '可视化路线' && stored[0].reward.type === original.reward.type, '分支与主线共同持久化');
  const restored = window.ALBUM.exportRaw(); restored[0] = original; window.ALBUM.importData(restored, true);
}
console.log('[2] 分支创建、排序、复制效果');
{
  click(document.querySelector('#albumlist [data-album-edit="0"]'));
  const before = document.querySelectorAll('#album-branches-editor .album-branch-card').length;
  click(document.getElementById('albumBranchAdd'));
  ok(document.querySelectorAll('#album-branches-editor .album-branch-card').length === before + 1, '添加分支');
  click(document.getElementById('albumBranchLink'));
  ok(document.querySelectorAll('#album-branches-editor [data-branch="2"] [data-effect-row]').length >= 1, '从其他分支复制效果');
  click(document.getElementById('albumBranchSort'));
  click(document.getElementById('albumSave'));
  ok(window.ALBUM.validateAll().length === 0, '新增分支后通过校验');
  const restored = window.GAME_ALBUM; window.ALBUM.importData(restored, true);
}
console.log('[3] 非法分支被拦截，不污染数据');
{
  click(document.querySelector('#albumlist [data-album-edit="0"]'));
  const before = JSON.stringify(window.ALBUM.get()[0]);
  const id = document.querySelector('#album-branches-editor [data-branch="0"] [data-branch-field="id"]');
  const same = document.querySelector('#album-branches-editor [data-branch="1"] [data-branch-field="id"]');
  id.value = same.value; fire(id, 'input');
  click(document.getElementById('albumSave'));
  ok(document.getElementById('albumOverlay').classList.contains('show'), '重复分支 ID 阻止保存');
  ok(JSON.stringify(window.ALBUM.get()[0]) === before, '非法数据未污染 state');
  click(document.getElementById('albumCancel'));
}
console.log('[4] 撤销 / 重做');
{
  const original = window.ALBUM.exportRaw();
  const changed = window.ALBUM.exportRaw(); changed[0].name = '撤销测试'; window.ALBUM.importData(changed, true);
  ok(window.ALBUM.get()[0].name === '撤销测试', '变更已提交');
  window.ALBUM.undo(); ok(window.ALBUM.get()[0].name === original[0].name, '撤销恢复旧值');
  window.ALBUM.redo(); ok(window.ALBUM.get()[0].name === '撤销测试', '重做恢复新值');
  window.ALBUM.importData(original, true);
}
console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
