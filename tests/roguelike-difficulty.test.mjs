#!/usr/bin/env node
// Roguelike 难度 v2：灵感经济收紧，NPC 六维按阶段递增增强。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R from '../js/engine/rules.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'config', `${name}.json`), 'utf8'));
const inspiration = load('inspiration');
const attrsCfg = load('attrs');
const tiers = load('npcs');

// 与 dcfcfde（rebalance-inspiration-regen）后的 config/inspiration.json 对齐
assert.equal(inspiration.initial, 36, '初始灵感由 48 进一步收紧到 36');
assert.equal(inspiration.max, 54, '基础灵感上限由 68 收紧到 54');
assert.ok(inspiration.initial < inspiration.max && inspiration.initial >= 30, '首局仍保留可学习的资源空间');

const expected = {
  '童生级': { allAttrs: 1, wisdomExtra: 1, scoreDelta: 26 },
  '秀才级': { allAttrs: 2, wisdomExtra: 1, scoreDelta: 48 },
  '举人级': { allAttrs: 3, wisdomExtra: 2, scoreDelta: 74 },
  '进士级': { allAttrs: 4, wisdomExtra: 2, scoreDelta: 96 },
  '主考官': { allAttrs: 5, wisdomExtra: 3, scoreDelta: 122 }
};

for (const tier of tiers.filter(t => !t.isHiddenFinal)) {
  const boost = expected[tier.tier];
  assert.ok(boost, `存在 ${tier.tier} 难度档`);
  assert.equal(tier.balanceVersion, 2, `${tier.tier} 已标记难度 v2`);
  assert.deepEqual(tier.difficultyBoost, { allAttrs: boost.allAttrs, wisdomExtra: boost.wisdomExtra });
  for (const npc of tier.npcs) {
    const before = {};
    for (const key of R.ATTR_KEYS) {
      assert.ok(Number.isFinite(Number(npc.attrs[key])), `${npc.id}.${key} 为有效数值`);
      before[key] = Number(npc.attrs[key]) - boost.allAttrs - (key === 'si' ? boost.wisdomExtra : 0);
    }
    const style = R.CREATIVE_KEYS.slice().sort((a, b) => before[b] - before[a])[0];
    const oldScore = R.expectedScore(before, style, attrsCfg.battleFormula);
    const newScore = R.expectedScore(npc.attrs, style, attrsCfg.battleFormula);
    assert.equal(newScore - oldScore, boost.scoreDelta, `${npc.id} 的基础期望分按档位提高 ${boost.scoreDelta}`);
  }
}

const hidden = tiers.find(t => t.isHiddenFinal);
assert.ok(hidden && hidden.npcs.length === 1, '隐藏终圈对手独立于常规难度档');
assert.equal(Object.values(hidden.npcs[0].attrs).reduce((sum, n) => sum + Number(n || 0), 0), 300, '桃花仙人六维总和为 300');

const npcCount = tiers.filter(t => !t.isHiddenFinal).reduce((sum, tier) => sum + (tier.npcs || []).length, 0);
console.log(`Roguelike 难度 v2：灵感 36/54，${npcCount} 名 NPC 全六维与思力分档增强 ✓`);
