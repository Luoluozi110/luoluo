import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game } from '../js/engine/game.js';

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

// 严格超过 35，且联力为诗/词/联三力唯一最高时，单场殿试必遇康尔玉。
let picked = makeGame({ shi: 35, ci: 34, lian: 36 }).selectPalaceFoes(palace, 1);
assert.equal(picked.forcedEntry.id, 'kang_er_yu');
assert.equal(picked.foes[0].id, 'kang_er_yu');

// 门槛、平局与非联力最高均不触发，仍由原权重池选择。
assert.equal(makeGame({ shi: 34, ci: 33, lian: 35 }).selectPalaceFoes(palace, 1).forcedEntry, null);
assert.equal(makeGame({ shi: 36, ci: 31, lian: 36 }).selectPalaceFoes(palace, 1).forcedEntry, null);
assert.equal(makeGame({ shi: 38, ci: 30, lian: 37 }).selectPalaceFoes(palace, 1).forcedEntry, null);

// 兼容多场殿试：康尔玉只占一个强制席位，其余席位仍从剩余主考官中抽取。
picked = makeGame({ shi: 20, ci: 22, lian: 40 }).selectPalaceFoes(palace, 3);
assert.equal(picked.foes.filter(npc => npc.id === 'kang_er_yu').length, 1);
assert.equal(picked.foes.length, 3);

console.log('palace-kang-selection.test.mjs: 联力冠绝 → 康尔玉殿试必遇 ✓');
