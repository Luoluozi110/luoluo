import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSDOM } = require('C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://game.local/',
  pretendToBeVisual: true
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.localStorage = dom.window.localStorage;

const { BoardView } = await import('../js/ui/board.js');
const cell = (id, ring, ringIndex) => ({ id, ring, ringIndex, type: id === 0 ? 'start' : 'ping', name: `${ring}-${id}` });
const outer = [0, 1, 2, 3].map((_, i) => cell(i, 'outer', i));
const middle = [0, 1, 2, 3].map((_, i) => cell(10 + i, 'middle', i));
const inner = [0, 1, 2, 3].map((_, i) => cell(20 + i, 'inner', i));
const cfg = {
  board: {
    layout: 'concentric_spiral',
    rings: [
      { id: 'outer', grid: 5, cells: outer },
      { id: 'middle', grid: 5, cells: middle },
      { id: 'inner', grid: 5, cells: inner }
    ],
    routeCells: [...outer, ...middle, ...inner],
    routeSize: 12,
    mainRing: [...outer, ...middle, ...inner]
  }
};
const root = document.getElementById('root');
Object.defineProperty(root, 'clientWidth', { value: 800 });
Object.defineProperty(root, 'clientHeight', { value: 600 });
const board = new BoardView(cfg, root);
const visible = ring => [...board.cellEls].filter(([, el]) => el.style.display !== 'none' && el.classList.contains(`ring-${ring}`)).length;
assert.equal(visible('outer'), 4, '开局只显示外圈');
assert.equal(visible('middle'), 0, '开局隐藏中圈');
assert.equal(visible('inner'), 0, '开局隐藏内圈');
board.setVisibleRing('middle');
assert.equal(visible('outer'), 0, '进入举人阶段后外圈消失');
assert.equal(visible('middle'), 4, '进入举人阶段后显示中圈');
assert.equal(visible('inner'), 0, '进入举人阶段后内圈仍隐藏');
board.setVisibleRing('inner');
assert.equal(visible('middle'), 0, '进入进士阶段后中圈消失');
assert.equal(visible('inner'), 4, '进入进士阶段后显示内圈');
console.log('staged-rings.test.mjs: 分阶段显现通过');
