import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game } from '../js/engine/game.js';

const attrs = JSON.parse(fs.readFileSync(new URL('../config/attrs.json', import.meta.url), 'utf8'));
const schools = JSON.parse(fs.readFileSync(new URL('../config/schools.json', import.meta.url), 'utf8'));
const talents = [
  { id: 'P1', name: '甲', kind: 'passive', effect: {} },
  { id: 'P2', name: '乙', kind: 'passive', effect: {} },
  { id: 'P3', name: '丙', kind: 'passive', effect: {} },
  { id: 'P4', name: '丁', kind: 'passive', effect: {} }
];

function makeGame(schoolId, rand = () => 0) {
  let offered = null;
  const ui = {
    onState() {}, toast() {}, showTalentGain: async () => {}, askReplaceTalent: async () => -1,
    chooseScenicTalent: async candidates => { offered = candidates; return 1; }
  };
  const game = new Game({ attrs, schools, talents, talentById: new Map(talents.map(t => [t.id, t])) }, ui, rand);
  game.s = {
    school: schools.find(s => s.id === schoolId), attrs: { shi: 8, ci: 8, lian: 8, bi: 12, xue: 12, si: 18 },
    phase: 'child', passive: [], active: [], synergies: [], talentLevels: {}, talentState: { triggers: {}, flags: {}, activeUses: {} },
    events: { talents: 0 }, tutorialState: {}, schoolState: {}, log: [], over: false
  };
  game.ensureAbilityState();
  return { game, offered: () => offered };
}

for (const [schoolId, resource, amount] of [['bowen', 'insight', 8], ['qishi', 'strategy', 2], ['cizong_bi', 'manuscript', 3]]) {
  const { game, offered } = makeGame(schoolId);
  const a = game.ensureAbilityState();
  if (resource === 'insight') a.insight = amount;
  else if (resource === 'strategy') a.strategy.charges = amount;
  else a.manuscript.pages = amount;
  const out = await game.attemptSchoolTalentConversion();
  assert.equal(out.ok, true, `${schoolId} 可以发起转化`);
  assert.equal(out.success, true, `${schoolId} 命中概率后给出机会`);
  assert.equal(offered().length, 3, `${schoolId} 提供三张不重复候选`);
  assert.equal(game.s.passive.length, 1, `${schoolId} 可以择一收入文心`);
  assert.equal(game.talentConversionStatus().available, false, `${schoolId} 同阶段不能重复转化`);
}

const fail = makeGame('bowen', () => 0.99).game;
fail.ensureAbilityState().insight = 8;
const failed = await fail.attemptSchoolTalentConversion();
assert.equal(failed.success, false, '概率未命中时不会给出候选');
assert.equal(fail.ensureAbilityState().insight, 0, '未命中仍结算投入成本');

console.log('school-talent-conversion.test.mjs: 三流派问心转化与三选一 ✓');
