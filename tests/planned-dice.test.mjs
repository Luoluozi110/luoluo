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
const session1 = g.createSession({ npc: g.pickNpc(false), label: '测试' });
assert.equal(session1.activeCost('TA08'), 5, '首次成本为 5');
assert.equal(session1.useActive('TA08', 4), true, '首次可以指定 4 点');
assert.equal(session1.plannedDice, 4, '下一骰固定为指定的 4 点');
assert.equal(g.s.inspiration, 25, '首次扣除 5 灵感');
assert.equal(session1.useActive('TA08', 6), false, '同一场不能重复指定下一骰');
const session2 = g.createSession({ npc: g.pickNpc(false), label: '测试' });
assert.equal(session2.activeCost('TA08'), 7, '第二次成本递增为 7');
assert.equal(session2.useActive('TA08', 6), true, '第二场可以再次指定 6 点');
assert.equal(session2.plannedDice, 6, '下一骰固定为 6 点');
assert.equal(g.s.inspiration, 18, '第二次扣除 7 灵感');
const blob = serializeRun(g);
const restored = deserializeRun(blob, cfg);
assert.equal(restored.ok, true, '布局谋篇存档可还原');
assert.equal(restored.state.talentState.activeUses.TA08, 2, '布局谋篇使用次数跨存档保留');
console.log('布局谋篇：成本递增、指定下一骰、每场一次与存档回归全部通过');
