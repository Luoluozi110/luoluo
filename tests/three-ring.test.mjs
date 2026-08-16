import assert from 'node:assert/strict';
import { Game } from '../js/engine/game.js';

const routeCells = Array.from({ length: 192 }, (_, i) => ({
  id: i,
  type: i === 0 ? 'start' : (i === 36 ? 'battle' : (i === 72 || i === 136 ? 'gate' : 'ping')),
  name: `格${i}`,
  ring: i < 72 ? 'outer' : (i < 136 ? 'middle' : 'inner'),
  routeIndex: i,
  ...(i === 36 ? { phaseGate: { at: 36, cellId: 36, phase: 'xiucai', exam: 'xiucai' } } : {}),
  ...(i === 72 ? { phaseGate: { at: 72, cellId: 72, phase: 'juren', exam: 'juren', transition: 'middle' } } : {}),
  ...(i === 136 ? { phaseGate: { at: 136, cellId: 136, phase: 'jinshi', exam: 'jinshi', transition: 'inner' } } : {})
}));

const cfg = {
  board: {
    layout: 'concentric_spiral',
    routeCells,
    routeSize: 192,
    phaseGates: [
      { at: 36, cellId: 36, phase: 'xiucai', exam: 'xiucai' },
      { at: 72, cellId: 72, phase: 'juren', exam: 'juren', transition: 'middle' },
      { at: 136, cellId: 136, phase: 'jinshi', exam: 'jinshi', transition: 'inner' }
    ],
    mainRing: routeCells
  },
  npcs: [
    { id: 'xiucai', tier: '秀才级', npcs: [{ id: 'npc-x', name: '甲', attrs: {} }] },
    { id: 'juren', tier: '举人级', npcs: [{ id: 'npc-j', name: '乙', attrs: {} }] },
    { id: 'jinshi', tier: '进士级', npcs: [{ id: 'npc-i', name: '丙', attrs: {} }] },
    { id: 'zhukaoguan', isFinal: true, themes: ['huaigu'], battles: 1, npcs: [{ id: 'npc-final', name: '主考官', attrs: {} }] }
  ],
  grades: {},
  affinity: { themes: ['huaigu'], themeNames: { huaigu: '怀古' } },
  inspiration: { battleCost: 0, battleCostLate: 0 },
  attrs: { initial: {}, diminish: false },
  schools: [], talents: [], album: []
};

const events = [];
const ui = {
  movePiece: async () => {},
  highlightCell: () => {},
  toast: () => {},
  onState: () => {},
  showStageChange: async gate => events.push(`stage:${gate.phase}`),
  showPalaceIntro: async () => events.push('palace:intro'),
  showResult: async () => {}
};

const game = new Game(cfg, ui, () => 0);
game.s = {
  routeIndex: 0, pos: 0, ringId: 'outer', phase: 'child', phaseGateSeen: {},
  inspiration: 20, palaceWins: 0, palaceDone: 0, reachedEnd: false,
  battle: { win: 0, draw: 0, loss: 0, streak: 0, maxStreak: 0, upsets: 0, winsByStyle: {} },
  attrs: {}, events: {}, quiz: {}, passive: [], active: [], sky: [],
  npcMech: { history: {}, palace: {} }, over: false
};

game.doBattle = async opts => {
  events.push(opts.label);
  if (opts.isPalace) game.s.palaceWins += 1;
  return 'win';
};
game.endGame = async reason => { game.s.over = true; game.s.endReason = reason; return reason; };

await game.moveSteps(36);
assert.equal(game.s.routeIndex, 36, '路线应到达外圈第36格');
await game.resolveCell();
assert.equal(game.s.phaseGateSeen.xiucai, true, '秀才阶段门只记录一次');
assert.equal(game.s.phase, 'xiucai');
assert.ok(events.includes('stage:xiucai'));
const firstXiucai = events.filter(x => x === '晋阶试·秀才').length;
await game.resolveCell();
assert.equal(events.filter(x => x === '晋阶试·秀才').length, firstXiucai, '阶段门重复落点不得重复触发');

await game.moveSteps(36);
assert.equal(game.s.routeIndex, 72);
await game.resolveCell();
assert.equal(game.s.ringId, 'middle', '外圈终点应进入中圈');
assert.equal(game.s.phaseGateSeen.juren, true);

await game.moveSteps(64);
assert.equal(game.s.routeIndex, 136);
await game.resolveCell();
assert.equal(game.s.ringId, 'inner', '中圈终点应进入内圈');
assert.equal(game.s.phaseGateSeen.jinshi, true);

await game.runPalace();
assert.equal(game.s.palaceWins, 1, '三圈配置殿试只有一场');
assert.equal(game.s.endReason, 'jinbang', '单场殿试胜利应金榜题名');
assert.ok(events.includes('palace:intro'));
console.log('three-ring.test.mjs: 三圈路线 / 三次晋阶试 / 单场殿试全部通过');
