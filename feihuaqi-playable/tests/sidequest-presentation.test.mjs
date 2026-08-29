import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeConfig } from '../js/engine/config.js';
import { Game } from '../js/engine/game.js';
import { sideQuestBattleCopy, sideQuestPresentation, sideQuestTransition } from '../js/engine/sidequest-presentation.js';

const read = name => JSON.parse(readFileSync(new URL(`../config/${name}.json`, import.meta.url), 'utf8'));
const cfg = normalizeConfig(Object.fromEntries([
  'attrs', 'inspiration', 'board', 'questions', 'events', 'talents', 'schools', 'affinity', 'npcs', 'sky', 'grades',
  'album', 'synergies', 'npc-mechanics', 'talent-upgrade', 'narrative', 'sidequests', 'sidequest-talents'
].map(name => [name, read(name)])));

const routes = cfg.sidequests.routes;
const names = new Set();
for (const route of routes) {
  const decision = sideQuestPresentation(route, { routeId: route.id, stage: 'decision' }, 'xiucai');
  const climax = sideQuestPresentation(route, { routeId: route.id, stage: 'climax' }, 'juren');
  assert.equal(decision.active, true);
  assert.match(climax.transition, new RegExp(route.battleLabel));
  assert.equal(climax.battle.kind, route.presentation.battles.climax.kind);
  assert.equal(sideQuestBattleCopy(route, 'final').steps.length, 6);
  names.add(decision.stageName); names.add(climax.stageName);
}
assert.equal(names.size, routes.length * 2, '各路线与幕次必须使用独立阶段名');

const jianghu = routes.find(route => route.id === 'jianghu');
const completed = sideQuestPresentation(jianghu, { routeId: 'jianghu', stage: 'complete' }, 'jinshi');
assert.equal(completed.active, false);
assert.equal(completed.stageName, '进士');
assert.match(sideQuestTransition(jianghu, 'complete', 'juren'), /重返「举人」/);
const legacy = { id: 'legacy', name: '旧支线', steps: ['一', '二', '三', '四', '五', '六'] };
assert.deepEqual(sideQuestBattleCopy(legacy, 'climax').steps, legacy.steps, '旧配置继续兼容 steps');

const noopUi = {
  onState() {}, toast() {}, floatAttrs() {}, floatInspiration() {}, floatInspirationMax() {}, showTalentGain() {},
  showQuizResult() {}, showSky() {}, skyExpired() {}, showDice() {}, movePiece() {}, highlightCell() {},
  async askReplaceTalent() { return -1; }, async chooseScenicTalent() { return -1; }
};
const game = new Game(cfg, noopUi, () => 0.2);
game.start('bowen');
const npc = { id: 'copy_test', name: '试文人', title: '验文', style: 'shi', attrs: { shi: 10, ci: 9, lian: 8, bi: 7, xue: 7, si: 7 } };
assert.equal(game.createSession({ npc, label: '主线论战' }).copy, null);
assert.equal(game.createSession({ npc, sideQuestRoute: jianghu, sideQuestBattleKind: 'climax' }).copy.kind, '江 湖 辨 义');
assert.equal(game.createSession({ npc, sideQuestRoute: jianghu, sideQuestBattleKind: 'final', isPalace: true }).copy.kind, '群 英 问 义');

const order = [];
const gateGame = new Game(cfg, { ...noopUi, syncStageRing() {}, async showStageChange() { order.push('main-stage'); } }, () => 0.2);
gateGame.start('bowen');
gateGame.s.phase = 'xiucai'; gateGame.s.phaseGateSeen.xiucai = true; gateGame.s.routeIndex = 72;
gateGame.s.sideQuest = { ...gateGame.s.sideQuest, routeId: 'jianghu', stage: 'climax' };
gateGame.doSideQuestClimax = async () => { order.push('sidequest-climax'); gateGame.s.sideQuest.stage = 'complete'; return true; };
gateGame.doBattle = async () => { order.push('main-battle'); return { result: 'win' }; };
await gateGame.doBattleCell(cfg.board.routeCells[72]);
assert.equal(gateGame.s.phase, 'juren');
assert.equal(gateGame.s.ringId, 'middle');
assert.equal(order.includes('main-battle'), false);
assert.ok(order.indexOf('sidequest-climax') < order.indexOf('main-stage'));

console.log('sidequest-presentation.test.mjs: 支线展示隔离、论战文案与阶段门优先级 ✓');
