import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game } from '../js/engine/game.js';

const tiers = JSON.parse(fs.readFileSync(new URL('../config/npcs.json', import.meta.url), 'utf8'));

function makeGame(phase, routeIndex) {
  const game = new Game({ board: { layout: 'concentric_spiral', routeSize: 192 }, npcs: tiers }, {}, () => 0.72);
  game.s = {
    phase,
    routeIndex,
    attrs: { shi: 10, ci: 10, lian: 10, bi: 10, xue: 10, si: 10 },
    stageForcedSeen: {}
  };
  return game;
}

// 举人圈入口的路线百分比仍处于旧版秀才范围；抽取必须以阶段为准。
const jurenEntry = makeGame('juren', 72);
assert.ok(jurenEntry.progress() < 0.5, '测试位置仍在旧秀才进度区间');
assert.equal(jurenEntry.pickNpc(false).tierId, 'juren', '举人阶段不再抽到秀才级对手');

// 同一规则也保护各正式阶段，避免阶段切换时退回到较低档位。
assert.equal(makeGame('child', 20).pickNpc(false).tierId, 'tongsheng');
assert.equal(makeGame('xiucai', 52).pickNpc(false).tierId, 'xiucai');
assert.equal(makeGame('jinshi', 124).pickNpc(false).tierId, 'jinshi');

console.log('npc-stage-selection.test.mjs: 常规遭遇遵循当前阶段档位 ✓');
