import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game } from '../js/engine/game.js';
import { pickNpcFromTier } from '../js/engine/npc-selection.js';

const tiers = JSON.parse(fs.readFileSync(new URL('../config/npcs.json', import.meta.url), 'utf8'));
const palace = tiers.find(tier => tier.id === 'zhukaoguan');
const makeGame = attrs => {
  const game = new Game({ board: { layout: 'concentric_spiral' }, npcs: [] }, {}, () => 0.72);
  game.s = { attrs };
  return game;
};

assert.ok(palace, '主考官档存在');
const kang = palace.npcs.find(npc => npc.id === 'kang_er_yu');
assert.ok(kang, '康尔玉具有稳定 ID');

// 联力严格超过 35 时，单场殿试必遇康尔玉；诗力、词力较高不再阻断这条门槛。
let picked = makeGame({ shi: 35, ci: 34, lian: 36 }).selectPalaceFoes(palace, 1);
assert.equal(picked.forcedEntry.id, 'kang_er_yu');
assert.equal(picked.foes[0].id, 'kang_er_yu');
picked = makeGame({ shi: 52, ci: 49, lian: 36 }).selectPalaceFoes(palace, 1);
assert.equal(picked.forcedEntry.id, 'kang_er_yu', '诗、词力较高时仍应命中康尔玉');

// 门槛不达时不触发，仍由原权重池选择。
assert.equal(makeGame({ shi: 34, ci: 33, lian: 35 }).selectPalaceFoes(palace, 1).forcedEntry, null);

// 旧编辑器工程可能没有导出康尔玉的条件字段；殿试规则仍须以稳定 ID 兜底。
const palaceWithoutKangRule = {
  ...palace,
  npcs: palace.npcs.map(npc => npc.id === 'kang_er_yu'
    ? Object.fromEntries(Object.entries(npc).filter(([key]) => key !== 'palaceForcedWhen' && key !== 'stageForcedWhen'))
    : npc)
};
picked = makeGame({ shi: 60, ci: 58, lian: 36 }).selectPalaceFoes(palaceWithoutKangRule, 1);
assert.equal(picked.forcedEntry.id, 'kang_er_yu', '旧工程缺少条件字段时仍强制遇到康尔玉');
assert.equal(picked.foes[0].id, 'kang_er_yu');

// 历史云端工程曾把康尔玉条目的 id 序列化成空串：按显示名兜底识别，玩法承诺不因内容缺陷失效。
const palaceWithBrokenKang = {
  ...palace,
  npcs: palace.npcs.map(npc => npc.id === 'kang_er_yu'
    ? { ...npc, id: '', palaceForcedWhen: undefined, stageForcedWhen: undefined }
    : npc)
};
picked = makeGame({ shi: 60, ci: 58, lian: 36 }).selectPalaceFoes(palaceWithBrokenKang, 1);
assert.equal(picked.forcedEntry && picked.forcedEntry.name, '康尔玉', 'id 为空时按名字兜底命中康尔玉');
assert.equal(picked.foes[0] && picked.foes[0].name, '康尔玉');

// 兼容多场殿试：康尔玉只占一个强制席位，其余席位仍从剩余主考官中抽取。
picked = makeGame({ shi: 20, ci: 22, lian: 40 }).selectPalaceFoes(palace, 3);
assert.equal(picked.foes.filter(npc => npc.id === 'kang_er_yu').length, 1);
assert.equal(picked.foes.length, 3);

// 每个档位都可声明同一套本阶段必遇规则；首次命中后记录，后续战斗恢复权重抽取。
const stageCases = [
  ['tongsheng', 'li_mo_tong', { shi: 4, ci: 5, lian: 5, bi: 5, xue: 4, si: 11 }],
  ['xiucai', 'wang_han_sheng', { shi: 8, ci: 11, lian: 8, bi: 8, xue: 8, si: 19 }],
  ['juren', 'tang_ji_qing', { shi: 17, ci: 16, lian: 16, bi: 15, xue: 29, si: 16 }],
  ['jinshi', 'yuwen_yuan', { shi: 21, ci: 22, lian: 21, bi: 19, xue: 21, si: 39 }],
  ['zhukaoguan', 'kang_er_yu', { shi: 20, ci: 22, lian: 40, bi: 18, xue: 21, si: 19 }],
  ['taohuaxian', 'chen_zhiwei', { shi: 50, ci: 50, lian: 50, bi: 59, xue: 50, si: 50 }]
];
for (const [tierId, npcId, attrs] of stageCases) {
  const tier = tiers.find(entry => entry.id === tierId);
  assert.ok(tier, `${tierId} 档存在`);
  const game = makeGame(attrs);
  const first = pickNpcFromTier(game, tier);
  assert.equal(first.id, npcId, `${tierId} 条件命中时必遇 ${npcId}`);
  assert.equal(first.stageForced, true, `${tierId} 首次标记为阶段必遇`);
  const second = pickNpcFromTier(game, tier);
  assert.equal(second.stageForced, undefined, `${tierId} 后续战斗恢复权重抽取`);
}

console.log('palace-kang-selection.test.mjs: 殿试与六档阶段必遇 ✓');
