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
const { document } = window;
await new Promise(resolve => document.readyState !== 'loading'
  ? resolve()
  : document.addEventListener('DOMContentLoaded', resolve, { once: true }));

const fire = (element, type) => element.dispatchEvent(new window.Event(type, { bubbles: true }));
const board = window.BOARD.get();
const rings = ['outer', 'middle', 'inner'];

assert.equal(document.querySelectorAll('#boardRingTabs [data-ring-filter]').length, 3, '三个圈层均有独立入口');
for (const ring of rings) {
  const expected = board.mainRing.filter(cell => cell.ring === ring).length;
  const filter = document.getElementById('boardFRing');
  filter.value = ring;
  fire(filter, 'change');
  const cards = document.querySelectorAll('#boardlist .board-card');
  assert.equal(cards.length, expected, `${ring} 筛选显示正确格数`);
  assert.ok([...cards].every(card => card.classList.contains(`ring-${ring}`)), `${ring} 卡片有对应视觉层级类`);
}

document.querySelector('#boardRingTabs [data-ring-filter="inner"]').click();
assert.equal(document.getElementById('boardFRing').value, 'all', '再次点击当前圈层可返回全部视图');

const inner = board.mainRing.find(cell => cell.ring === 'inner');
const innerIndex = board.mainRing.indexOf(inner);
const filter = document.getElementById('boardFRing');
filter.value = 'inner'; fire(filter, 'change');
document.querySelector(`#boardlist [data-edit="${innerIndex}"]`).click();
assert.match(document.getElementById('board-cell-ring').textContent, /内圈/, '编辑弹窗展示格子所属圈层');

console.log('board-ring-layering.test.mjs: 三圈分组、筛选与编辑器圈层提示通过');
