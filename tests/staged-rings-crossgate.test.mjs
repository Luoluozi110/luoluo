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

const routeCells = boardJson.route.map((step, i) => {
  const cell = boardJson.mainRing.find(x => x.id === step.cellId) || boardJson.mainRing[i];
  return { ...cell, id: i, routeIndex: i, ring: step.ring || cell.ring || 'main' };
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
  questions: [], events: [], schools: [], talents: [], album: []
};

const root = document.getElementById('root');
Object.defineProperty(root, 'clientWidth', { value: 1000 });
Object.defineProperty(root, 'clientHeight', { value: 800 });
const board = new BoardView({ board: boardJson }, root);
const events = [];
const ui = {
  movePiece: async state => board.movePiece(state),
  highlightCell: () => {}, toast: () => {}, onState: () => {}, showDice: async () => {},
  // 模拟弹窗只负责叙事、完全不负责切图；切圈必须由引擎 syncStageRing 保证。
  showStageChange: async gate => events.push(`modal:${gate.phase}`),
  syncStageRing: state => { events.push(`sync:${state.ringId}`); board.revealRouteState(state); },
  showPalaceIntro: async () => {}, showResult: async () => {}
};
const game = new Game(cfg, ui, () => 0);
game.s = {
  routeIndex: 70, pos: 70, ringId: 'outer', phase: 'xiucai', phaseGateSeen: { xiucai: true },
  inspiration: 50, palaceWins: 0, palaceDone: 0, reachedEnd: false,
  battle: { win: 0, draw: 0, loss: 0, streak: 0, maxStreak: 0, upsets: 0, winsByStyle: {} },
  school: { id: 'test', schoolMechanics: {} }, schoolState: { type: 'test', knowledge: 0, inspirationAccumulator: 0 },
  attrs: {}, events: {}, quiz: {}, passive: [], active: [], sky: [], usedQuestions: new Set(), seenEvents: new Set(),
  npcMech: { history: {}, palace: {} }, over: false
};
game.doBattle = async () => 'win';
game.endGame = async reason => { game.s.over = true; game.s.endReason = reason; return reason; };

// 关键复现：从外圈第70格掷出4点。旧逻辑会直接走到74而跳过72门，留下 outer + 透明棋子。
// 注：真实 72 格外圈的 ringIndex 从 0..71，routeIndex=72 已是中圈首格；门格本身属于 middle。
const moved = await game.moveSteps(4);
assert.deepEqual(moved, { arrived: 'gate', gateIndex: 72, remainingSteps: 2 }, '跨入中圈时必须停在第72格晋阶门，记录本骰尚余步数');
assert.equal(game.s.routeIndex, 72, '跨门骰必须停在举人门');
assert.equal(game.s.ringId, 'middle', '抵达举人门后状态已进入中圈');
assert.equal(board.piece.style.opacity, '0', '弹窗确认前，中圈棋子应暂时隐藏');
await game.resolveCell();
assert.equal(board.visibleRing, 'middle', '阶段门结算必须由 syncStageRing 切入中圈');
assert.equal(board.piece.style.opacity, '', '中圈揭示后棋子必须恢复可见');
assert.equal([...board.cellEls.values()].filter(el => el.classList.contains('ring-outer') && el.style.display !== 'none').length, 0, '中圈揭示后外圈必须隐藏');
assert.deepEqual(events, ['sync:middle', 'modal:juren', 'sync:middle'], '切圈在弹窗前后均由引擎同步，弹窗不能成为唯一入口');

// 手动调用 moveSteps 的消费者可使用 remainingSteps 补走；真实 playTurn 会在同一回合自动补走。
const afterGate = await game.moveSteps(2);
assert.deepEqual(afterGate, { arrived: 'ok', gateIndex: null });
assert.equal(game.s.routeIndex, 74, '晋阶试结束后可从门格继续前进');
assert.equal(board.piece.style.opacity, '', '中圈正常前进时棋子持续可见');

// 再从完整 playTurn 入口复现一次：骰子跨门也必须完成揭示与晋阶试，并走完余下2步。
game.s.routeIndex = 70;
game.s.pos = 70;
game.s.ringId = 'outer';
game.s.phase = 'xiucai';
game.s.phaseGateSeen = { xiucai: true };
game.s.turn = 3;
events.length = 0;
board.revealRouteState(game.s);
game.d6 = () => 4;
await game.playTurn();
assert.equal(game.s.routeIndex, 74, '完整回合从70掷4必须结算举人门后继续走完余下2步');
assert.equal(board.visibleRing, 'middle', '完整回合阶段门后必须显示中圈');
assert.equal(board.piece.style.opacity, '', '完整回合阶段门后棋子必须可见');
assert.deepEqual(events, ['sync:middle', 'modal:juren', 'sync:middle'], '完整回合也必须使用引擎双重同步');
console.log('staged-rings-crossgate.test.mjs: 跨阶段门不能跳过，棋盘与棋子同步恢复 ✓');
