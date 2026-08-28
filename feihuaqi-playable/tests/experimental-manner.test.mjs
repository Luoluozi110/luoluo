import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../js/engine/game.js';
import { normalizeConfig } from '../js/engine/config.js';
import * as R from '../js/engine/rules.js';

const names = ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies','npc-mechanics','talent-upgrade','narrative','sidequests','sidequest-talents'];
function config() {
  const cfg = {};
  for (const name of names) {
    try { cfg[name] = JSON.parse(readFileSync(new URL(`../config/${name}.json`, import.meta.url), 'utf8')); }
    catch (_) { /* optional content is allowed to be absent in older branches */ }
  }
  return normalizeConfig(cfg);
}
const ui = { toast() {}, onState() {}, floatAttrs() {}, floatInspiration() {}, async askReplaceTalent() { return 0; }, async showResult() {} };
const firstNpc = cfg => cfg.npcs.flatMap(tier => tier.npcs || []).find(npc => npc && npc.attrs);

console.log('== 实验文风配置与边界 ==');
const cfg = config();
assert.ok(cfg.affinity.manners.includes('experimental'), '实验是玩家可选文风');
assert.equal(cfg.affinity.mannerNames.experimental, '实验');
assert.equal(R.rollExperimentalMannerPct(cfg.affinity, () => 0), -0.12, '随机下界为 -12%');
assert.equal(R.rollExperimentalMannerPct(cfg.affinity, () => 0.999999), 0.20, '随机上界为 +20%');
console.log('  ✓ 配置提供 -12% 到 +20% 的整数百分比波动');

console.log('== 会话锁定、展示与结算 ==');
const low = new Game(config(), ui, () => 0);
low.start('bowen', { name: '' });
low.s.zeitgeist = null;
low.s.school.homeManner = null;
const lowSession = low.createSession({ npc: firstNpc(low.cfg), theme: 'yongwu', label: '实验下界' });
assert.equal(lowSession.experimentalMannerPct, -0.12, '开战即锁定实验下界');
assert.equal(lowSession.affinityOf('experimental'), -0.12, '选项预览与锁定值一致');
const lowOut = low.resolveBattle(lowSession, 'shi', 'experimental', [3]);
assert.match(lowOut.selfCalc.items.find(item => item.key === 'mods').detail, /实验·本场波动 -12%/, '结算明确列出实验负修正');
assert.notEqual(lowOut.npcManner, 'experimental', 'NPC 不会自动选择玩家专属实验文风');

const high = new Game(config(), ui, () => 0.999999);
high.start('bowen', { name: '' });
high.s.zeitgeist = null;
high.s.school.homeManner = null;
const highSession = high.createSession({ npc: firstNpc(high.cfg), theme: 'yongwu', label: '实验上界' });
assert.equal(highSession.experimentalMannerPct, 0.20, '开战即锁定实验上界');
assert.equal(highSession.affinityOf('experimental'), 0.20, '正向实验值可被 UI 和超时自动选择读取');
console.log('  ✓ 同一会话的预览与结算一致，NPC 不会误选实验');

console.log('experimental-manner.test.mjs: 实验文风随机范围、锁定与结算全部通过');
