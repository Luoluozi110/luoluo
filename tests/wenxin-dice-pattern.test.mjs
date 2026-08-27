#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Game } from '../js/engine/game.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/[A-Za-z]:/, s => s.slice(1))), '..');
const load = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'config', `${name}.json`), 'utf8'));

function config() {
  const cfg = {};
  for (const name of ['attrs', 'inspiration', 'board', 'questions', 'events', 'talents', 'schools', 'affinity', 'npcs', 'sky', 'grades', 'album', 'synergies', 'npc-mechanics', 'talent-upgrade']) cfg[name] = load(name);
  cfg.board.cellById = new Map((cfg.board.mainRing || []).map(c => [c.id, c]));
  cfg.board.laps = Number(cfg.board.laps) || 2;
  cfg.board.ringSize = cfg.board.mainRing.length;
  cfg.talentById = new Map(cfg.talents.map(t => [t.id, t]));
  cfg.talentUpgradeById = new Map(Object.entries(cfg['talent-upgrade']));
  return cfg;
}

function ui() {
  return {
    floatAttrs() {}, floatInspiration() {}, onState() {}, showDice() {}, movePiece() {}, highlightCell() {},
    showQuizResult() {}, showSky() {}, skyExpired() {}, showTalentGain() {}, showPalaceIntro() {}, toast() {},
    async showResult() {}, async askReplaceTalent() { return 0; }, async askScenic() { return false; },
    async showQuiz() { return { index: 0, timedOut: false }; }, async showEvent() { return 0; },
    async runBattle() { throw new Error('not used'); }
  };
}

const foe = { id: 'pattern-foe', name: '试墨者', fullName: '试墨者', attrs: { shi: 8, ci: 8, lian: 8, bi: 8, xue: 8, si: 8 } };
const cfg = config();
const get = id => structuredClone(cfg.talentById.get(id));
function game() { const g = new Game(cfg, ui(), () => 0); g.push = () => {}; g.start('bowen', { name: '' }); return g; }

console.log('== 急智低开高走与保留的点铁成金、梦笔生花联动 ==');
{
  const g = game();
  g.s.passive = [get('T005'), get('T007'), get('T040')];
  const session = g.createSession({ npc: foe, label: '低开高走' });
  session.usedActive = [get('TA07')];
  const out = g.resolveBattle(session, 'ci', 'zheli', [1, 5]);
  assert.deepEqual(out.rawDicePips, [1, 5], '保留原始骰组供展示和诊断');
  assert.deepEqual(out.dicePips, [6, 5], '点铁成金仍独立把最低低点化六');
  assert.match(out.selfCalc.items[3].detail, /点铁成金 1→6/, '灵感骰明细说明保留的变形效果');
  assert.ok(out.selfCalc.items[4].detail.includes('文心·急智 +10%'), '急智在低开高走时给出翻盘收益');
  const bloom = out.talentTriggers.find(t => t.id === 'T007');
  assert.equal(bloom.occurrence, 1, '梦笔生花仍按最终六点计数，未修改其效果');
  assert.ok(out.selfCalc.items[4].detail.includes('文心·梦笔生花 +5%'), '保留的梦笔生花仍给出原有收益');
}

console.log('== 多骰分出异点与同点两套构筑 ==');
{
  const g = game();
  g.s.passive = [get('T010'), get('T039')];
  const session = g.createSession({ npc: foe, label: '骰组分流' });
  const varied = g.resolveBattle(session, 'ci', 'zheli', [1, 3, 6]);
  assert.ok(varied.selfCalc.items[4].detail.includes('文心·天马行空 +15%'), '三种点数令天马行空触发完整构型');
  assert.ok(!varied.talentTriggers.some(t => t.id === 'T039'), '全异点不触发同声相应');
  const paired = g.resolveBattle(session, 'ci', 'zheli', [3, 3]);
  assert.ok(paired.selfCalc.items[4].detail.includes('文心·同声相应 +8%'), '同点骰触发另一条路线');
  assert.ok(!paired.talentTriggers.some(t => t.id === 'T010'), '只有一种点数不触发天马行空');
}

console.log('== 稳健、换体、稿本与高点章法均有独立反馈 ==');
{
  const g = game();
  g.s.attrs.bi = 24;
  g.ensureAbilityState().manuscript.pages = 6;
  g.ensureAbilityState().lastStyle = 'shi';
  g.s.passive = [get('T035'), get('T036'), get('T037'), get('T038')];
  const session = g.createSession({ npc: foe, label: '多路反馈' });
  const out = g.resolveBattle(session, 'ci', 'zheli', [4]);
  const detail = out.selfCalc.items[4].detail;
  assert.ok(detail.includes('文心·删繁就简 +8%'), '单骰路线获得得分反馈');
  assert.ok(detail.includes('文心·字字珠玑 +10%'), '全高路线获得得分反馈');
  assert.ok(detail.includes('文心·触类旁通·换体 +8%'), '换文体路线获得得分反馈');
  assert.ok(detail.includes('文心·落笔成章·稿本6页 +6%'), '稿本资源转为战斗收益');
  assert.equal(out.talentTriggers.find(t => t.id === 'T035').reward.type, 'insight', '删繁就简回流心得');
  assert.equal(out.talentTriggers.find(t => t.id === 'T036').reward.type, 'fragment', '字字珠玑回流残页');
}

console.log('== 高风险主动按每枚极端骰结算正负收益 ==');
{
  const g = game();
  const session = g.createSession({ npc: foe, label: '惊句豪赌' });
  session.usedActive = [get('TA03')];
  const out = g.resolveBattle(session, 'ci', 'zheli', [1, 6]);
  assert.ok(out.selfCalc.items[4].detail.includes('文心·语不惊人 +7%'), '六点 +14% 与一点 −7% 合并为净 +7%');
}

console.log('== 骰组后续收益在战后实际兑现 ==');
{
  const g = game();
  g.s.passive = [get('T039')];
  const session = g.createSession({ npc: foe, label: '同声回响' });
  const out = g.resolveBattle(session, 'ci', 'zheli', [3, 3]);
  const before = g.s.inspiration;
  g.applyAbilityBattleGrowth(session, { ...out, result: 'win', upset: false });
  assert.equal(g.s.inspiration, before + 1, '同声相应在战后返还 1 点灵感');
}

console.log('新版文心骰组联动测试：全部通过 ✓');
