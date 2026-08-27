import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game, INK_AXES } from '../js/engine/game.js';
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
  assert.equal(choices.length, 84, '28 道抉择题各有 3 个选项');
  assert.ok(choices.every(o => ['shi','ci','lian','bi','xue','si'].includes(o.studyTarget)), '每项都有有效修习方向');
  assert.ok(choices.every(o => Array.isArray(o.inkTags) && o.inkTags.length >= 1 && o.inkTags.length <= 2), '每项都有 1–2 个墨痕');
  assert.ok(choices.every(o => o.inkTags.length === 2), '每项都有两条流派倾向');
  const tagCounts = Object.fromEntries(INK_AXES.flatMap(axis => [axis.left, axis.right]).map(tag => [tag, 0]));
  for (const option of choices) {
    const touchedAxes = new Set();
    for (const tag of option.inkTags) {
      const axis = INK_AXES.find(item => item.left === tag || item.right === tag);
      assert.ok(axis, `倾向端点有效：${tag}`);
      touchedAxes.add(axis.id);
      tagCounts[tag]++;
    }
    assert.equal(touchedAxes.size, 2, '同一选项的两条倾向来自不同双向轴');
  }
  for (const axis of INK_AXES) {
    assert.equal(tagCounts[axis.left], 21, `${axis.left} 端点均衡为 21`);
    assert.equal(tagCounts[axis.right], 21, `${axis.right} 端点均衡为 21`);
  }
  assert.ok(choices.every(o => typeof o.resultText === 'string' && o.resultText.trim()), '每项都有即时回声');
  assert.equal(new Set(choices.map(o => o.resultText)).size, choices.length, '每个选项都有不重复的专属即时回声');
  assert.ok(choices.every(o => o.resultText.length >= 20 && o.resultText.length <= 60), '即时回声长度适合结算弹层阅读');
  const choiceQuestions = config().questions.filter(q => q.type === 'choice');
  assert.ok(choiceQuestions.every(q => !/安全通过|高阶玩法|传统套路|邮路|诗的社交|没想通/.test(q.analysis || '')), '解析不含破坏时代氛围的措辞');
  console.log('  ✓ 84 个选项均具备方向、四轴倾向与专属回声；八端点各 21 次');
}

console.log('== 四条双向轴：逐名评语与中性回声 ==');
{
  const { game } = setup(0);
  game.s.choiceHistory = [
    { phase: 'child', inkTags: ['逐名', '守法'], optionText: '应制成篇', resultText: '你让文章走到人前。' },
    { phase: 'child', inkTags: ['逐名', '燃笔'], optionText: '当场成篇', resultText: '你把当下写尽。' }
  ];
  const profile = game.choiceInkProfile('child');
  assert.equal(profile.axes.length, 4, '完整提供四条双向轴');
  assert.equal(profile.axes.find(axis => axis.id === 'recognition').dominant, '逐名', '逐名端点可被识别');
  const highlights = game.choiceInkHighlights();
  assert.deepEqual(highlights.map(item => item.dominant), ['逐名', '燃笔'], '修习面板按强度和最近选择取两条主要倾向');
  assert.equal(highlights[0].representative.optionText, '当场成篇', '主要倾向携带代表选择');
  assert.match(game.choiceInkSummary('child'), /让文章走到人前/, '逐名拥有专属阶段评语');
  assert.match(game.choiceInkEpilogue(), /让文章走到人前/, '逐名拥有专属终局评语');
  console.log('  ✓ 四条双向轴均可汇总，逐名评语已补齐');
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
