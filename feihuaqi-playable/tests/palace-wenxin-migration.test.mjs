import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Game } from '../js/engine/game.js';
import { synergyEffectText, talentEffectText } from '../js/ui/modals.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/[A-Za-z]:/, s => s.slice(1))), '..');
const load = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'config', `${name}.json`), 'utf8'));
const talents = load('talents');
const synergies = load('synergies');
const byTalent = new Map(talents.map(t => [t.id, t]));
const bySynergy = new Map(synergies.map(s => [s.id, s]));

// 旧三场回灵按旧总量折进唯一一场殿试的入场资源，避免在单场终局中暗中失效。
assert.deepEqual(byTalent.get('T028').effect, { type: 'palace_insp', value: 0, startValue: 13, scorePct: 0 });
assert.deepEqual(bySynergy.get('S16').effects[0], { effectId: 'S16-E1', stackGroup: 'synergy-score', stackMode: 'add', type: 'palace_insp', value: 0, startValue: 17 });
assert.deepEqual(bySynergy.get('S47').effects[0], { effectId: 'S47-E1', stackGroup: 'synergy-palace', stackMode: 'max', type: 'palace_insp', value: 0, startValue: 9 });
assert.match(byTalent.get('T099').text, /殿试作品得分/);
assert.doesNotMatch(byTalent.get('T099').text, /三场/);
assert.match(talentEffectText(byTalent.get('T028')), /进入殿试，灵感 \+13/);
assert.match(synergyEffectText(bySynergy.get('S48').effects[0]), /殿试作品得分 \+12%/);

// 终局后不再有下一场可吃到“获胜后加诗力”；把它折为同一场可见的诗体得分。
const poetry = bySynergy.get('S24');
assert.equal(poetry.effects.filter(e => e.type === 'palace_pct').reduce((sum, e) => sum + e.value, 0), .24);
assert.ok(poetry.effects.every(e => e.type !== 'on_win_bonus'), '诗魁殿声不保留终局后无效的获胜属性');

const ui = {
  floatAttrs() {}, floatInspiration() {}, onState() {}, showDice() {}, movePiece() {}, toast() {}, highlightCell() {},
  showQuizResult() {}, showSky() {}, skyExpired() {}, showTalentGain() {}, showPalaceIntro() {},
  async showResult() {}, async askReplaceTalent() { return 0; }, async askScenic() { return false; },
  async showQuiz() { return { index: 0, timedOut: false }; }, async showEvent() { return 0; },
};
const cfg = {
  board: { layout: 'concentric_spiral', routeCells: [], routeSize: 0, mainRing: [] },
  npcs: [{ id: 'zhukaoguan', isFinal: true, themes: ['huaigu'], battles: 1, npcs: [{ id: 'final', name: '主考官', attrs: {} }] }],
  affinity: { themes: ['huaigu'], themeNames: { huaigu: '怀古' } },
  inspiration: { initial: 0, max: 54, battleCost: 0, battleCostLate: 0 },
  attrs: { initial: {}, diminish: false }, grades: {}, schools: load('schools'), album: [], talents, synergies,
  talentById: byTalent, 'talent-upgrade': {}, talentUpgradeById: new Map(),
};
const game = new Game(cfg, ui, () => 0);
game.s = {
  phase: 'jinshi', school: { id: 'bowen' }, inspiration: 0, inspirationMax: 54, passive: ['T028', 'T099', 'T033', 'T012', 'T034'].map(id => structuredClone(byTalent.get(id))), active: [],
  attrs: {}, events: {}, quiz: {}, sky: [], palaceWins: 0, palaceDone: 0, battle: { win: 0, draw: 0, loss: 0, streak: 0, maxStreak: 0, upsets: 0, winsByStyle: {} },
  npcMech: { history: {}, palace: {} }, talentState: { triggers: {}, flags: {}, activeUses: {} }, over: false,
};
game.choiceInkSummary = () => '';
game.palaceQuestions = () => [];
game.consumeNarrativeEchoes = () => [];
game.hiddenFinalEligibility = () => ({ eligible: false });
game._maybePendReincarnate = () => {};
game.doBattle = async () => { assert.equal(game.s.inspiration, 43, '单场殿试开场获得全部折算后的入场灵感'); game.s.palaceWins += 1; return { result: 'win' }; };
game.endGame = async reason => { game.s.over = true; game.s.endReason = reason; };
await game.runPalace();
assert.equal(game.s.endReason, 'jinbang');

console.log('palace-wenxin-migration.test.mjs: 单场殿试文心与羁绊迁移 ✓');
