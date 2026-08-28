import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { JSDOM } = require('C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://game.local/', pretendToBeVisual: true
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.localStorage = dom.window.localStorage;

const boardJson = JSON.parse(readFileSync(new URL('../config/board.json', import.meta.url), 'utf8'));
const { BoardView } = await import('../js/ui/board.js');

const root = document.getElementById('root');
Object.defineProperty(root, 'clientWidth', { value: 1000 });
Object.defineProperty(root, 'clientHeight', { value: 800 });

const cfg = { board: boardJson };
const board = new BoardView(cfg, root);

const ringOf = id => board.cellRings.get(id);
console.log('total cells:', board.cellEls.size);
console.log('ring of cell 2 (outer):', ringOf(2), '| cell 75 (middle):', ringOf(75), '| cell 150 (inner):', ringOf(150));

// 开局检查
const shownAt = ring => [...board.cellEls.values()].filter(el => el.style.display !== 'none' && el.classList.contains('ring-' + ring)).length;
assert.equal(board.visibleRing, 'outer', '开局 visibleRing 应为 outer');
assert.equal(shownAt('outer'), 72, '开局应显示 72 个外圈格');
assert.equal(shownAt('middle'), 0, '开局应隐藏中圈');
assert.equal(shownAt('inner'), 0, '开局应隐藏内圈');

// 模拟举人阶段：把棋子放到中圈 cell 75，再切到 middle
board.setPiecePos(75);
assert.equal(board.piece.style.opacity, '0', '切圈前，中圈上的棋子应不可见');
board.setVisibleRing('middle');
assert.equal(board.visibleRing, 'middle', '切到 middle 后 visibleRing 应为 middle');
assert.equal(shownAt('outer'), 0, '切到 middle 后外圈应隐藏');
assert.equal(shownAt('middle'), 64, '切到 middle 后应显示 64 个中圈格');
assert.equal(shownAt('inner'), 0, '切到 middle 后内圈仍隐藏');
assert.equal(board.piece.style.opacity, '', '切到 middle 后，中圈上的棋子应可见');
console.log('staged-rings.realdata.test.mjs: 真实 board.json 下分阶段显现通过');
