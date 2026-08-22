import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../js/engine/game.js';
import { normalizeConfig } from '../js/engine/config.js';
import { deserializeRun, serializeRun } from '../js/engine/save.js';
import * as Album from '../js/engine/album.js';

const names = ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies','npc-mechanics','talent-upgrade','narrative'];
const cfg = {};
for (const name of names) cfg[name] = JSON.parse(readFileSync(new URL(`../config/${name}.json`, import.meta.url), 'utf8'));
normalizeConfig(cfg);

const ring = cfg.board.hiddenFinalRing;
assert.equal(ring.cells.length, 8, '隐藏终圈应为 8 格短路径');
assert.equal(ring.cells.filter(c => c.type === 'battle').length, 1, '隐藏终圈只有终点是论战格');
assert.equal(ring.cells.find(c => c.id === ring.battleCellId).type, 'battle');

const hiddenTier = cfg.npcs.find(t => t.isHiddenFinal);
assert.ok(hiddenTier, '存在隐藏终圈 NPC 档');
assert.equal(hiddenTier.npcs.length, 1);
const chen = hiddenTier.npcs[0];
assert.equal(chen.name, '陈之微');
assert.equal(chen.title, '桃花仙人');
assert.equal(Object.values(chen.attrs).reduce((sum, n) => sum + Number(n || 0), 0), 300);

const ui = {
  toast() {}, onState() {}, floatAttrs() {}, floatInspiration() {}, showTalentGain() {},
  async askReplaceTalent() { return 0; }, async showResult() {}
};
Album.resetStore();
const complete = Album.loadStore();
complete.unlocked = cfg.album.map(c => c.id);
complete.mastery[cfg.schools[0].id] = { xp: Album.MASTERY_THRESHOLDS[4], level: 5 };
Album.saveStore(complete);

const game = new Game(cfg, ui, () => 0.5);
game.start(cfg.schools[0].id, { name: '试卷人' });
const exactDouble = { result: 'win', selfCalc: { total: 200 }, oppCalc: { total: 100 } };
let eligible = game.hiddenFinalEligibility(exactDouble);
assert.equal(eligible.eligible, true, '全名篇 + Lv5 + 恰好 2 倍殿试胜分应获邀请');
assert.equal(eligible.albumCount, cfg.album.length);

game.s.masteryLevel = 4;
assert.equal(game.hiddenFinalEligibility(exactDouble).eligible, false, '本局流派未满级不可进入');
game.s.masteryLevel = 5;
assert.equal(game.hiddenFinalEligibility({ ...exactDouble, selfCalc: { total: 199 } }).eligible, false, '低于 2 倍分数不可进入');
assert.equal(game.hiddenFinalEligibility({ ...exactDouble, result: 'lose' }).eligible, false, '未战胜主考官不可进入');

const incomplete = Album.loadStore();
incomplete.unlocked.pop();
Album.saveStore(incomplete);
assert.equal(game.hiddenFinalEligibility(exactDouble).eligible, false, '未集齐传世名篇不可进入');
Album.saveStore(complete);

const events = [];
game.ui.showHiddenFinalRing = async () => events.push('ring');
game.ui.showHiddenFinalVictory = async (out, npc) => events.push(`victory:${npc.name}:${out.result}`);
game.doBattle = async opts => {
  events.push(`battle:${opts.npc.name}:${opts.isHiddenFinal}`);
  return { result: 'win', selfCalc: { total: 301 }, oppCalc: { total: 300 } };
};
game.endGame = async reason => { game.s.over = true; game.s.endReason = reason; events.push(`end:${reason}`); };
await game.runHiddenFinal(eligible);
assert.equal(game.s.ringId, 'secret');
assert.equal(game.s.secretFinal.entered, true);
assert.equal(game.s.secretFinal.completed, true);
assert.equal(game.s.secretFinal.cellId, ring.battleCellId);
assert.deepEqual(events, ['ring', 'battle:陈之微:true', 'victory:陈之微:win', 'end:taoyuan']);

const restored = deserializeRun(serializeRun(game), cfg);
assert.equal(restored.ok, true, '隐藏终圈状态可正常读档');
assert.equal(restored.state.ringId, 'secret', '读档不会被常规 routeIndex 改回内圈');
assert.equal(restored.state.secretFinal.completed, true);
assert.equal(restored.state.secretFinal.result, 'win');

Album.resetStore();
console.log('hidden-final.test.mjs: 资格门槛、短终圈、陈之微 300 点、胜利结算与存档往返全部通过');
