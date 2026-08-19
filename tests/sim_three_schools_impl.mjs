import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game } from '../feihuaqi-playable/js/engine/game.js';
import { serializeRun, deserializeRun, RUN_SAVE_VERSION } from '../feihuaqi-playable/js/engine/save.js';

const schools = JSON.parse(fs.readFileSync(new URL('../feihuaqi-playable/config/schools.json', import.meta.url)));
const inspiration = JSON.parse(fs.readFileSync(new URL('../feihuaqi-playable/config/inspiration.json', import.meta.url)));
const attrs = JSON.parse(fs.readFileSync(new URL('../feihuaqi-playable/config/attrs.json', import.meta.url)));
const talentRows = JSON.parse(fs.readFileSync(new URL('../feihuaqi-playable/config/talents.json', import.meta.url)));
const talentById = new Map(talentRows.map(t => [t.id, t]));
const cfg = {
  schools, inspiration, attrs, talentById, talents: talentRows,
  talentUpgradeById: new Map(),
  affinity: { themes: ['yongwu'], manners: ['wanyue'], matrix: {}, themeNames: { yongwu: '咏物' }, mannerNames: { wanyue: '婉约' } },
  board: { ringSize: 80, laps: 2 }, events: [{ id: 'E1', name: '小试', kind: 'direct', rarity: 'common', effect: { attrs: { xue: 1 } } }], album: [], synergies: [], sky: [], grades: { battle: { drawRatio: 0.05 } },
  'npc-mechanics': {}
};
const ui = {
  floatAttrs() {}, floatInspiration() {}, onState() {}, toast() {},
  showTalentGain: async () => {}, askReplaceTalent: async () => null,
  showBowenChoice: async () => 'focus', showEvent: async () => 0
};

const game = new Game(cfg, ui, () => 0.1);
for (const id of ['bowen', 'qishi', 'cizong_bi']) {
  game.start(id);
  assert.equal(game.s.school.id, id);
  assert.ok(game.s.schoolState, `${id} has schoolState`);
}

game.start('qishi');
const before = game.s.inspiration;
game.addInspiration(3, '答对');
assert.equal(game.s.inspiration, before + 3, 'qishi positive inspiration uses restrained 20% accumulator');
assert.equal(game.s.schoolState.inspirationAccumulator, 0.6, 'fractional inspiration is retained');
game.s.inspiration = 66;
game.s.talentLevels.T008 = 1;
game.s.passive = [game.leveledTalent(talentById.get('T008'), 1)];
const up = { quality: 'common', maxLevel: 2, upCost: [10], levels: [{ effect: { type: 'attr_flat', attrs: { si: 3 } } }, { effect: { type: 'attr_flat', attrs: { si: 4 } } }] };
game.cfg.talentUpgradeById.set('T008', up);
const upgraded = game.upgradeTalent('T008');
assert.equal(upgraded.ok, true);
assert.equal(upgraded.cost, 8, 'qishi upgrade cost is ceil(base * 0.80)');

game.start('bowen');
game.s.turn = 1;
game.s.schoolState.knowledge = 1;
await game.gainBowenKnowledge('专项测试');
assert.equal(game.s.abilityState.insight, 4, '博闻知识转化为 4 点可分配心得');
assert.equal(game.s.attrs.shi, 5, '博闻不再自动灌入诗力');

game.start('cizong_bi');
const session = game.createSession({ npc: { id: 'n', name: '测试', attrs: { shi: 5, ci: 5, lian: 5, bi: 5, xue: 5, si: 5 } }, theme: 'yongwu' });
const out = game.resolveBattle(session, 'shi', 'wanyue', 1);
assert.deepEqual(out.dicePips, [1]);
assert.equal(out.selfCalc.diceScore, 4, '辞宗不再常驻 +2 骰；诗·一气低骰按 0.7 结算');
assert.equal(game.manuscriptCap(), 4, '辞宗开局稿匣获得 +1 容量');

const saved = serializeRun(game);
assert.equal(saved.v, RUN_SAVE_VERSION);
assert.ok(saved.state.schoolState);
assert.ok(saved.state.abilityState && saved.state.abilityState.technique, '方案 B/C 状态进入存档');
const restored = deserializeRun(saved, cfg);
assert.equal(restored.ok, true);
assert.equal(restored.state.schoolState.type, 'cizong_bi');
assert.equal(restored.state.abilityState.technique.version, 1);

console.log('三流派实现验证：方案 B/C 契约通过');
