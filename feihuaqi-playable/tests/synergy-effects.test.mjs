import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Game } from '../js/engine/game.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/[A-Za-z]:/, s => s.slice(1))), '..');
const load = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'config', `${name}.json`), 'utf8'));
const cfg = {};
for (const name of ['attrs', 'inspiration', 'board', 'questions', 'events', 'talents', 'schools', 'affinity', 'npcs', 'sky', 'grades', 'album', 'synergies', 'npc-mechanics', 'talent-upgrade']) cfg[name] = load(name);
cfg.board.cellById = new Map((cfg.board.mainRing || []).map(c => [c.id, c]));
cfg.board.laps = Number(cfg.board.laps) || 2;
cfg.board.ringSize = cfg.board.mainRing.length;
cfg.talentById = new Map(cfg.talents.map(t => [t.id, t]));
cfg.talentUpgradeById = new Map(Object.entries(cfg['talent-upgrade']));

const ui = {
  floatAttrs() {}, floatInspiration() {}, onState() {}, showDice() {}, movePiece() {}, highlightCell() {},
  showQuizResult() {}, showSky() {}, skyExpired() {}, showTalentGain() {}, showPalaceIntro() {}, toast() {},
  async showResult() {}, async askReplaceTalent() { return 0; }, async askScenic() { return false; },
  async showQuiz() { return { index: 0, timedOut: false }; }, async showEvent() { return 0; },
  async runBattle() { throw new Error('not used'); }
};
const foe = { id: 'synergy-foe', name: '试墨者', fullName: '试墨者', attrs: { shi: 8, ci: 8, lian: 8, bi: 8, xue: 8, si: 8 } };
const get = id => structuredClone(cfg.talentById.get(id));
function game() { const g = new Game(cfg, ui, () => 0); g.push = () => {}; g.start('bowen', { name: '' }); return g; }
function score(g, label = '羁绊校验') { return g.resolveBattle(g.createSession({ npc: foe, label }), 'ci', 'zheli', [4]); }

assert.equal(cfg.synergies.length, 48, '羁绊已扩充至 48 组');
for (const id of ['S18','S19','S20','S21','S22','S23','S24','S25']) assert.ok(cfg.synergies.some(sy => sy.id === id), `阶段 C 羁绊 ${id} 仍在游戏配置`);

{
  const g = game();
  g.s.inspiration = 14;
  g.s.passive = [get('T025'), get('T031')];
  assert.match(score(g).selfCalc.items[4].detail, /羁绊·绝处逢春·逆境 \+14%/, '低灵感时逆境羁绊提供强反馈得分加成');
}
{
  const g = game();
  g.s.passive = [get('T037')]; g.s.active = [get('TA02')];
  g.ensureAbilityState().lastStyle = 'shi';
  const out = score(g, '换笔成章');
  assert.match(out.selfCalc.items[4].detail, /羁绊·换笔成章·换体 \+14%/, '换体羁绊提供独立得分加成');
  assert.equal(out.talentTriggers.find(t => t.id === 'synergy:S13:S13-E1').reward.value, 2, '稳定 effectId 将心得奖励写入战后结算快照');
}
{
  const g = game();
  g.s.passive = [get('T038'), get('T040')];
  g.ensureAbilityState().manuscript.pages = 2;
  const session = g.createSession({ npc: foe, label: '稿本生辉' });
  const out = g.resolveBattle(session, 'ci', 'zheli', [4]);
  assert.match(out.selfCalc.items[4].detail, /羁绊·稿本生辉·稿本2页 \+3%/, '稿本羁绊依稿页层数成长');
}
{
  const g = game();
  g.s.passive = [get('T022'), get('T039')];
  g.s.affStreak = { manner: 'zheli', n: 2 };
  assert.match(score(g, '连捷成章').selfCalc.items[4].detail, /羁绊·连捷成章·连捷 \+14%/, '连捷羁绊只在达成连胜门槛后生效');
}

const editorSeed = fs.readFileSync(path.resolve(ROOT, '..', 'feihua-editors', 'assets', 'js', 'seed-synergies.js'), 'utf8');
for (const id of ['S18','S19','S20','S21','S22','S23','S24','S25']) assert.match(editorSeed, new RegExp(`"id": "${id}"`), `${id} 已同步至编辑器种子`);
for (const id of ['S26','S30','S34','S38','S42','S48']) assert.match(editorSeed, new RegExp(`"id": "${id}"`), `${id} 已同步至编辑器种子`);
console.log('synergy-effects.test.mjs: 多路线文心羁绊与编辑器同步 ✓');
