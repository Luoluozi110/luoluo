#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Game } from '../js/engine/game.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/[A-Za-z]:/, s => s.slice(1))), '..');
const CFG_DIR = path.join(ROOT, 'config');
const load = name => JSON.parse(fs.readFileSync(path.join(CFG_DIR, `${name}.json`), 'utf8'));

function buildCfg() {
  const cfg = {};
  for (const name of ['attrs', 'inspiration', 'board', 'questions', 'events', 'talents', 'schools', 'affinity', 'npcs', 'sky', 'grades']) cfg[name] = load(name);
  for (const name of ['album', 'synergies', 'npc-mechanics', 'talent-upgrade']) {
    try { cfg[name] = load(name); } catch (_) { cfg[name] = name === 'npc-mechanics' || name === 'talent-upgrade' ? {} : []; }
  }
  const board = cfg.board;
  const byId = new Map();
  for (const c of board.mainRing) byId.set(c.id, { ...c, ring: 'main' });
  board.cellById = byId;
  board.laps = Number(board.laps) || 2;
  board.ringSize = board.mainRing.length;
  cfg.questions = (cfg.questions || []).filter(q => q.enabled !== false);
  cfg.events = (cfg.events || []).filter(e => e.enabled !== false);
  cfg.affinity.themeNames ||= {};
  cfg.affinity.mannerNames ||= {};
  cfg.affinity.matrix ||= {};
  cfg.talentById = new Map((cfg.talents || []).map(t => [t.id, t]));
  cfg.talentUpgradeById = new Map(Object.entries(cfg['talent-upgrade'] || {}));
  cfg['npc-mechanics'].signatureTemplates ||= {};
  cfg['npc-mechanics'].weaknessTemplates ||= {};
  cfg['npc-mechanics'].intentTemplates ||= {};
  cfg['npc-mechanics'].budget ||= {};
  return cfg;
}

function makeUI(choiceIndex = 0) {
  const calls = { echoes: [], toasts: [], states: 0, events: [] };
  return {
    calls,
    floatAttrs() {}, floatInspiration() {}, showDice() {}, movePiece() {}, highlightCell() {},
    showQuizResult() {}, showSky() {}, skyExpired() {}, showTalentGain() {}, showPalaceIntro() {},
    async showResult() {}, async askReplaceTalent() { return 0; }, async askScenic() { return false; },
    async showQuiz() { return { index: 0, timedOut: false }; },
    async showEvent(ev) { calls.events.push(ev.id); return choiceIndex; },
    async runBattle() { return { win: true, score: 1, oppScore: 0 }; },
    onState() { calls.states++; },
    toast(text) { calls.toasts.push(text); },
    showChoiceEcho(echo) { calls.echoes.push({ ...echo }); }
  };
}

function newGame(choiceIndex = 0, schoolId = 'bowen') {
  const ui = makeUI(choiceIndex);
  const g = new Game(buildCfg(), ui, () => 0);
  g.start(schoolId, { name: '' });
  return { g, ui };
}

console.log('== 配置完整性 ==');
{
  const events = load('events');
  const choiceEvents = events.filter(e => e.kind === 'choice');
  const choices = choiceEvents.flatMap(e => e.choices || []);
  assert.equal(choiceEvents.length, 14, '应有 14 个 choice 事件');
  assert.equal(choices.length, 28, '应有 28 个选项');
  assert.equal(choices.filter(c => typeof c.resultText === 'string' && c.resultText.trim()).length, 28, '28 个选项均有非空 resultText');
  console.log('  ✓ 14 个选择事件、28 个选项均配置专属回声');
}

console.log('== 选择与回声严格对应 ==');
{
  const { g, ui } = newGame(1);
  const ev = g.cfg.events.find(e => e.id === 'E006');
  const beforeBi = g.s.attrs.bi;
  const beforeSi = g.s.attrs.si;
  const echo = await g.applyEventChoice(ev, 1);
  assert.equal(echo.choiceText, ev.choices[1].text);
  assert.equal(echo.resultText, ev.choices[1].resultText);
  assert.equal(ui.calls.echoes.length, 1);
  assert.equal(ui.calls.echoes[0].choiceText, ev.choices[1].text);
  assert.equal(ui.calls.echoes[0].resultText, ev.choices[1].resultText);
  assert.equal(g.s.attrs.bi, beforeBi + 4, '第二项笔力效果生效');
  assert.equal(g.s.attrs.si, beforeSi, '第一项思力效果未串入');
  assert.match(g.s.log.at(-1).text, new RegExp(ev.choices[1].text));
  assert.match(g.s.log.at(-1).text, new RegExp(ev.choices[1].resultText));
  console.log('  ✓ 选第 2 项只返回第 2 项回声，并只应用第 2 项效果');
}

console.log('== 旧数据兜底 ==');
{
  const { g, ui } = newGame(0);
  const ev = { id: 'OLD', name: '旧奇遇', kind: 'choice', choices: [{ text: '保留旧选项', effect: {} }] };
  const echo = await g.applyEventChoice(ev, 0);
  assert.equal(echo.resultText, '选择已确认：「保留旧选项」');
  assert.equal(ui.calls.echoes[0].resultText, echo.resultText);
  console.log('  ✓ 缺少 resultText 时仍返回与所选内容直接关联的确认句');
}

console.log('== 普通奇遇入口 ==');
{
  const { g, ui } = newGame(1);
  const ev = g.cfg.events.find(e => e.id === 'E007');
  g.cfg.events = [ev];
  g.s.seenEvents.clear();
  ui.calls.states = 0;
  await g.doEvent({ type: 'event' });
  assert.deepEqual(ui.calls.events, ['E007']);
  assert.equal(ui.calls.echoes.length, 1);
  assert.equal(ui.calls.echoes[0].choiceText, ev.choices[1].text);
  assert.equal(ui.calls.states, 1);
  console.log('  ✓ 普通奇遇点击后即时产生一次对应回声');
}

console.log('== 辞宗战后轻奇遇入口 ==');
{
  const { g, ui } = newGame(0, 'cizong_bi');
  const ev = g.cfg.events.find(e => e.id === 'E015');
  g.s.schoolState.battleSeq = 2;
  g.cfg.events = [ev];
  g.s.seenEvents.clear();
  const ran = await g.runCizongLightEvent();
  assert.equal(ran, true);
  assert.deepEqual(ui.calls.events, ['E015']);
  assert.equal(ui.calls.echoes.length, 1);
  assert.equal(ui.calls.echoes[0].choiceText, ev.choices[0].text);
  console.log('  ✓ 辞宗轻奇遇同样产生一次对应回声');
}

console.log('选择产生回声：全部测试通过');
