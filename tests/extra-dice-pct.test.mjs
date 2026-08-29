#!/usr/bin/env node
// 追加灵感骰收益回归：成本、骰面分与作品百分比乘区。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Game } from '../js/engine/game.js';
import * as R from '../js/engine/rules.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/[A-Za-z]:/, s => s.slice(1))), '..');
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

function newGame() {
  const game = new Game(buildCfg(), makeUI(), () => 0);
  game.push = () => {};
  game.grantTalent = async () => false;
  game.start('bowen', { name: '' });
  return game;
}

function npc() {
  return {
    id: 'test_extra_dice_pct', name: '测试论敌', fullName: '测试论敌',
    attrs: { shi: 5, ci: 5, lian: 5, bi: 5, xue: 5, si: 5 }
  };
}

const inspiration = load('inspiration');
console.log('== 配置：追加骰成本、百分比与上限 ==');
assert.equal(inspiration.extraDiceCost, 5, '追加骰基础成本降为 5 灵感');
assert.equal(inspiration.extraDicePct, 0.06, '每枚追加骰进入 +6% 作品乘区');
assert.equal(inspiration.maxExtraDice, 2, '最多追加 2 枚保持不变');

console.log('== 会话：成本与百分比按追加枚数线性叠加 ==');
{
  const game = newGame();
  const session = game.createSession({ npc: npc(), label: '追加骰收益' });
  assert.equal(session.extraDiceCost('shi', 1), 5, '普通文体首次追加耗 5 灵感');
  assert.equal(session.extraDiceCost('ci', 1), 4, '词首次追加仅少耗 1 灵感，鼓励追逐高光而非低骰保底');
  assert.equal(session.extraDicePct(0), 0, '基础骰不获得追加乘区');
  assert.equal(session.extraDicePct(1), 0.06, '追加 1 枚获得 +6%');
  assert.equal(session.extraDicePct(2), 0.12, '追加 2 枚累计 +12%');
  const before = game.s.inspiration;
  assert.equal(session.spendExtraDice(5), true, '可按新成本支付追加骰');
  assert.equal(game.s.inspiration, before - 5, '支付后灵感减少 5');
}

console.log('== 公式：百分比作用于整件作品，不替代骰面分 ==');
{
  const attrs = { shi: 10, ci: 10, lian: 10, bi: 10, xue: 10, si: 10 };
  const base = R.battleScore({ attrs, style: 'shi', diceFixed: 0 });
  const boosted = R.battleScore({
    attrs, style: 'shi', diceFixed: 0,
    pctMods: [{ source: 'extraDice', label: '追加骰·1枚', value: inspiration.extraDicePct }]
  });
  assert.equal(boosted.breakdown.pctSum, 0.06, '追加骰百分比进入 pctSum');
  assert.equal(boosted.total, base.total + Math.round(base.base * 0.06), '百分比按整件作品基础分计算');
  assert.equal(boosted.items[3].value, base.items[3].value, '追加骰百分比不替换骰面分');
  assert.ok(boosted.items[4].detail.includes('追加骰·1枚 +6%'), '算分明细显示追加骰乘区');
}

console.log('== 引擎：追加骰同时保留骰面收益并接入结算明细 ==');
{
  const game = newGame();
  const session = game.createSession({ npc: npc(), label: '引擎接线' });
  const one = game.resolveBattle(session, 'shi', 'zheli', [3]);
  const two = game.resolveBattle(session, 'shi', 'zheli', [3, 4]);
  assert.equal(two.selfCalc.breakdown.pctSum - one.selfCalc.breakdown.pctSum, 0.06, '追加一枚只新增一档 +6% 乘区');
  assert.ok(two.selfCalc.items[4].detail.includes('追加骰·1枚 +6%'), '引擎明细记录追加骰百分比');
  assert.ok(two.selfCalc.diceScore > one.selfCalc.diceScore, '追加骰仍贡献额外骰面分');

  session.usedActive = [{ id: 'fixed-test', name: '固定骰', effect: { type: 'fixed_dice', value: 15 } }];
  const fixed = game.resolveBattle(session, 'shi', 'zheli', [3, 4]);
  assert.equal(fixed.selfCalc.breakdown.pctSum, one.selfCalc.breakdown.pctSum, '固定骰不叠加追加骰百分比');
}

console.log('== 引擎：NPC 普通灵感骰同样进入作品乘区 ==');
{
  const game = newGame();
  const session = game.createSession({ npc: npc(), label: 'NPC 灵感骰乘区' });
  const out = game.resolveBattle(session, 'shi', 'zheli', [3]);
  assert.ok(out.oppCalc.breakdown.dicePct > 0, 'NPC 普通骰产生有效作品乘区');
  assert.match(out.oppCalc.items[3].detail, /乘区 \+/, 'NPC 算分明细显示灵感骰乘区');
  assert.ok(out.oppCalc.diceScore > 0, 'NPC 灵感骰按其创作底盘折算实际贡献');
}

console.log('== 文心：骰组构型、免费续掷与续章链 ==');
{
  const talents = load('talents');
  const upgrades = load('talent-upgrade');
  const byId = new Map(talents.map(t => [t.id, t]));
  const qishi = byId.get('T005');
  const tianma = byId.get('T010');
  const flow = byId.get('T016');
  const yiqi = byId.get('TA05');

  const qibu = byId.get('TA01');
  const yima = byId.get('TA06');
  assert.equal(qishi.effect.pattern, 'low_then_high', '急智改为低开高走构型');
  assert.equal(tianma.effect.pattern, 'all_distinct', '天马行空改为三骰各异构型');
  assert.equal(flow.effect.pattern, 'ascending', '文思泉涌改为逐骰递升构型');
  assert.equal(yiqi.effect.type, 'extra_dice_chain', '一气呵成改为无弹窗续章链');
  assert.equal(qibu.kind, 'passive', '七步成诗改为被动文心');
  assert.equal(qibu.effect.pattern, 'total_multiple', '七步成诗改为总点倍数构型');
  assert.equal(qibu.effect.multiple, 7, '七步成诗以七为倍数');
  assert.equal(qibu.cost, undefined, '被动七步成诗不再消耗灵感');
  assert.equal(yima.effect.pattern, 'total_tiers', '倚马可待使用总点分档');
  assert.equal(upgrades.T005.levels.at(-1).effect.value, 0.22, '急智满级高走收益提升');
  assert.equal(upgrades.T010.levels.at(-1).effect.firstCostDiscount, 3, '天马行空满级首枚减费 3');
  assert.equal(upgrades.T016.levels.at(-1).effect.fullValue, 0.14, '文思泉涌满级保留三骰连升高潮');
  assert.equal(upgrades.TA05.levels.at(-1).effect.value, 0.1, '一气呵成满级续章命中 +10%');

  const game = newGame();
  game.s.passive = [qishi, flow, tianma];
  const session = game.createSession({ npc: npc(), label: '文心迁移' });
  assert.equal(session.extraDiceCost('shi', 1, [1]), 1, '低开急智与两枚构型文心合计压低首枚续掷成本');
  assert.equal(session.extraDiceCost('shi', 1, [4]), 2, '急智不在非低开时无条件减费');
  const passiveOut = game.resolveBattle(session, 'shi', 'zheli', [1, 5, 6]);
  assert.ok(passiveOut.selfCalc.items[4].detail.includes('文心·急智 +10%'), '明细显示急智低开高走');
  assert.ok(passiveOut.selfCalc.items[4].detail.includes('文心·文思泉涌 +20%'), '明细显示文思泉涌两段递升与连升奖励');
  assert.ok(passiveOut.selfCalc.items[4].detail.includes('文心·天马行空 +15%'), '明细显示三骰各异奖励');

  session.usedActive = [yiqi];
  session._extraDiceChainUsed = true;
  const activeOut = game.resolveBattle(session, 'shi', 'zheli', [3, 4, 5]);
  assert.ok(activeOut.selfCalc.items[4].detail.includes('文心·一气呵成·续章 +4%'), '明细显示一气呵成续章命中');

  const qibuGame = newGame();
  qibuGame.s.passive = [qibu];
  const qibuSession = qibuGame.createSession({ npc: npc(), label: '七步成诗被动' });
  assert.equal(qibuSession.activeTalents.some(t => t.id === 'TA01'), false, '七步成诗不会进入主动文心栏');
  const qibuOut = qibuGame.resolveBattle(qibuSession, 'shi', 'zheli', [1, 3, 3]);
  assert.ok(qibuOut.selfCalc.items[4].detail.includes('文心·七步成诗 +18%'), '三骰总点七也能触发七步成诗');
  const qibuTrigger = qibuOut.talentTriggers.find(x => x.id === 'TA01');
  assert.equal(qibuTrigger.occurrence, 1, '七步成诗每场按总点倍数命中一次');
  assert.equal(qibuTrigger.reward.perMatch, false, '七步成诗心得奖励每场一次');
  const qibuFourDice = qibuGame.resolveBattle(qibuSession, 'shi', 'zheli', [1, 1, 1, 4]);
  assert.ok(qibuFourDice.selfCalc.items[4].detail.includes('文心·七步成诗 +18%'), '四骰总点七也能触发且不限制骰子枚数');
  const qibuMultiple = qibuGame.resolveBattle(qibuSession, 'shi', 'zheli', [6, 5, 3]);
  assert.ok(qibuMultiple.selfCalc.items[4].detail.includes('文心·七步成诗 +18%'), '总点十四同样触发七步成诗');
  const qibuMiss = qibuGame.resolveBattle(qibuSession, 'shi', 'zheli', [1, 1, 1, 3]);
  assert.equal(qibuMiss.talentTriggers.some(x => x.id === 'TA01'), false, '非七的倍数不触发七步成诗');

  session.usedActive = [yima];
  const yimaOut = game.resolveBattle(session, 'shi', 'zheli', [6, 5, 5]);
  assert.ok(yimaOut.selfCalc.items[4].detail.includes('文心·倚马可待 +30%'), '高档总点只取最高分档');
  assert.equal(yimaOut.talentTriggers.find(x => x.id === 'TA06').reward.value, 3, '倚马可待高档返还灵感');
}

console.log('追加灵感骰百分比收益测试：全部通过 ✓');
