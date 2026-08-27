import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../js/engine/game.js';
import { normalizeConfig } from '../js/engine/config.js';
import { deserializeRun, serializeRun } from '../js/engine/save.js';

const names = ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies','npc-mechanics','talent-upgrade','narrative'];
const cfg = {};
for (const name of names) cfg[name] = JSON.parse(readFileSync(new URL(`../config/${name}.json`, import.meta.url), 'utf8'));
normalizeConfig(cfg);

const ui = { toast() {}, onState() {}, floatAttrs() {}, floatInspiration() {}, async askReplaceTalent() { return 0; }, async showResult() {} };
const game = new Game(cfg, ui, () => 0.5);
game.start('bowen', { name: '试卷人' });

console.log('== 六条中程回声链 ==');
assert.equal(cfg.narrative.echoChains.length, 6, '叙事配置恰有六条强回声链');
for (const chain of cfg.narrative.echoChains) {
  const event = cfg.events.find(item => item.id === chain.eventId);
  assert.ok(event && event.kind === 'choice', `${chain.id} 锚定可选择奇遇`);
  game.recordNarrativeEventChoice(event, event.choices[0].text, event.choices[0].resultText);
}
const echoes = game.consumeNarrativeEchoes();
assert.equal(echoes.length, 6, '所有已命中回声在下一叙事节点一次性返场');
assert.equal(game.consumeNarrativeEchoes().length, 0, '回声已展示后不会重复播出');
console.log('  ✓ 六条回声均为确定性登记、一次性回返');

console.log('== 换圈行卷章法 ==');
game.s.choiceHistory = [
  { inkTags: ['守法', '惜身'], optionText: '循格收卷', resultText: '', phase: 'child', turn: 1 },
  { inkTags: ['守法', '惜身'], optionText: '留白养气', resultText: '', phase: 'child', turn: 2 }
];
const tactics = game.chapterTactics();
assert.deepEqual(tactics.map(item => item.tendency), ['守法', '惜身'], '章法只读取守法/出新、惜身/燃笔两轴');
assert.match(tactics[0].title, /循格成章/);
assert.match(tactics[1].title, /留白养气/);
console.log('  ✓ 两组首批章法随当前倾向生成');

console.log('== 四名关系 NPC ==');
const middle = game.relationBeats('middle');
const inner = game.relationBeats('inner');
assert.deepEqual(middle.map(item => item.npcId), ['zhou_xiaoman', 'su_mingzhe']);
assert.deepEqual(inner.map(item => item.npcId), ['tang_ji_qing', 'yuwen_yuan']);
assert.equal(game.relationBeats('middle').length, 0, '同一换圈不会重复投递来笺');
const zhou = cfg.npcs.flatMap(tier => tier.npcs || []).find(item => item.id === 'zhou_xiaoman');
game.recordRelationEncounter(zhou);
game.recordRelationEncounter(zhou);
assert.equal(game.s.narrativeState.relationEncounters.zhou_xiaoman, 2, '实际交锋会记入关系经历');
console.log('  ✓ 周小满、苏明哲、唐季卿、宇文渊均有固定关系节点');

console.log('== 殿试三问与组合结局 ==');
const questions = game.palaceQuestions();
assert.equal(questions.length, 3, '入殿前固定呈现三问');
assert.deepEqual(questions.map(item => item.key), ['变', '情', '用']);
assert.ok(questions.every(item => item.prompt && item.reading), '每问都读取本局历程生成评语');
const ending = game.composedEpilogue();
assert.match(ending, /博闻/);
assert.match(ending, /周小满/);
console.log('  ✓ 结局按流派与关系经历拼接');

console.log('== 叙事状态存档往返 ==');
const restored = deserializeRun(serializeRun(game), cfg);
assert.equal(restored.ok, true);
assert.equal(restored.state.narrativeState.eventChoices.length, 6);
assert.equal(restored.state.narrativeState.relationEncounters.zhou_xiaoman, 2);
assert.equal(restored.state.narrativeState.echoesShown.jianglang, true);
console.log('  ✓ 回声和关系状态可安全读档');

console.log('narrative-threads.test.mjs: 叙事链、章法、关系、殿试与组合结局全部通过');
