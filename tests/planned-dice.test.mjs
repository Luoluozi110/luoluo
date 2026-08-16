#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Game } from '../js/engine/game.js';
import { serializeRun, deserializeRun } from '../js/engine/save.js';

const CFG_DIR = path.join(process.cwd(), 'config');
const load = n => JSON.parse(fs.readFileSync(path.join(CFG_DIR, `${n}.json`), 'utf8'));
function buildCfg() {
  const cfg = {};
  for (const n of ['attrs', 'inspiration', 'board', 'questions', 'events', 'talents', 'schools', 'affinity', 'npcs', 'sky', 'grades', 'album', 'synergies', 'npc-mechanics', 'talent-upgrade']) {
    try { cfg[n] = load(n); } catch (_) { cfg[n] = n === 'talent-upgrade' || n === 'npc-mechanics' ? {} : []; }
  }
  cfg.board.cellById = new Map((cfg.board.mainRing || []).map(c => [c.id, { ...c, ring: 'main' }]));
  cfg.board.laps = Number(cfg.board.laps) || 2;
  cfg.board.ringSize = cfg.board.mainRing.length;
  cfg.questions = (cfg.questions || []).filter(q => q.enabled !== false);
  cfg.events = (cfg.events || []).filter(e => e.enabled !== false);
  cfg.affinity.themeNames ||= {}; cfg.affinity.mannerNames ||= {}; cfg.affinity.matrix ||= {};
  cfg.talentById = new Map((cfg.talents || []).map(t => [t.id, t]));
  cfg.talentUpgradeById = new Map(Object.entries(cfg['talent-upgrade'] || {}));
  cfg['npc-mechanics'].signatureTemplates ||= {}; cfg['npc-mechanics'].weaknessTemplates ||= {}; cfg['npc-mechanics'].intentTemplates ||= {}; cfg['npc-mechanics'].budget ||= {};
  return cfg;
}
function makeUI() {
  return { floatAttrs() {}, floatInspiration() {}, onState() {}, toast() {}, highlightCell() {}, showQuizResult() {}, showSky() {}, skyExpired() {}, showTalentGain() {}, showPalaceIntro() {}, async showResult() {}, async askReplaceTalent() { return 0; }, async askScenic() { return false; }, async showQuiz() { return { index: 0, timedOut: false }; }, async showEvent() { return 0; }, async runBattle() { return { win: true, score: 1, oppScore: 0 }; } };
}
const cfg = buildCfg();
const g = new Game(cfg, makeUI(), () => 0.5);
g.start('bowen', { name: '测' });
g.s.inspiration = 30; g.s.inspirationMax = 48;
const ta08 = cfg.talentById.get('TA08');
assert.equal(ta08.name, '布局谋篇');
await g.grantTalent(ta08, { silent: true });
const t = g.s.active.find(x => x.id === 'TA08');
assert.equal(g.plannedMoveCost(), 5, '地图回合首次成本为 5');
assert.equal(g.planMoveDice(4), true, '地图回合可指定 4 格');
assert.equal(g.s.plannedMoveDice, 4, '下一枚地图移动骰固定为 4');
assert.equal(g.s.inspiration, 25, '首次扣除 5 灵感');
assert.equal(g.planMoveDice(6), false, '已有待掷移动骰时不能重复定策');
g.s.plannedMoveDice = null;
assert.equal(g.plannedMoveCost(), 7, '同一局第二次成本递增为 7');
assert.equal(g.planMoveDice(6), true, '同一局可再次指定 6 格');
assert.equal(g.s.plannedMoveDice, 6, '下一枚地图移动骰固定为 6');
assert.equal(g.s.inspiration, 18, '第二次扣除 7 灵感');
const blob = serializeRun(g);
const restored = deserializeRun(blob, cfg);
assert.equal(restored.ok, true, '布局谋篇存档可还原');
assert.equal(restored.state.talentState.activeUses.TA08, 2, '本局递增次数随存档保留');
const g2 = new Game(cfg, makeUI(), () => 0.5);
g2.start('bowen', { name: '新局' });
g2.s.inspiration = 30;
await g2.grantTalent(ta08, { silent: true });
assert.equal(g2.plannedMoveCost(), 5, '新局重新从基础成本开始');
assert.equal(g2.planMoveDice(3), true, '新局可指定移动骰');
assert.equal(g2.s.plannedMoveDice, 3, '新局下一枚移动骰为 3');
console.log('布局谋篇：地图回合定策、同局递增、下一骰生效、新局重置与存档回归全部通过');
