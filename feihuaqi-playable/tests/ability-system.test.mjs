#!/usr/bin/env node
// 方案 B 核心验收 + 方案 C 数据铺垫。
// 覆盖：共通文体公式、三体骰型、学/思/笔非创作能力、技法经验阈值。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R from '../js/engine/rules.js';
import { Game } from '../js/engine/game.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CFG_DIR = path.join(ROOT, 'config');
const load = name => JSON.parse(fs.readFileSync(path.join(CFG_DIR, `${name}.json`), 'utf8'));

function buildCfg() {
  const cfg = {};
  for (const name of ['attrs', 'inspiration', 'board', 'questions', 'events', 'talents', 'schools', 'affinity', 'npcs', 'sky', 'grades', 'album', 'synergies', 'npc-mechanics', 'talent-upgrade']) {
    try { cfg[name] = load(name); } catch (_) { cfg[name] = (name === 'npc-mechanics' || name === 'talent-upgrade') ? {} : []; }
  }
  cfg.board.cellById = new Map((cfg.board.mainRing || []).map(c => [c.id, { ...c, ring: 'main' }]));
  cfg.board.laps = Number(cfg.board.laps) || 2;
  cfg.board.ringSize = cfg.board.mainRing.length;
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
    showPalaceIntro() {}, toast() {}, async showResult() {}, async askReplaceTalent() { return 0; },
    async askScenic() { return false; }, async showQuiz() { return { index: 0, timedOut: false }; },
    async showEvent() { return 0; }, async runBattle() { throw new Error('not used'); }
  };
}

function newGame(school = 'bowen') {
  const game = new Game(buildCfg(), makeUI(), () => 0);
  game.push = () => {};
  game.grantTalent = async () => false;
  game.applyLoadout = () => {};
  game.start(school, { name: '' });
  return game;
}

function npc(name = '试法者') {
  return { id: `test_${name}`, name, fullName: name, attrs: { shi: 5, ci: 5, lian: 5, bi: 5, xue: 5, si: 5 } };
}

console.log('== 文体底盘：最高项不再按 ×10 独占基础分 ==');
{
  const attrs = { shi: 34, ci: 20, lian: 18, bi: 0, xue: 0, si: 0 };
  assert.equal(R.styleBaseScore(attrs, 'shi').total, 270);
  assert.equal(R.styleBaseScore(attrs, 'ci').total, 228);
  assert.equal(R.styleBaseScore(attrs, 'lian').total, 222);
  assert.equal(270 - 222, 48, '34/20/18 的首尾差从旧公式 160 收敛为 48');

  const base = { shi: 0, ci: 0, lian: 0, bi: 0, xue: 0, si: 0 };
  const scoreWith = attr => R.battleScore({ attrs: { ...base, [attr]: 10 }, style: 'shi', diceFixed: 0 }).total;
  assert.deepEqual(['bi', 'xue', 'si'].map(scoreWith), [40, 40, 40], '三项基本功的创作加成等权');
}

console.log('== 三种文体：骰型形成不同风险与资源倾向 ==');
{
  const styles = buildCfg().attrs.styleSystem;
  assert.equal(R.styleDiceScore('shi', [2], styles).score, 7, '诗低骰收缩');
  assert.equal(R.styleDiceScore('shi', [5], styles).score, 38, '诗高骰爆发');
  assert.equal(R.styleDiceScore('ci', [1], styles).score, 15, '词首骰保底至 3');
  assert.equal(R.styleDiceScore('ci', [6], styles).score, 25, '词首骰封顶为 5');
  assert.equal(R.styleDiceScore('ci', [1, 6], styles).score, 45, '词的追加骰保留原值');
  assert.equal(R.styleDiceScore('lian', [2, 5], styles).score, 35, '联按对举骰列稳定累加');
}

console.log('== 学力：扩充心得容量与研修位 ==');
{
  const ordinary = newGame('qishi');
  const learned = newGame('bowen');
  assert.ok(learned.insightCap() > ordinary.insightCap(), '学力主修拥有更高心得容量');
  assert.ok(learned.studySlots() > ordinary.studySlots(), '博闻额外研修位已落地');
  learned.s.abilityState.insight = learned.insightCap();
  assert.equal(learned.toggleStudyFocus('bi'), true, '第二研修位可为下阶段分配给基本功');
  assert.ok(learned.s.abilityState.study.nextFocus.includes('bi'));
  assert.equal(learned.s.abilityState.study.focus.includes('bi'), false, '当前阶段不会被即时改写');
  learned.refillStrategy('outer');
  assert.ok(learned.s.abilityState.study.focus.includes('bi'), '进入下阶段后应用排定的研修方向');
}

console.log('== 思力：阶段预案自动触发，不产生回合弹窗 ==');
{
  const game = newGame('qishi');
  game.s.attrs.si = 20;
  assert.equal(game.strategyIncome(), 3, '20 思力每阶段取得 3 构思');
  assert.equal(game.strategyCap(), 4, '奇士 20 思力达到 4 点构思上限');
  assert.equal(game.setNextStrategyPlan('switch'), true);
  assert.equal(game.refillStrategy('outer'), 3);
  assert.equal(game.s.abilityState.strategy.plan, 'switch', '下阶段预案已经锁定');
  const firstSwitch = { lastStyle: 'shi', strategyPlanTriggered: null };
  assert.equal(game.strategyBattlePct(firstSwitch, 'ci'), 0.06, '换体自动获得转锋加成');
  assert.equal(game.s.abilityState.strategy.charges, 3, '奇士本阶段第一次发动免费');
  const secondSwitch = { lastStyle: 'ci', strategyPlanTriggered: null };
  assert.equal(game.strategyBattlePct(secondSwitch, 'lian'), 0.06);
  assert.equal(game.s.abilityState.strategy.charges, 2, '后续发动才消耗筹策');
  assert.equal(game.strategyBattlePct({ lastStyle: 'lian', strategyPlanTriggered: null }, 'lian'), 0, '不换体不触发');

  game.setNextStrategyPlan('steady');
  game.refillStrategy('middle');
  game.s.abilityState.manuscript.fragments = 0;
  assert.equal(game.applyStrategyMovement(2), 2, '徐行拾句不改变原始 2 点骰');
  assert.equal(game.s.abilityState.manuscript.fragments, 1, '原始骰 1～3 点时额外获得 1 份残页');
  assert.equal(game.s.abilityState.strategy.charges, 3, '新阶段首次发动再次免费');
  assert.equal(game.applyStrategyMovement(3), 3, '徐行拾句不改变原始 3 点骰');
  assert.equal(game.s.abilityState.manuscript.fragments, 2, '原始 3 点骰同样获得残页');
  assert.equal(game.applyStrategyMovement(4), 4, '4 点骰不触发徐行拾句');
  assert.equal(game.s.abilityState.manuscript.fragments, 2, '4 点骰不获得额外残页');
  assert.equal(game.applyStrategyMovement(2, true), 2, '预先指定的移动骰不触发徐行拾句');
  assert.equal(game.s.abilityState.manuscript.fragments, 2, '预先指定的移动骰不获得额外残页');

  game.setNextStrategyPlan('guard');
  game.refillStrategy('inner');
  assert.equal(game.strategyLossAmount(-3, 'shi'), -1, '守成策自动减少 2 点败北损失');
  assert.equal(game.s.abilityState.strategy.charges, 3, '守成策首次发动同样免费');
}

console.log('== 笔力：稿页可润色、刊行，并形成跨局末评分资产 ==');
{
  const game = newGame('cizong_bi');
  game.s.abilityState.manuscript.pages = game.manuscriptCap();
  const polish = game.spendManuscript('polish');
  assert.deepEqual(polish, { ok: true, cost: 1 }, '辞宗每阶段首次润色减费');
  assert.equal(game.s.abilityState.manuscript.polish, 1, '润色储备供下一场追加骰减费');
  game.s.abilityState.manuscript.pages = 3;
  const inspiration = game.s.inspiration;
  assert.equal(game.spendManuscript('publish').ok, true);
  assert.equal(game.s.inspiration, inspiration + 4, '刊行把稿页换成灵感');
  game.s.attrs.bi = 32;
  game.s.abilityState.manuscript.pages = 5;
  assert.equal(game.spendManuscript('volume').ok, true);
  assert.equal(game.s.abilityState.manuscript.volumes, 1, '定卷进入终局评分资产');
  assert.equal(game.s.abilityState.manuscript.pages, 1, '32 笔力定卷后返还 1 稿页');

  const scoreState = {
    attrs: { shi: 5, ci: 5, lian: 5, bi: 5, xue: 5, si: 5 },
    battle: {}, events: {}, finish: { manuscriptBonus: 60, manuscriptVolumes: 1 }
  };
  const scored = R.sixDimScore(scoreState, game.cfg.grades);
  const wencai = scored.dims.find(d => d.key === 'wencai');
  assert.ok(wencai.parts.some(p => p.label.includes('定卷') && p.value === 60), '成卷确实进入终局文采分明细');
}

console.log('== 辞宗：首次不追加骰成篇奖励按阶段只触发一次 ==');
{
  const game = newGame('cizong_bi');
  const oneDieWin = { result: 'win', style: 'shi', manner: 'zheli', npcStyle: 'ci', npcDice: 2, dicePips: [4], upset: false };
  await game.settleBattle(game.createSession({ npc: npc('成篇一'), label: '成篇一' }), oneDieWin);
  assert.equal(game.s.abilityState.manuscript.pages, 3, '基础 2 页 + 辞宗阶段奖励 1 页');
  game.s.abilityState.manuscript.pages = 0;
  await game.settleBattle(game.createSession({ npc: npc('成篇二'), label: '成篇二' }), oneDieWin);
  assert.equal(game.s.abilityState.manuscript.pages, 2, '同阶段第二场只有基础 2 页');
}

console.log('== 方案 C 铺垫：技法经验随实战稳定累计并跨阈值 ==');
{
  const game = newGame('bowen');
  assert.deepEqual(game.techniqueConfig().nodes, { shi: [], ci: [], lian: [] }, '当前不偷跑任何技法节点效果');
  game.s.abilityState.technique.xp.shi = 9;
  const session = game.createSession({ npc: npc('技法阈值'), label: '技法阈值' });
  await game.settleBattle(session, {
    result: 'win', style: 'shi', manner: 'zheli', npcStyle: 'ci', npcDice: 2, dicePips: [4], upset: false
  });
  assert.equal(game.s.abilityState.technique.xp.shi, 10);
  assert.equal(game.s.abilityState.technique.level.shi, 1, '10 点经验到达第一技法层');
  assert.deepEqual(game.s.abilityState.technique.unlocked.shi, [], '节点解锁位保留但尚未填充');
  assert.deepEqual(game.s.abilityState.technique.equipped.shi, [], '节点装配位保留但尚未填充');
}

console.log('方案 B/C 能力系统验收：全部通过 ✓');
