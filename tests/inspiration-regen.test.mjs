// 持有型回灵：配置、引擎结算与上限保护
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Game } from '../js/engine/game.js';

const root = process.cwd();
const readJson = name => JSON.parse(fs.readFileSync(path.join(root, 'config', name), 'utf8'));
const inspiration = readJson('inspiration.json');
const talents = readJson('talents.json');
const upgrades = readJson('talent-upgrade.json');

assert.equal(inspiration.initial, 36, '初始灵感应下调至 36');
assert.equal(inspiration.max, 54, '初始灵感上限应下调至 54');
for (const id of ['T019', 'T029']) {
  const talent = talents.find(t => t.id === id);
  assert.equal(talent.effect.type, 'insp_turn_regen', `${id} 应改为持有回灵`);
  assert.equal(talent.effect.value, 1, `${id} 基础回灵应为 1`);
}
assert.deepEqual(upgrades.T029.levels.map(x => x.effect.value), [1, 1, 2, 2], '胸有成竹升级曲线应为 1/1/2/2');
assert.ok(upgrades.T029.levels.every(x => x.effect.type === 'insp_turn_regen'), '胸有成竹升级后仍应为持有回灵');

const ui = { floatInspiration() {} };
const game = new Game({ inspiration }, ui, () => 0.5);
game.s = {
  inspiration: 36,
  inspirationMax: 54,
  passive: [
    { id: 'T019', name: '洛阳纸贵', effect: { type: 'insp_turn_regen', value: 1 } },
    { id: 'T029', name: '胸有成竹', effect: { type: 'insp_turn_regen', value: 2 } }
  ],
  active: [],
  school: { id: 'bowen' },
  schoolState: {}
};

assert.equal(game.applyTurnInspirationRegen(), 3, '两个持有回灵效果应叠加');
assert.equal(game.s.inspiration, 39, '回合开始应恢复合计灵感');
game.s.inspiration = 53;
assert.equal(game.applyTurnInspirationRegen(), 1, '回灵应受灵感上限约束');
assert.equal(game.s.inspiration, 54, '灵感不得超过上限');
game.s.passive = [];
game.s.inspiration = 20;
assert.equal(game.applyTurnInspirationRegen(), 0, '未持有回灵文心时不应恢复');

console.log('持有型回灵测试：全部通过');
