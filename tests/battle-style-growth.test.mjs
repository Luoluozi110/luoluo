#!/usr/bin/env node
// 战斗文体成长回归测试
// 覆盖：单场胜利、重复结算幂等、多场不同文体、后期递减、平局被动只结算一次。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Game } from '../js/engine/game.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/[A-Za-z]:/, s => s.slice(1))), '..');
const CFG_DIR = path.join(ROOT, 'config');
const load = name => JSON.parse(fs.readFileSync(path.join(CFG_DIR, `${name}.json`), 'utf8'));

function buildCfg() {
  const cfg = {};
  for (const name of ['attrs', 'inspiration', 'board', 'questions', 'events', 'talents', 'schools', 'affinity', 'npcs', 'sky', 'grades', 'album', 'synergies', 'npc-mechanics', 'talent-upgrade']) {
    try { cfg[name] = load(name); } catch (_) { cfg[name] = (name === 'npc-mechanics' || name === 'talent-upgrade') ? {} : []; }
  }
  const board = cfg.board;
  board.cellById = new Map((board.mainRing || []).map(c => [c.id, { ...c, ring: 'main' }]));
  board.laps = Number(board.laps) || 2;
  board.ringSize = board.mainRing.length;
  cfg.questions = (cfg.questions || []).filter(q => q.enabled !== false);
  cfg.events = (cfg.events || []).filter(e => e.enabled !== false);
  cfg.affinity.themeNames ||= {};
  cfg.affinity.mannerNames ||= {};
  cfg.affinity.matrix ||= {};
  cfg.talentById = new Map((cfg.talents || []).map(t => [t.id, t]));
  cfg.talentUpgradeById = new Map(Object.entries(cfg['talent-upgrade'] || {}));
  return cfg;
}

function makeUI() {
  return {
    floatAttrs() {}, floatInspiration() {}, onState() {}, showDice() {}, movePiece() {},
    highlightCell() {}, showQuizResult() {}, showSky() {}, skyExpired() {}, showTalentGain() {},
    showPalaceIntro() {}, async showResult() {}, async askReplaceTalent() { return 0; },
    async askScenic() { return false; }, async showQuiz() { return { index: 0, timedOut: false }; },
    async showEvent() { return 0; }, async runBattle() { throw new Error('not used'); }, toast() {}
  };
}

function newGame(rand = () => 0) {
  const g = new Game(buildCfg(), makeUI(), rand);
  g.push = () => {};
  g.grantTalent = async () => false;
  g.start('bowen', { name: '' });
  return g;
}

function npc(name = '测试论敌', attrs = { shi: 5, ci: 5, lian: 5, bi: 5, xue: 5, si: 5 }) {
  return { id: `test_${name}`, name, fullName: name, attrs };
}

function winOut(style) {
  return { result: 'win', style, manner: 'zheli', npcStyle: 'shi', npcDice: 1, upset: false };
}

function drawOut(style) {
  return { result: 'draw', style, manner: 'zheli', npcStyle: 'shi', npcDice: 1 };
}

console.log('== 单场胜利：只增加出战文体 ==');
{
  const g = newGame();
  const session = g.createSession({ npc: npc(), label: '单场·诗' });
  const before = { ...g.s.attrs };
  await g.settleBattle(session, winOut('shi'));
  assert.ok(g.s.attrs.shi > before.shi, '胜利后诗力增加');
  assert.equal(g.s.attrs.ci, before.ci, '未出战词力不变');
  assert.equal(g.s.attrs.lian, before.lian, '未出战联力不变');
  assert.equal(g.s.battle.win, 1, '胜场只记一次');
  assert.equal(g.s.battle.winsByStyle.shi, 1, '诗体胜场只记一次');
}

console.log('== 同一战斗重复结算：属性与统计均不重复 ==');
{
  const g = newGame();
  const session = g.createSession({ npc: npc(), label: '幂等·诗' });
  await g.settleBattle(session, winOut('shi'));
  const afterFirst = { attrs: { ...g.s.attrs }, battle: JSON.parse(JSON.stringify(g.s.battle)), seq: g.s.schoolState.battleSeq };

  // UI 重试通常还会复用同一个对象；WeakSet 负责拦截这一类重复提交。
  await g.settleBattle(session, winOut('shi'));
  assert.deepEqual(g.s.attrs, afterFirst.attrs, '同对象重复结算不再增加任何属性');
  assert.deepEqual(g.s.battle, afterFirst.battle, '同对象重复结算不再增加战绩');
  assert.equal(g.s.schoolState.battleSeq, afterFirst.seq, '同对象重复结算不推进战斗序号');

  // 读档/重试可能产生新的对象引用，但必须携带同一稳定 battleId；
  // 持久化 settledBattleIds 仍应阻止同一场战斗再次发放奖励。
  const restoredSession = { ...session };
  await g.settleBattle(restoredSession, winOut('shi'));
  assert.deepEqual(g.s.attrs, afterFirst.attrs, '复制会话重复结算不再增加任何属性');
  assert.deepEqual(g.s.battle, afterFirst.battle, '复制会话重复结算不再增加战绩');
  assert.equal(g.s.schoolState.battleSeq, afterFirst.seq, '复制会话重复结算不推进战斗序号');
}

console.log('== 多场战斗：不同文体分别成长，不串到其他文体 ==');
{
  const g = newGame();
  const before = { ...g.s.attrs };
  for (const style of ['shi', 'ci', 'lian']) {
    const session = g.createSession({ npc: npc(`测试论敌·${style}`), label: `多场·${style}` });
    await g.settleBattle(session, winOut(style));
  }
  for (const style of ['shi', 'ci', 'lian']) assert.ok(g.s.attrs[style] > before[style], `${style} 只在自身出战时成长`);
  assert.equal(g.s.battle.win, 3, '三场各记一场胜利');
  assert.deepEqual(g.s.battle.winsByStyle, { shi: 1, ci: 1, lian: 1 }, '三种文体胜场分布正确');
}

console.log('== 后期数值：成长递减但每场只增加一次 ==');
{
  const g = newGame();
  g.s.attrs.shi = 50;
  g.s.attrs.ci = 50;
  g.s.attrs.lian = 50;
  const before = g.s.attrs.shi;
  const first = g.createSession({ npc: npc('后期弱敌'), label: '后期·1' });
  await g.settleBattle(first, winOut('shi'));
  const firstGain = g.s.attrs.shi - before;
  assert.equal(firstGain, 1, '高属性碾压时按递减曲线单场只得最小成长 +1');
  const second = g.createSession({ npc: npc('后期弱敌·二'), label: '后期·2' });
  await g.settleBattle(second, winOut('shi'));
  assert.equal(g.s.attrs.shi - before, 2, '两场独立胜利得到两次、而非同场重复的成长');
  assert.equal(g.s.attrs.ci, 50, '后期未出战词力不变');
  assert.equal(g.s.attrs.lian, 50, '后期未出战联力不变');
}

console.log('== 失败成长：只增加出战文体，不误增其他文体 ==');
{
  const g = newGame();
  const before = { ...g.s.attrs };
  const session = g.createSession({ npc: npc('失败·词'), label: '失败·词' });
  await g.settleBattle(session, { result: 'lose', style: 'ci', manner: 'zheli', npcStyle: 'shi', npcDice: 1 });
  assert.equal(g.s.attrs.shi, before.shi, '失败不改变未出战诗力');
  assert.ok(g.s.attrs.ci > before.ci, '失败补偿只增加本场词力');
  assert.equal(g.s.attrs.lian, before.lian, '失败不改变未出战联力');
  assert.equal(g.s.battle.loss, 1, '失败只记一次');
}

console.log('== 平局被动：study_bonus 不因 draw_bonus 重复套用 ==');
{
  const g = newGame();
  const session = g.createSession({ npc: npc('平局论敌'), label: '平局·叠加' });
  session.passiveTalents = [
    { id: 'T018', name: '曲水流觞', effect: { type: 'draw_bonus', value: 1 } },
    { id: 'T027', name: '转益多师', effect: { type: 'study_bonus', value: 1 } }
  ];
  const before = g.s.attrs.ci;
  await g.settleBattle(session, drawOut('ci'));
  // 基础 +1、draw_bonus +1、study_bonus +1，共 +3；旧逻辑会把 study_bonus 应用两次而成 +4。
  assert.equal(g.s.attrs.ci - before, 3, '平局补偿合并后 study_bonus 只应用一次');
  assert.equal(g.s.battle.draw, 1, '平局只记一次');
}

console.log('战斗文体成长回归测试：全部通过 ✓');
