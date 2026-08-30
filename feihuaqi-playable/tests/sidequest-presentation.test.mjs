import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyProjectOverride, normalizeConfig } from '../js/engine/config.js';
import { Game } from '../js/engine/game.js';
import { sideQuestBattleCopy, sideQuestPresentation, sideQuestTransition } from '../js/engine/sidequest-presentation.js';

const read = name => JSON.parse(readFileSync(new URL(`../config/${name}.json`, import.meta.url), 'utf8'));
const cfg = normalizeConfig(Object.fromEntries([
  'attrs', 'inspiration', 'board', 'questions', 'events', 'talents', 'schools', 'affinity', 'npcs', 'sky', 'grades',
  'album', 'synergies', 'npc-mechanics', 'talent-upgrade', 'narrative', 'sidequests', 'sidequest-talents', 'sidequest-npcs'
].map(name => [name, read(name)])));

const routes = cfg.sidequests.routes;
assert.equal(routes.length, 3);
const stageNames = new Set();
for (const route of routes) {
  const decision = sideQuestPresentation(route, { routeId: route.id, stage: 'decision' }, 'xiucai');
  const climax = sideQuestPresentation(route, { routeId: route.id, stage: 'climax' }, 'juren');
  assert.equal(decision.active, true);
  assert.equal(climax.active, true);
  assert.match(decision.stageName, new RegExp(route.name.split('·')[0]));
  assert.match(climax.transition, new RegExp(route.battleLabel));
  assert.equal(climax.battle.kind, route.presentation.battles.climax.kind);
  assert.equal(sideQuestBattleCopy(route, 'final').steps.length, 6);
  stageNames.add(decision.stageName);
  stageNames.add(climax.stageName);
}
assert.equal(stageNames.size, routes.length * 2, '各支线与各幕次使用独立阶段名，不能串线');

const legacyCloudSidequests = JSON.parse(JSON.stringify(cfg.sidequests));
delete legacyCloudSidequests.routeById;
for (const route of legacyCloudSidequests.routes) delete route.presentation;
const mergedLegacyCloud = applyProjectOverride(cfg, { sidequests: legacyCloudSidequests });
assert.ok(mergedLegacyCloud.sidequests.routes.every(route => route.presentation), '旧云端工程覆盖时按 routeId 保留本地展示文案');

const jianghu = routes.find(route => route.id === 'jianghu');
const completed = sideQuestPresentation(jianghu, { routeId: 'jianghu', stage: 'complete' }, 'jinshi');
assert.equal(completed.active, false, '高潮结束后展示语境退出支线');
assert.equal(completed.stageName, '进士', '退出支线后恢复当前主线阶段，而非进入支线前阶段');
assert.match(sideQuestTransition(jianghu, 'complete', 'juren'), /重返「举人」/);

const legacy = { id: 'legacy', name: '旧支线', steps: ['一', '二', '三', '四', '五', '六'] };
assert.equal(sideQuestPresentation(legacy, { routeId: 'legacy', stage: 'decision' }, 'xiucai').active, true, '旧配置仍可进入支线');
assert.deepEqual(sideQuestBattleCopy(legacy, 'climax').steps, legacy.steps, '旧配置继续兼容原 steps 字段');

const noopUi = {
  onState() {}, toast() {}, floatAttrs() {}, floatInspiration() {}, floatInspirationMax() {}, showTalentGain() {},
  showQuizResult() {}, showSky() {}, skyExpired() {}, showDice() {}, movePiece() {}, highlightCell() {},
  async askReplaceTalent() { return -1; }, async chooseScenicTalent() { return -1; }
};
const game = new Game(cfg, noopUi, () => 0.2);
game.start('bowen');
const npc = { id: 'copy_test', name: '试文人', title: '验文', style: 'shi', attrs: { shi: 10, ci: 9, lian: 8, bi: 7, xue: 7, si: 7 } };
const mainSession = game.createSession({ npc, label: '主线论战' });
const climaxSession = game.createSession({ npc, label: jianghu.battleLabel, sideQuestRoute: jianghu, sideQuestBattleKind: 'climax' });
const finalSession = game.createSession({ npc, label: jianghu.finalLabel, sideQuestRoute: jianghu, sideQuestBattleKind: 'final', isPalace: true });
assert.equal(mainSession.copy, null, '主线论战不读取任何支线文案');
assert.equal(climaxSession.copy.kind, '江 湖 辨 义');
assert.equal(finalSession.copy.kind, '群 英 问 义');
assert.notEqual(climaxSession.copy.kind, finalSession.copy.kind, '同一路线高潮与终问也使用独立文案');

const order = [];
const gateUi = {
  ...noopUi,
  syncStageRing() { order.push('sync'); },
  async showStageChange() { order.push('main-stage'); }
};
const gateGame = new Game(cfg, gateUi, () => 0.2);
gateGame.start('bowen');
gateGame.s.phase = 'xiucai';
gateGame.s.phaseGateSeen.xiucai = true;
gateGame.s.routeIndex = 72;
gateGame.s.sideQuest = { ...gateGame.s.sideQuest, routeId: 'jianghu', stage: 'climax', choices: [] };
gateGame.doSideQuestClimax = async () => { order.push('sidequest-climax'); gateGame.s.sideQuest.stage = 'complete'; return true; };
gateGame.doBattle = async () => { order.push('main-battle'); return { result: 'win' }; };
await gateGame.doBattleCell(cfg.board.routeCells[72]);
assert.equal(gateGame.s.phase, 'juren', '阶段门仍推进主线规则阶段');
assert.equal(gateGame.s.ringId, 'middle', '阶段门仍切换主线圈层');
assert.equal(order.includes('main-battle'), false, '支线高潮替换阶段门的下一场主线论战');
assert.ok(order.indexOf('sidequest-climax') < order.indexOf('main-stage'), '先显示支线高潮，合卷后才恢复主线阶段提示');

const fallbackOrder = [];
const fallbackGame = new Game(cfg, {
  ...noopUi,
  syncStageRing() {},
  async showStageChange() { fallbackOrder.push('main-stage'); }
}, () => 0.2);
fallbackGame.start('bowen');
fallbackGame.s.phase = 'xiucai';
fallbackGame.s.phaseGateSeen.xiucai = true;
fallbackGame.s.routeIndex = 72;
fallbackGame.s.sideQuest = { ...fallbackGame.s.sideQuest, routeId: 'removed-route', stage: 'climax' };
fallbackGame.doBattle = async () => { fallbackOrder.push('main-battle'); return { result: 'win' }; };
await fallbackGame.doBattleCell(cfg.board.routeCells[72]);
assert.deepEqual(fallbackOrder, ['main-stage', 'main-battle'], '旧档路线已移除时退回主线晋阶流程，不吞战斗');

console.log('sidequest-presentation.test.mjs: 支线展示隔离、论战文案与阶段门优先级 ✓');
