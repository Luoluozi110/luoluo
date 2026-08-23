import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const editorRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(editorRoot, '..');
const require = createRequire(import.meta.url);
const { JSDOM } = require('C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom');
let html = readFileSync(join(editorRoot, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => `<script>${readFileSync(join(editorRoot, src.split('?')[0]), 'utf8')}</script>`);
const dom = new JSDOM(html, { url: 'https://editor.local/', runScripts: 'dangerously', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
await new Promise(resolve => document.readyState !== 'loading' ? resolve() : document.addEventListener('DOMContentLoaded', resolve, { once: true }));
const fire = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }));
const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

const runtime = JSON.parse(readFileSync(join(root, 'feihuaqi-playable/config/album.json'), 'utf8'));
const editor = window.ALBUM.exportRaw();
assert.equal(JSON.stringify(editor), JSON.stringify(runtime), '编辑器默认种子应与运行时 album.json 完全一致');
assert.equal(editor.length, 12);
assert.equal(editor.reduce((n, c) => n + c.branches.length, 0), 24);
assert.equal(editor.reduce((n, c) => n + c.branches.reduce((m, b) => m + b.effects.length, 0), 0), 96);

click(document.querySelector('#albumlist [data-album-edit="0"]'));
const baseXp = document.querySelector('[data-growth-field="baseXp"]');
baseXp.value = '7'; fire(baseXp, 'input');
click(document.getElementById('albumSave'));
assert.equal(window.ALBUM.get()[0].growth.baseXp, 7, '可视化成长数值修改应写入配置');
assert.equal(window.ALBUM.exportRaw()[0].growth.baseXp, 7);
window.ALBUM.importData(runtime, true);

const project = { _type: 'feihua-content', album: window.ALBUM.exportRaw() };
if (JSON.stringify(project.album) !== JSON.stringify(runtime)) {
  const a = project.album, b = runtime;
  outer: for (let i = 0; i < a.length; i++) {
    const walk = (x, y, path) => {
      if (typeof x !== typeof y) { console.log('DIFF', path, typeof x, typeof y); return true; }
      if (x && typeof x === 'object') {
        for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
          if (!(k in x) || !(k in y)) { console.log('DIFF', path + '.' + k, k in x, k in y); return true; }
          if (walk(x[k], y[k], path + '.' + k)) return true;
        }
      } else if (x !== y) { console.log('DIFF', path, x, y); return true; }
      return false;
    };
    if (walk(a[i], b[i], b[i].id)) break outer;
  }
}
assert.equal(JSON.stringify(project.album), JSON.stringify(runtime), '编辑器导出的 album 应与运行时配置一致');
console.log('album-sync.test.mjs: 运行时 / 编辑器 / 分支数量 / 效果数量 / 可视化数值回写全部通过');
