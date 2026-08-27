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

const { BoardView } = await import('../js/ui/board.js');
const { Game } = await import('../js/engine/game.js');
const boardJson = JSON.parse(readFileSync(new URL('../config/board.json', import.meta.url), 'utf8'));

// 复刻 config.normalize 的 routeCells 推导（routeCells 在原始 board.json 中不存在，由 normalize 生成）
const routeCells = boardJson.route.map((step, i) => {
  const c = boardJson.mainRing.find(x => x.id === step.cellId) || boardJson.mainRing[i];
  return { ...c, id: i, routeIndex: i, ring: step.ring || c.ring || 'main' };
});

const cfg = {
  board: { ...boardJson, routeCells, routeSize: routeCells.length },
  npcs: [
    { id: 'xiucai', tier: '秀才级', npcs: [{ id: 'npc-x', name: '甲', attrs: {} }] },
    { id: 'juren', tier: '举人级', npcs: [{ id: 'npc-j', name: '乙', attrs: {} }] },
    { id: 'jinshi', tier: '进士级', npcs: [{ id: 'npc-i', name: '丙', attrs: {} }] },
    { id: 'zhukaoguan', isFinal: true, themes: ['huaigu'], battles: 1, npcs: [{ id: 'npc-f', name: '主考官', attrs: {} }] }
  ],
  grades: {}, affinity: { themes: ['huaigu'], themeNames: { huaigu: '怀古' } },
  inspiration: { battleCost: 0, battleCostLate: 0 }, attrs: { initial: {}, diminish: false },
  schools: [], talents: [], album: []
};

const root = document.getElementById('root');
Object.defineProperty(root, 'clientWidth', { value: 1000 });
Object.defineProperty(root, 'clientHeight', { value: 800 });
const board = new BoardView({ board: boardJson }, root);
board.setPiecePos(0);

// 复刻 app.js 的当前适配器：引擎通过 syncStageRing 同步，阶段弹窗只负责叙事。
const ui = {
  movePiece: async s => board.setPiecePos(board.cellIdOf(s)),
  highlightCell: () => {}, toast: () => {}, onState: () => {},
  syncStageRing: s => board.revealRouteState(s),
  showStageChange: async () => {},
  showPalaceIntro: async () => {}, showResult: async () => {}
};
const game = new Game(cfg, ui, () => 0);
game.s = {
  routeIndex: 0, pos: 0, ringId: 'outer', phase: 'child', phaseGateSeen: {},
  inspiration: 50, palaceWins: 0, palaceDone: 0, reachedEnd: false,
  battle: { win: 0, draw: 0, loss: 0, streak: 0, maxStreak: 0, upsets: 0, winsByStyle: {} },
  attrs: {}, events: {}, quiz: {}, passive: [], active: [], sky: [],
  npcMech: { history: {}, palace: {} }, over: false
};
game.doBattle = async opts => { if (opts.isPalace) game.s.palaceWins += 1; return 'win'; };
game.endGame = async r => { game.s.over = true; game.s.endReason = r; return r; };

const shownOuter = () => [...board.cellEls.values()].filter(el => el.style.display !== 'none' && el.classList.contains('ring-outer')).length;

// 三座阶段门都必须被逐一拦截；秀才门不切圈，举人/进士门才切图。
const xiucaiMove = await game.moveSteps(72);
assert.deepEqual(xiucaiMove, { arrived: 'gate', gateIndex: 36, remainingSteps: 36 }, '秀才门必须阻断跨门移动');
await game.resolveCell();
assert.equal(board.visibleRing, 'outer', '秀才门后仍显示外圈');

const firstMove = await game.moveSteps(72);
assert.deepEqual(firstMove, { arrived: 'gate', gateIndex: 72, remainingSteps: 36 }, '举人门必须阻断跨门移动');
await game.resolveCell();
assert.equal(board.visibleRing, 'middle', '举人阶段门后 visibleRing 必须为 middle');
assert.equal(shownOuter(), 0, '举人阶段后外圈必须隐藏（修复“外圈仍然显现”）');
assert.equal(board.piece.style.opacity, '', '举人阶段后棋子必须可见（修复“棋子消失”）');
assert.equal(game.s.ringId, 'middle', 's.ringId 应同步为 middle');

// 继续到进士阶段门（routeIndex 136）
const secondMove = await game.moveSteps(64);
assert.deepEqual(secondMove, { arrived: 'gate', gateIndex: 136, remainingSteps: 0 }, '进士门必须阻断跨门移动');
await game.resolveCell();
assert.equal(board.visibleRing, 'inner', '进士阶段门后 visibleRing 必须为 inner');
const shownMiddle = () => [...board.cellEls.values()].filter(el => el.style.display !== 'none' && el.classList.contains('ring-middle')).length;
assert.equal(shownMiddle(), 0, '进士阶段后中圈必须隐藏');
assert.equal(board.piece.style.opacity, '', '进士阶段后棋子必须可见');
console.log('staged-rings-gateflow.test.mjs: 举人/进士阶段门后外圈隐藏、棋子始终可见 ✓');
