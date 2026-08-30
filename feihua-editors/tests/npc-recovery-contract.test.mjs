import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const findNpc = (data, id) => {
  const tiers = Array.isArray(data) ? data : Object.values(data.npcs || {});
  return tiers.flatMap(tier => tier.npcs || []).find(npc => npc.id === id);
};

const root = readJson('feihua-content.json');
const playable = readJson('feihuaqi-playable/config/npcs.json');
const seedContext = { window: {} };
vm.runInNewContext(readFileSync('feihua-editors/assets/js/seed-npcs.js', 'utf8'), seedContext);
const seedNpcs = JSON.parse(JSON.stringify(seedContext.window.GAME_NPCS));

const recovered = {
  npc_tongsheng_1: {
    id: 'npc_tongsheng_1',
    name: '胡丹阳',
    title: '枕月观云',
    style: 'si',
    attrs: { shi: 5, ci: 5, lian: 5, bi: 5, xue: 5, si: 15 },
    mech: {
      signature: { template: 'sig_steady_pressure', name: '识破重复', pct: 0.06, bias: 1.3, floor: 5, ceiling: 5 },
      weakness: { template: 'wea_go_against_zeitgeist', name: '逆潮立骨', minAffinity: 0, retention: 0.003, playerBonus: 0 },
      intent: { template: 'int_declared_stance', name: '定策意图' }
    },
    stageForcedWhen: {
      primary: 'si', minExclusive: 10,
      strictlyHigherThan: ['shi', 'ci', 'lian', 'bi', 'xue']
    }
  },
  npc_juren_1: {
    id: 'npc_juren_1',
    name: '江嫄',
    title: '一叶舟主',
    style: 'lian',
    focusAttr: 'lian',
    attrs: { shi: 21, ci: 21, lian: 33, bi: 20, xue: 21, si: 24 },
    mech: {
      signature: { name: '偏联力专精', template: 'sig_dice_response', style: 'lian', pct: 0.06, bias: 1.3, steps: [14, 9, 4], cap: 22 },
      weakness: { template: 'wea_limited_extra_dice', name: '跨场换策', layerReduce: 1, maxExtraDice: 1, retention: 0.003, playerBonus: 0 },
      intent: { template: 'int_pattern_hunt', name: '审律意图' }
    },
    stageForcedWhen: {
      primary: 'lian', minExclusive: 28,
      strictlyHigherThan: ['shi', 'ci']
    }
  }
};

assert.equal(root._version, 14, '恢复数据必须挂在当前工程版本 14');
assert.equal(playable.reduce((sum, tier) => sum + (tier.npcs || []).length, 0), 35, '普通 NPC 总数应为 35');
for (const [id, expected] of Object.entries(recovered)) {
  assert.deepEqual(findNpc(root, id), expected, `${id} 根工程数据恢复完整`);
  assert.deepEqual(findNpc(playable, id), expected, `${id} 游戏配置恢复完整`);
  assert.deepEqual(findNpc(seedNpcs, id), expected, `${id} 编辑器种子恢复完整`);
}

console.log('npc-recovery-contract.test.mjs: 两条具名 NPC 在当前版本三处数据源中一致 ✓');
