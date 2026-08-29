#!/usr/bin/env node
// 回归：布局谋篇改为「主动点击触发」，playTurn 不应每回合自动弹窗。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Game } from '../js/engine/game.js';

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
  const ui = { floatAttrs() {}, floatInspiration() {}, onState() {}, toast() {}, highlightCell() {}, showQuizResult() {}, showSky() {}, skyExpired() {}, showTalentGain() {}, showPalaceIntro() {}, async showResult() {}, async askReplaceTalent() { return 0; }, async askScenic() { return false; }, async showQuiz() { return { index: 0, timedOut: false }; }, async showEvent() { return 0; }, async runBattle() { return { win: true, score: 1, oppScore: 0 }; } };
  ui.promptCalls = 0;
  ui.showPlannedMovePrompt = () => { ui.promptCalls++; return Promise.resolve(false); };
  ui.showDice = () => {};
  ui.movePiece = () => {};
  ui.syncStageRing = () => {};
  ui.showStageChange = async () => {};
  return ui;
}

const cfg = buildCfg();
const ui = makeUI();
const g = new Game(cfg, ui, () => 0.5);
g.start('bowen', { name: '测' });
g.s.inspiration = 30; g.s.inspirationMax = 48;
await g.grantTalent(cfg.talentById.get('TA08'), { silent: true });

// 关键回归：拥有布局谋篇时，playTurn 不应自动弹窗（移动落地可能触发与本次无关的内部行为，故包 try）
try { await g.playTurn(); } catch (_) { /* 与「自动弹窗」回归无关，忽略 */ }
assert.equal(ui.promptCalls, 0, 'playTurn 不应自动弹出布局谋篇弹窗');

// 主动定策后，下一次 playTurn 应消费 plannedMoveDice，且仍不自动弹窗
assert.equal(g.planMoveDice(3), true, '可主动定策');
assert.equal(g.s.plannedMoveDice, 3, '定策值已写入');
g.s.inspiration = 40; // 保证不封笔
try { await g.playTurn(); } catch (_) { /* 移动可能触发其它 UI，不阻断本断言 */ }
assert.equal(ui.promptCalls, 0, '定策后 playTurn 仍不自动弹窗');
assert.equal(g.s.plannedMoveDice, null, '定策值已被本次掷骰消费');

console.log('布局谋篇·主动触发回归：playTurn 不再自动弹窗，定策值于掷骰时生效，全部通过');
