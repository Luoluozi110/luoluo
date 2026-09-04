import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Game } from '../js/engine/game.js';
import { synergyEffectText } from '../js/ui/modals.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/[A-Za-z]:/, s => s.slice(1))), '..');
const load = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'config', `${name}.json`), 'utf8'));
const main = load('talents');
const side = load('sidequest-talents');
const talents = [...main, ...(side.talents || [])];
const synergies = load('synergies');
const upgrades = { ...load('talent-upgrade'), ...(side.upgrades || {}) };
const talentById = new Map(talents.map(t => [t.id, t]));

// 一条 A+B+C 羁绊不算两条；A+B 的两个重复记录也不算两位不同伙伴。
const pairBonds = (id, list) => list.filter(sy => sy.members.length === 2 && new Set(sy.members).size === 2 && sy.members.includes(id));
const hasTwoIndependentPairs = (id, list) => {
  const pairs = pairBonds(id, list);
  return new Set(pairs.map(sy => sy.id)).size >= 2 && new Set(pairs.flatMap(sy => sy.members.filter(member => member !== id))).size >= 2;
};
assert.equal(hasTwoIndependentPairs('A', [{ id:'one', members:['A','B','C'] }]), false, '三文心一组不能冒充两条独立羁绊');
assert.equal(hasTwoIndependentPairs('A', [{ id:'one', members:['A','B'] }, { id:'two', members:['A','B'] }]), false, '相同伙伴的两条记录不能达标');
assert.equal(hasTwoIndependentPairs('A', [{ id:'one', members:['A','B'] }, { id:'one', members:['A','C'] }]), false, '相同羁绊 ID 不能重复计数');
assert.equal(hasTwoIndependentPairs('A', [{ id:'one', members:['A','B'] }, { id:'two', members:['A','C'] }]), true, '两条不同的双文心羁绊才达标');

assert.equal(talents.length, 61, '覆盖审计包含主线与支线全部 61 枚文心');
assert.equal(synergies.length, 74, '原有 48 条羁绊保留，新增 26 条独立双文心羁绊');
assert.equal(new Set(synergies.map(sy => sy.id)).size, synergies.length, '羁绊 ID 不重复');
const allPairs = synergies.filter(sy => sy.members.length === 2);
assert.equal(allPairs.length, 62, '共 62 条独立双文心羁绊');
assert.equal(new Set(allPairs.map(sy => sy.members.slice().sort().join('+'))).size, allPairs.length, '不以同一对成员的重复记录充数');
for (const talent of talents) {
  assert.ok(hasTwoIndependentPairs(talent.id, synergies), `${talent.id} ${talent.name} 至少与两位不同伙伴分别构成两条独立双文心羁绊`);
}
for (const synergy of synergies) {
  for (const member of synergy.members) assert.ok(talentById.has(member), `${synergy.id} 成员 ${member} 存在`);
  assert.ok(synergy.effects.every(effect => effect.effectId && effect.stackMode), `${synergy.id} 效果可稳定追踪并声明叠加规则`);
}

for (const id of ['T009','T015','T018','T024','T038','T043','TA11']) {
  assert.deepEqual(talentById.get(id).effect, upgrades[id].levels[0].effect, `${id} 强化值与 Lv1 权威值一致`);
}
assert.equal(talentById.get('T009').effect.attrs.xue, 3);
assert.deepEqual([talentById.get('T015').effect.threshold, talentById.get('T015').effect.value], [14, .16]);
assert.equal(talentById.get('T024').effect.mult, 1.25);
assert.deepEqual([talentById.get('T038').effect.value, talentById.get('T038').effect.cap], [.03, .15]);
assert.equal(talentById.get('T043').effect.value, .04);
assert.equal(talentById.get('TA11').effect.value, .06);

const cfg = {};
for (const name of ['attrs','inspiration','board','questions','events','schools','affinity','npcs','sky','grades','album','npc-mechanics','narrative']) cfg[name] = load(name);
cfg.talents = talents;
cfg.synergies = synergies;
cfg['talent-upgrade'] = upgrades;
cfg.board.cellById = new Map((cfg.board.mainRing || []).map(cell => [cell.id, cell]));
cfg.board.laps = Number(cfg.board.laps) || 2;
cfg.board.ringSize = cfg.board.mainRing.length;
cfg.talentById = talentById;
cfg.talentUpgradeById = new Map(Object.entries(upgrades));
const ui = { floatAttrs(){}, floatInspiration(){}, onState(){}, showDice(){}, movePiece(){}, highlightCell(){}, showQuizResult(){}, showSky(){}, skyExpired(){}, showTalentGain(){}, showPalaceIntro(){}, toast(){}, async showResult(){}, async askReplaceTalent(){ return 0; }, async askScenic(){ return false; }, async showQuiz(){ return { index:0, timedOut:false }; }, async showEvent(){ return 0; }, async runBattle(){ throw new Error('not used'); } };
const game = new Game(cfg, ui, () => 0);
game.push = () => {};
game.start('bowen', { name:'' });
for (const synergy of allPairs) {
  const members = synergy.members.map(id => structuredClone(talentById.get(id)));
  game.s.passive = members.filter(t => t.kind !== 'active');
  game.s.active = members.filter(t => t.kind === 'active');
  assert.ok(game.synergySet().some(sy => sy.id === synergy.id), `${synergy.id} 仅持有这两枚文心即可激活，无需第三枚`);
  for (const removed of members) {
    game.s.passive = members.filter(t => t.kind !== 'active' && t.id !== removed.id);
    game.s.active = members.filter(t => t.kind === 'active' && t.id !== removed.id);
    assert.ok(!game.synergySet().some(sy => sy.id === synergy.id), `${synergy.id} 移除 ${removed.id} 后解除`);
  }
}
game.s.passive = [];
game.s.active = [];
const hints = game.talentSynergyHints(talentById.get('T041'));
assert.ok(hints.length > 0, '获得文心时返回相关羁绊');
assert.ok(hints.every(hint => hint.members.length >= 2 && hint.effects.length >= 1), '获得提示包含组成与完整效果');
assert.ok(hints.some(hint => hint.members.some(member => member.name === '抱柱之信' && member.owned)), '待获得文心在提示中按已收入预览');
assert.deepEqual(hints.filter(hint => hint.members.length === 2).map(hint => hint.id).sort(), ['S49','S50'], '获得抱柱之信时提供两条不同双文心羁绊');

const foe = { id:'bond-foe', name:'试墨者', fullName:'试墨者', attrs:{ shi:8, ci:8, lian:8, bi:8, xue:8, si:8 } };
const get = id => structuredClone(talentById.get(id));
game.s.passive = [get('T044'), get('T035'), get('T023')];
game.s.active = [];
let out = game.resolveBattle(game.createSession({ npc:foe, label:'藏锋守简' }), 'shi', 'zheli', [4]);
assert.match(out.selfCalc.items[4].detail, /羁绊·藏锋守简·骰组 \+12%/, '三文心羁绊支持单骰形态并进入算分明细');
game.s.passive = [get('T047'), get('T008')];
game.s.active = [get('TA08')];
out = game.resolveBattle(game.createSession({ npc:foe, label:'坐忘定局' }), 'ci', 'zheli', [4]);
assert.match(out.selfCalc.items[4].detail, /羁绊·坐忘定局·藏锋 \+10%/, '未发动论战主动文心时触发藏锋羁绊');
game.s.passive = [get('T048'), get('T007'), get('T040')];
game.s.active = [];
out = game.resolveBattle(game.createSession({ npc:foe, label:'梦蝶偶得' }), 'ci', 'zheli', [3, 3]);
assert.match(out.selfCalc.items[4].detail, /羁绊·梦蝶偶得·骰组 \+12%/, '羁绊骰组支持首尾同点形态');

assert.match(synergyEffectText(synergies.find(sy => sy.id === 'S34').effects[0]), /未发动主动文心/);
assert.match(synergyEffectText(synergies.find(sy => sy.id === 'S35').effects[0]), /首尾同点/);

const appSource = fs.readFileSync(path.join(ROOT, 'js', 'ui', 'app.js'), 'utf8');
const hudSource = fs.readFileSync(path.join(ROOT, 'js', 'ui', 'hud.js'), 'utf8');
const modalSource = fs.readFileSync(path.join(ROOT, 'js', 'ui', 'modals.js'), 'utf8');
assert.match(appSource, /showTalentGain: \(t, meta\) => modals\.showTalentGain\(t, meta\)/, '获得流程不再丢弃羁绊提示元数据');
assert.match(hudSource, /id="synergyQuery"/, '右侧文心栏提供羁绊图谱入口');
assert.match(modalSource, /showSynergyCatalog\(\)/, '羁绊图谱可查询组成、缺失成员与效果');

console.log('wenxin-bond-coverage.test.mjs: 61 枚文心均有两条独立双文心羁绊；62 条双文心激活/解除、弱项强化与查询契约 ✓');
