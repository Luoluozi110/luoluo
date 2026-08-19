#!/usr/bin/env node
// 战斗文体成长回归测试
// 覆盖：方案 B 的熟练/心得、重复结算幂等、多体分流、后期递减、平局被动。
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
  return { result: 'win', style, manner: 'zheli', npcStyle: 'shi', npcDice: 1, dicePips: [3], upset: false };
}

function drawOut(style) {
  return { result: 'draw', style, manner: 'zheli', npcStyle: 'shi', npcDice: 1, dicePips: [3] };
}

console.log('== 单场胜利：产出心得/熟练，不再直接灌属性 ==');
{
  const g = newGame();
  const session = g.createSession({ npc: npc(), label: '单场·诗' });
  const before = { ...g.s.attrs };
  await g.settleBattle(session, winOut('shi'));
  assert.equal(g.s.attrs.shi, before.shi, '单场胜利不直接增加诗力');
  assert.equal(g.s.attrs.ci, before.ci, '未出战词力不变');
  assert.equal(g.s.attrs.lian, before.lian, '未出战联力不变');
  assert.equal(g.s.battle.win, 1, '胜场只记一次');
  assert.equal(g.s.battle.winsByStyle.shi, 1, '诗体胜场只记一次');
  assert.equal(g.s.abilityState.familiarity.shi, 1, '出战诗体获得 1 熟练');
  assert.equal(g.s.abilityState.insight, 5, '胜利3 + 阶段首用1 + 诗单骰胜1 = 5 心得');
  assert.equal(g.s.abilityState.manuscript.pages, 2, '单骰胜利沉淀 2 稿页');
}

console.log('== 同一战斗重复结算：属性与统计均不重复 ==');
{
  const g = newGame();
  const session = g.createSession({ npc: npc(), label: '幂等·诗' });
  await g.settleBattle(session, winOut('shi'));
  const afterFirst = { attrs: { ...g.s.attrs }, battle: JSON.parse(JSON.stringify(g.s.battle)), ability: JSON.parse(JSON.stringify(g.s.abilityState)), seq: g.s.schoolState.battleSeq };

  // UI 重试通常还会复用同一个对象；WeakSet 负责拦截这一类重复提交。
  await g.settleBattle(session, winOut('shi'));
  assert.deepEqual(g.s.attrs, afterFirst.attrs, '同对象重复结算不再增加任何属性');
  assert.deepEqual(g.s.battle, afterFirst.battle, '同对象重复结算不再增加战绩');
  assert.deepEqual(g.s.abilityState, afterFirst.ability, '同对象重复结算不再增加心得/稿页/熟练');
  assert.equal(g.s.schoolState.battleSeq, afterFirst.seq, '同对象重复结算不推进战斗序号');

  // 读档/重试可能产生新的对象引用，但必须携带同一稳定 battleId；
  // 持久化 settledBattleIds 仍应阻止同一场战斗再次发放奖励。
  const restoredSession = { ...session };
  await g.settleBattle(restoredSession, winOut('shi'));
  assert.deepEqual(g.s.attrs, afterFirst.attrs, '复制会话重复结算不再增加任何属性');
  assert.deepEqual(g.s.battle, afterFirst.battle, '复制会话重复结算不再增加战绩');
  assert.deepEqual(g.s.abilityState, afterFirst.ability, '复制会话重复结算不再增加三功资源');
  assert.equal(g.s.schoolState.battleSeq, afterFirst.seq, '复制会话重复结算不推进战斗序号');
}

console.log('== 多场战斗：不同文体分别积累熟练 ==');
{
  const g = newGame();
  const before = { ...g.s.attrs };
  for (const style of ['shi', 'ci', 'lian']) {
    const session = g.createSession({ npc: npc(`测试论敌·${style}`), label: `多场·${style}` });
    await g.settleBattle(session, winOut(style));
  }
  assert.ok(g.s.attrs.shi > before.shi, '默认诗体研修位在三场后兑现 +1');
  assert.equal(g.s.attrs.ci, before.ci, '词体一场熟练尚未跨阈值');
  assert.equal(g.s.attrs.lian, before.lian, '联体一场熟练尚未跨阈值');
  assert.deepEqual(g.s.abilityState.familiarity, { shi: 1, ci: 1, lian: 1 }, '三体熟练互不串线');
  assert.equal(g.s.battle.win, 3, '三场各记一场胜利');
  assert.deepEqual(g.s.battle.winsByStyle, { shi: 1, ci: 1, lian: 1 }, '三种文体胜场分布正确');
}

console.log('== 后期数值：三场阈值兑现，且仍走递减 ==');
{
  const g = newGame();
  g.s.attrs.shi = 50;
  g.s.attrs.ci = 50;
  g.s.attrs.lian = 50;
  const before = g.s.attrs.shi;
  const first = g.createSession({ npc: npc('后期弱敌'), label: '后期·1' });
  await g.settleBattle(first, winOut('shi'));
  assert.equal(g.s.attrs.shi, before, '第一场只积累进度');
  const second = g.createSession({ npc: npc('后期弱敌·二'), label: '后期·2' });
  await g.settleBattle(second, winOut('shi'));
  assert.equal(g.s.attrs.shi, before, '第二场仍未跨 3 点阈值');
  const third = g.createSession({ npc: npc('后期弱敌·三'), label: '后期·3' });
  await g.settleBattle(third, winOut('shi'));
  assert.equal(g.s.attrs.shi - before, 2, '第三场熟练与研修各兑现 +1，均按最小成长落地');
  assert.equal(g.s.attrs.ci, 50, '后期未出战词力不变');
  assert.equal(g.s.attrs.lian, 50, '后期未出战联力不变');
}

console.log('== 失败成长：给心得与熟练，不制造负反馈螺旋 ==');
{
  const g = newGame();
  const before = { ...g.s.attrs };
  const session = g.createSession({ npc: npc('失败·词'), label: '失败·词' });
  await g.settleBattle(session, { result: 'lose', style: 'ci', manner: 'zheli', npcStyle: 'shi', npcDice: 1, dicePips: [2] });
  assert.equal(g.s.attrs.shi, before.shi, '失败不改变未出战诗力');
  assert.equal(g.s.attrs.ci, before.ci, '一次失败不直接增加词力');
  assert.equal(g.s.attrs.lian, before.lian, '失败不改变未出战联力');
  assert.equal(g.s.battle.loss, 1, '失败只记一次');
  assert.equal(g.s.abilityState.familiarity.ci, 1, '失败仍获得词体熟练');
  assert.equal(g.s.abilityState.insight, 3, '失败2 + 阶段首用1 = 3 心得');
}

console.log('== 平局被动：转化为心得且不重复套用 ==');
{
  const g = newGame();
  const session = g.createSession({ npc: npc('平局论敌'), label: '平局·叠加' });
  session.passiveTalents = [
    { id: 'T018', name: '曲水流觞', effect: { type: 'draw_bonus', value: 1 } },
    { id: 'T027', name: '转益多师', effect: { type: 'study_bonus', value: 1 } }
  ];
  const before = g.s.attrs.ci;
  await g.settleBattle(session, drawOut('ci'));
  assert.equal(g.s.attrs.ci, before, '平局不再直接灌入出战文体');
  assert.equal(g.s.abilityState.insight, 6, '平局3 + 首用1 + draw_bonus1 + study_bonus1 = 6 心得');
  assert.equal(g.s.battle.draw, 1, '平局只记一次');
}

console.log('战斗文体成长回归测试：全部通过 ✓');
