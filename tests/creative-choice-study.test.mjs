import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../js/engine/game.js';
import { normalizeConfig } from '../js/engine/config.js';
import { deserializeRun, serializeRun } from '../js/engine/save.js';

const names = ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies','npc-mechanics','talent-upgrade','narrative'];
function config() {
  const cfg = {};
  for (const name of names) cfg[name] = JSON.parse(readFileSync(new URL(`../config/${name}.json`, import.meta.url), 'utf8'));
  return normalizeConfig(cfg);
}
function ui(index) {
  return {
    feedback: null,
    toast() {}, onState() {}, floatAttrs() {}, floatInspiration() {},
    async showQuiz() { return { index, timedOut: false }; },
    async showQuizResult(_q, _ans, _ok, feedback) { this.feedback = feedback; },
    async askReplaceTalent() { return 0; }, async showResult() {}
  };
}
function setup(index) {
  const cfg = config();
  const q = cfg.questions.find(item => item.id === 'Q0101');
  cfg.questions = [q]; // 强制 doQuiz 回退到创作抉择池
  const view = ui(index);
  const game = new Game(cfg, view, () => 0);
  game.start('bowen', { name: '' });
  return { cfg, game, view, q };
}

console.log('== 创作抉择题内容契约 ==');
{
  const choices = config().questions.filter(q => q.type === 'choice').flatMap(q => q.options || []);
  assert.equal(choices.length, 54, '18 道抉择题各有 3 个选项');
  assert.ok(choices.every(o => ['shi','ci','lian','bi','xue','si'].includes(o.studyTarget)), '每项都有有效修习方向');
  assert.ok(choices.every(o => Array.isArray(o.inkTags) && o.inkTags.length >= 1 && o.inkTags.length <= 2), '每项都有 1–2 个墨痕');
  assert.ok(choices.every(o => typeof o.resultText === 'string' && o.resultText.trim()), '每项都有即时回声');
  assert.equal(new Set(choices.map(o => o.resultText)).size, choices.length, '每个选项都有不重复的专属即时回声');
  assert.ok(choices.every(o => o.resultText.length >= 20 && o.resultText.length <= 60), '即时回声长度适合结算弹层阅读');
  const choiceQuestions = config().questions.filter(q => q.type === 'choice');
  assert.ok(choiceQuestions.every(q => !/安全通过|高阶玩法|传统套路|邮路|诗的社交|没想通/.test(q.analysis || '')), '解析不含破坏时代氛围的措辞');
  console.log('  ✓ 54 个选项均具备方向、墨痕与专属回声');
}

console.log('== 当前研修方向：推进进度，不直接灌属性 ==');
{
  const { game, view } = setup(0); // Q0101 A → 诗力；博闻默认研修诗力
  const before = game.s.attrs.shi;
  const insightBefore = game.s.abilityState.insight;
  await game.doQuiz({ type: 'quiz' });
  assert.equal(game.s.attrs.shi, before, '首笔只推进研修，未直接增加诗力');
  assert.equal(game.s.abilityState.study.progress.shi, 1.4, '诗力研修进度按学力 +1.4');
  assert.equal(game.s.abilityState.insight, insightBefore, '当前研修方向不额外获得心得');
  assert.equal(game.s.choiceHistory.length, 1, '选择记录已写入墨痕历史');
  assert.match(view.feedback.rewardText, /诗力研修进度 \+1\.4/);
  console.log('  ✓ 当前研修方向正确推进进度');
}

console.log('== 旁通方向：沉淀为心得 ==');
{
  const { game, view } = setup(1); // Q0101 B → 思力，非当前研修
  const before = game.s.attrs.si;
  const insightBefore = game.s.abilityState.insight;
  await game.doQuiz({ type: 'quiz' });
  assert.equal(game.s.attrs.si, before, '旁通不直接增加思力');
  assert.equal(game.s.abilityState.insight, insightBefore + 1, '旁通获得心得 +1');
  assert.equal(game.s.abilityState.study.progress.si || 0, 0, '旁通不改写当前研修轨道');
  assert.match(view.feedback.rewardText, /心得 \+1/);
  console.log('  ✓ 非当前方向转化为可分配心得');
}

console.log('== 心得已满：收益转为临场研修 ==');
{
  const { game, view } = setup(1);
  game.s.abilityState.insight = game.insightCap();
  await game.doQuiz({ type: 'quiz' });
  assert.equal(game.s.abilityState.insight, game.insightCap(), '心得不溢出');
  assert.equal(game.s.abilityState.study.progress.si, 1.4, '满额心得自动转为思力研修 +1.4');
  assert.match(view.feedback.rewardText, /心得已满/);
  console.log('  ✓ 满额时不会吞掉创作抉择收益');
}

console.log('== 墨痕存档往返 ==');
{
  const { cfg, game } = setup(2);
  await game.doQuiz({ type: 'quiz' });
  const restored = deserializeRun(serializeRun(game), cfg);
  assert.equal(restored.ok, true, '创作抉择后的存档可读取');
  assert.equal(restored.state.choiceHistory.length, 1, '墨痕历史随存档保留');
  assert.equal(restored.state.choiceHistory[0].target, 'bi');
  console.log('  ✓ 墨痕记录安全存档与读档');
}

console.log('creative-choice-study.test.mjs: 创作抉择—修习融合全部通过');
