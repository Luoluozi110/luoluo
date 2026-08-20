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

console.log('追加灵感骰百分比收益测试：全部通过 ✓');
