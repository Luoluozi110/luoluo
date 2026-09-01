import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../js/engine/game.js';
import { normalizeConfig, validateConfig } from '../js/engine/config.js';
import { deserializeRun, serializeRun } from '../js/engine/save.js';
import {
  buildEndScroll, emptyPoetryState, normalizePoetryState,
  prepareChapterDraft, recordPoetryMoment, selectChapterLine
} from '../js/engine/end-scroll.js';

const names = ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies','npc-mechanics','talent-upgrade','narrative','sidequests','sidequest-talents','sidequest-npcs'];
const cfg = {};
for (const name of names) cfg[name] = JSON.parse(readFileSync(new URL(`../config/${name}.json`, import.meta.url), 'utf8'));
assert.equal(validateConfig(cfg).ok, true, '成卷模板须通过统一配置契约');
normalizeConfig(cfg);
const scrollCfg = cfg.narrative.endScroll;

console.log('== 章句候选只读本局事实 ==');
const poetry = emptyPoetryState();
recordPoetryMoment(poetry, { type: 'battle', chapter: 'outer', theme: 'yongwu', manner: 'qingya' });
recordPoetryMoment(poetry, { type: 'battle', chapter: 'outer', theme: 'yongwu', manner: 'qingya' });
recordPoetryMoment(poetry, { type: 'choice', chapter: 'outer', refId: 'Q0101', inkTags: ['求真'], resultText: '你在月下留住了自己的句子。' });
const outer = prepareChapterDraft(poetry, scrollCfg, 'outer', { playerName: '试卷人', turn: 24 });
assert.equal(outer.candidates.length, 2, '每章给两条短句');
assert.equal(outer.selectedId, outer.candidates[0].id, '首句默认选中，不增加必点步骤');
assert.ok(outer.candidates.some(item => item.id === 'outer_yongwu'), '高频咏物事实能命中对应模板');
const alternate = outer.candidates[1].id;
assert.equal(selectChapterLine(poetry, 'outer', alternate), alternate);
recordPoetryMoment(poetry, { type: 'battle', chapter: 'outer', theme: 'biansai', manner: 'haofang' });
assert.equal(prepareChapterDraft(poetry, scrollCfg, 'outer', { turn: 40 }).selectedId, alternate, '章末定稿后不随之后信号重抽');

console.log('== 提前收卷与完整三章 ==');
const early = buildEndScroll(poetry, scrollCfg, {
  playerName: '试卷人', routeIndex: 20, ringId: 'outer', endReason: 'turnlimit',
  labels: { themes: cfg.affinity.themeNames, manners: cfg.affinity.mannerNames }
});
assert.equal(early.lines.length, 1, '提前结束也至少保留一章');
assert.equal(early.seal, '余墨待续');
assert.ok(!('score' in early), '成卷结果不含数值或评分字段');

recordPoetryMoment(poetry, { type: 'battle', chapter: 'middle', theme: 'songbie', manner: 'wanyue' });
recordPoetryMoment(poetry, { type: 'battle', chapter: 'inner', theme: 'huaigu', manner: 'chenyu', important: true, resultText: '你在金殿前重新读懂了旧章。' });
const full = buildEndScroll(poetry, scrollCfg, {
  playerName: '试卷人', routeIndex: 150, ringId: 'inner', reachedEnd: true, endReason: 'jinbang',
  labels: { themes: cfg.affinity.themeNames, manners: cfg.affinity.mannerNames }
});
assert.equal(full.lines.length, 3);
assert.equal(full.seal, '金榜题名');
assert.match(full.note, /咏物|清雅|金殿/);
assert.ok(full.title && full.endingLine && full.sourceRefs.length >= 3);
for (const [reason, seal] of Object.entries({
  fengbi: '墨意犹存', turnlimit: '余墨待续', palace: '行卷有痕',
  jinbang: '金榜题名', taoyuan: '桃源出卷', secret_loss: '花笺留问'
})) {
  const ending = buildEndScroll(emptyPoetryState(), scrollCfg, { routeIndex: 0, ringId: 'outer', endReason: reason });
  assert.equal(ending.seal, seal, `${reason} 必须命中专属印章`);
  assert.ok(ending.endingLine, `${reason} 必须有收束句`);
}

console.log('== 关键记忆上限与坏档清洗 ==');
for (let i = 0; i < 20; i++) recordPoetryMoment(poetry, { type: 'event', chapter: 'inner', refId: `E${i}`, resultText: `回声${i}` });
assert.equal(poetry.moments.length, 12);
const cleaned = normalizePoetryState({ chapterDrafts: { outer: { candidateIds: ['x', 'x', ''], selectedId: 'bad' } }, moments: [{}] });
assert.deepEqual(cleaned.chapterDrafts.outer.candidateIds, ['x']);
assert.equal(cleaned.chapterDrafts.outer.selectedId, 'x');

console.log('== 引擎结算与存档往返 ==');
let shown = null;
const ui = { toast() {}, onState() {}, floatAttrs() {}, floatInspiration() {}, async askReplaceTalent() { return 0; }, async showResult(sum) { shown = sum; } };
const game = new Game(cfg, ui, () => 0.5);
game.start('bowen', { name: '存卷人' });
game.rememberPoetry({ type: 'choice', refId: 'Q-test', inkTags: ['求真'], resultText: '这一笔只记选择，不改胜负。' });
const gameDraft = game.preparePoetryChapter('outer');
game.selectPoetryLine('outer', gameDraft.candidates[1].id);
const restored = deserializeRun(serializeRun(game), cfg);
assert.equal(restored.ok, true);
assert.equal(restored.state.poetryState.chapterDrafts.outer.selectedId, gameDraft.candidates[1].id);
assert.equal(restored.state.poetryState.moments[0].refId, 'Q-test');
const summary = await game.endGame('turnlimit');
assert.equal(summary.endScroll.lines.length, 1);
assert.equal(shown.endScroll.title, summary.endScroll.title);

console.log('end-scroll.test.mjs: 候选、定稿、合卷、上限、结算与存档全部通过');
