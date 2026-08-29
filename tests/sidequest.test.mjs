import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeConfig } from '../js/engine/config.js';
import { Game } from '../js/engine/game.js';
import { deserializeRun, serializeRun } from '../js/engine/save.js';
import { weaknessResolution } from '../js/engine/rules.js';

const read = name => JSON.parse(readFileSync(new URL(`../config/${name}.json`, import.meta.url), 'utf8'));
const cfg = normalizeConfig(Object.fromEntries([
  'attrs', 'inspiration', 'board', 'questions', 'events', 'talents', 'schools', 'affinity', 'npcs', 'sky', 'grades',
  'album', 'synergies', 'npc-mechanics', 'talent-upgrade', 'narrative', 'sidequests', 'sidequest-talents', 'sidequest-npcs'
].map(name => [name, read(name)])));

const ui = {
  askScenic: async () => 'sidequest',
  chooseSideQuest: async () => 'jianghu',
  showSideQuestAct: async (route, act) => act.id === 'origin' ? 0 : 1,
  showSideQuestComplete: async () => {},
  askSideQuestFinal: async () => 'carry',
  onState() {}, toast() {}, floatAttrs() {}, floatInspiration() {}, floatInspirationMax() {},
  showTalentGain() {}, showQuizResult() {}, showSky() {}, skyExpired() {}, showDice() {}, movePiece() {}, highlightCell() {},
  async askReplaceTalent() { return -1; }, async chooseScenicTalent() { return -1; }
};

const game = new Game(cfg, ui, () => 0.2);
game.start('bowen');
game.s.inspiration = 20;

await game.doScenic({ id: 13, name: '玉门关' });
assert.equal(game.s.sideQuest.routeId, 'jianghu', '名胜可锁定一条支线');
assert.equal(game.s.sideQuest.stage, 'decision', '缘起结束后等待下一次事件或考题');
assert.deepEqual(game.s.sideQuest.choices.map(x => x.axis), ['守义']);

await game.doEvent({ id: 99, name: '测试奇遇' });
assert.equal(game.s.sideQuest.stage, 'climax', '下一次事件被第二幕替换');
assert.equal(game.s.sideQuest.pendingBattlePct, 0, '稳健选项不残留战斗加成');
assert.deepEqual(game.s.sideQuest.choices.map(x => x.axis), ['守义', '权变']);
assert.deepEqual(game.s.sideQuest.talentOfferIds, ['T041', 'T042', 'TA09'], '混合立场生成两张立场限定卡与固定主动卡');
assert.equal(game.s.sideQuest.talentOfferGenerated, true, '候选在第二幕后即写入局内状态');
ui.chooseScenicTalent = async () => 0;
const inspirationBeforeTalent = game.s.inspiration;
await game.openSideQuestTalentOffer();
assert.equal(game.s.sideQuest.talentClaimedId, 'T041', '限定候选可领取其中一枚');
assert.equal(game.s.inspiration, inspirationBeforeTalent - 6, '领取成功后才扣除 6 灵感');
assert.equal(game.randomTalent()?.source === 'sidequest', false, '普通随机池不会产出支线限定文心');

let climax;
game.doBattle = async opts => { climax = opts; return { result: 'win' }; };
await game.doBattleCell({ id: 100, name: '测试论战' });
assert.equal(climax.label, '江湖较艺·辨义', '下一场普通论战被路线高潮替换');
assert.equal(climax.npc.id, 'jh_gu_changfeng', '第三幕由顾长风替代普通对手');
assert.ok(climax.npc.scaledFromNpcId, '高潮 NPC 保留原遭遇档位来源');
assert.equal(Object.values(climax.npc.attrs).reduce((a, b) => a + b, 0), climax.npc.scaledToTotal, '高潮 NPC 的六维总量与被替代档位一致');
assert.deepEqual(climax.sideQuestRoute.steps, ['逢客', '观招', '定式', '运意', '振笔', '辨义定胜']);
assert.equal(game.s.sideQuest.stage, 'complete');
assert.equal(game.s.sideQuest.merit, 2, '高潮胜利获得功业 2');

const final = await game.prepareSideQuestFinal();
assert.equal(final.state.finalChoice, 'carry');
assert.equal(game.s.sideQuest.finalBonusPct, 0.1, '携道赴问按功业预置终局加成');
assert.equal(final.primaryNpc.id, 'jh_gu_changfeng', '完整支线的终局主考固定为路线主考 NPC');
assert.equal(final.secondaryNpc.id, 'jh_wen_suxin', '终局副考按前两幕路线选择落位');
assert.equal(final.packageId, 'mixed', '混合选择使用混合副考机制包');

const counterTemplates = cfg['npc-mechanics'];
assert.equal(weaknessResolution({ mech: { weakness: { template: 'wea_stance_counter', counter: { forget: 'different_dice' }, retention: .2 } }, templates: counterTemplates, intentStance: 'forget', playerMove: { dicePips: [2, 4] } }).hit, true, '忘机副考可由不同骰面反制');
assert.equal(weaknessResolution({ mech: { weakness: { template: 'wea_stance_counter', counter: { mirror: 'low_and_high' }, retention: .2 } }, templates: counterTemplates, intentStance: 'mirror', playerMove: { dicePips: [1, 5] } }).hit, true, '混合问心副考可由高低骰组反制');

const raw = serializeRun(game);
const loaded = deserializeRun(raw, cfg);
assert.equal(loaded.ok, true, '支线状态可写入并读回存档');
assert.equal(loaded.state.sideQuest.routeId, 'jianghu');
assert.equal(loaded.state.sideQuest.finalChoice, 'carry');
console.log('sidequest.test.mjs: 名胜支线流程、终局兑现与存档 ✓');
