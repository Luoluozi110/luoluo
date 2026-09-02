import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/[A-Za-z]:/, s => s.slice(1))), '..');
const load = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'config', `${name}.json`), 'utf8'));
const talents = load('talents');
const upgrades = load('talent-upgrade');
const synergies = load('synergies');
const attrs = load('attrs');
const costs = { common:[4,7], rare:[5,8,12], epic:[6,9,13,18], legend:[7,10,14,19,25] };

assert.equal(attrs.talentDropRate, .22, '文心掉落率提升至 22%');
assert.equal(Object.keys(upgrades).length, talents.length, '升级表覆盖全部文心');
for (const talent of talents) {
  const up = upgrades[talent.id];
  assert.ok(up, `${talent.id} 有升级配置`);
  assert.deepEqual(talent.effect, up.levels[0].effect, `${talent.id} 基础效果与 Lv1 一致`);
  assert.deepEqual(up.upCost, costs[up.quality].slice(0, up.maxLevel - 1), `${talent.id} 使用新成本曲线`);
  for (let i = 1; i < up.levels.length; i++) assert.notDeepEqual(up.levels[i].effect, up.levels[i - 1].effect, `${talent.id} Lv${i + 1} 不是空升级`);
}

assert.equal(synergies.length, 48, '羁绊扩充后共 48 组');
for (const sy of synergies) {
  assert.ok(sy.members.length >= 2, `${sy.id} 至少两名成员`);
  const ids = sy.effects.map(e => e.effectId);
  assert.ok(ids.every(Boolean), `${sy.id} 每条效果有 effectId`);
  assert.equal(new Set(ids).size, ids.length, `${sy.id} effectId 唯一`);
  assert.ok(sy.effects.every(e => ['add','max','replace'].includes(e.stackMode)), `${sy.id} 叠加模式合法`);
}

const editor = fs.readFileSync(path.resolve(ROOT, '..', 'feihua-editors', 'assets', 'js', 'synergy.js'), 'utf8');
for (const token of ['dice_pattern','style_pct','theme_pct','palace_pct','battle_history_pct','armory_pct','study_bonus','insp_on_win','insp_turn_regen','restraint_pct','syn-effect-id','syn-when-json','syn-reward-json']) {
  assert.ok(editor.includes(token), `羁绊编辑器支持 ${token}`);
}
console.log('wenxin-strong-feedback.test.mjs: 阶段 A/B/C 配置与编辑器契约 ✓');
