import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { Game } from '../js/engine/game.js';

const load = name => JSON.parse(fs.readFileSync(new URL(`../config/${name}.json`, import.meta.url), 'utf8'));
const cfg = {};
for (const name of ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies','npc-mechanics','talent-upgrade','narrative']) cfg[name] = load(name);
const side = load('sidequest-talents');
cfg.talents.push(...side.talents);
cfg['talent-upgrade'] = { ...cfg['talent-upgrade'], ...side.upgrades };
cfg.talentById = new Map(cfg.talents.map(t => [t.id,t]));
cfg.talentUpgradeById = new Map(Object.entries(cfg['talent-upgrade']));
cfg.board.cellById = new Map(cfg.board.mainRing.map(cell => [cell.id,cell]));
cfg.board.laps = Number(cfg.board.laps) || 2;
cfg.board.ringSize = cfg.board.mainRing.length;
const additions = cfg.synergies.filter(sy => Number(sy.id.slice(1)) >= 49);
assert.equal(additions.length, 26);

const sandbox = { window:{} };
vm.runInNewContext(fs.readFileSync(new URL('../feihua-editors/assets/js/seed-synergies.js', import.meta.url), 'utf8'), sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.GAME_SYNERGIES)), cfg.synergies, '游戏与编辑器种子完整一致');
const cloud = JSON.parse(fs.readFileSync(new URL('../feihua-content.json', import.meta.url), 'utf8'));
for (const synergy of additions) {
  assert.deepEqual(cloud.synergies.find(sy => sy.id === synergy.id), synergy, `${synergy.id} 云端发布数据一致`);
  assert.equal(synergy.members.length, 2);
  for (const effect of synergy.effects) {
    if (effect.theme) assert.ok(cfg.affinity.themes.includes(effect.theme), `${synergy.id} 使用真实存在的题材，而非文风 ID`);
    for (const id of effect.when?.usedTalents || []) {
      const talent = cfg.talentById.get(id);
      assert.equal(talent?.kind, 'active', `${synergy.id} 发动条件指向主动文心`);
      assert.notEqual(talent.effect.type, 'planned_dice', `${synergy.id} 不能把移动文心当作论战发动条件`);
      assert.ok(synergy.members.includes(id), `${synergy.id} 发动条件不偷偷依赖第三枚文心`);
    }
  }
}
for (const talent of cfg.talents) {
  const pairs = cloud.synergies.filter(sy => sy.members.length === 2 && sy.members.includes(talent.id));
  assert.ok(new Set(pairs.map(sy => sy.id)).size >= 2, `${talent.id} 云端至少两条独立羁绊`);
  assert.ok(new Set(pairs.flatMap(sy => sy.members.filter(id => id !== talent.id))).size >= 2, `${talent.id} 云端至少两位不同伙伴`);
}

const ui = {
  floatAttrs(){}, floatInspiration(){}, onState(){}, showDice(){}, movePiece(){}, highlightCell(){},
  showQuizResult(){}, showSky(){}, skyExpired(){}, showTalentGain(){}, showPalaceIntro(){}, toast(){},
  async showResult(){}, async askReplaceTalent(){ return 0; }, async askScenic(){ return false; },
  async showQuiz(){ return { index:0,timedOut:false }; }, async showEvent(){ return 0; }
};
const foe = { id:'pair-foe', name:'试墨者', fullName:'试墨者', attrs:{ shi:8,ci:8,lian:8,bi:8,xue:8,si:8 } };
function makeGame(synergies) {
  const game = new Game({ ...cfg, synergies }, ui, () => .99);
  game.push = () => {};
  game.start('bowen', { name:'' });
  const members = [...new Set(synergies.flatMap(sy => sy.members))].map(id => structuredClone(cfg.talentById.get(id)));
  game.s.passive = members.filter(t => t.kind !== 'active');
  game.s.active = members.filter(t => t.kind === 'active');
  game.s.inspirationMax = 100;
  return game;
}
function resolve(synergy, options = {}) {
  const game = makeGame([synergy]);
  game.s.inspiration = options.inspiration ?? 50;
  game.s.affStreak = { manner:'zheli', n:options.streak ?? 0 };
  game.s.battle.lastResult = options.lastResult || 'win';
  const session = game.createSession({ npc:foe, label:synergy.name });
  session.theme = options.theme || 'shanshui';
  session.lastStyle = options.lastStyle || 'shi';
  session.usedActive = options.used || [];
  return game.resolveBattle(session, 'ci', 'zheli', options.dice || [4]);
}
const cases = {
  S49:[{streak:2},{streak:1}],
  S50:[{dice:[3,3]},{dice:[3,4]}],
  S51:[{dice:[3,3]},{dice:[3,4]}],
  S52:[{lastStyle:'shi'},{lastStyle:'ci'}],
  S53:[{used:['TA02']},{used:[]}],
  S54:[{theme:'huaigu'},{theme:'songbie'}],
  S56:[{used:['TA09'],inspiration:14},{used:['TA09'],inspiration:20}],
  S57:[{used:['TA09']},{used:[]}],
  S58:[{dice:[4]},{dice:[4,5]}],
  S59:[{dice:[4]},{dice:[4,5]}],
  S60:[{dice:[2,5]},{dice:[3,5]}],
  S61:[{dice:[3,4]},{dice:[3,3]}],
  S62:[{lastResult:'lose'},{lastResult:'win'}],
  S64:[{used:['TA10'],inspiration:75},{used:['TA10'],inspiration:40}],
  S65:[{used:['TA10'],dice:[4]},{used:['TA10'],dice:[3]}],
  S66:[{used:[]},{used:['TA04']}],
  S67:[{inspiration:75},{inspiration:50}],
  S68:[{dice:[1,5]},{dice:[3,5]}],
  S69:[{used:['TA07'],dice:[6]},{used:[],dice:[6]}],
  S70:[{used:['TA11'],dice:[1,6]},{used:[],dice:[1,6]}],
  S71:[{used:['TA11'],dice:[1,6]},{used:[],dice:[1,6]}],
  S72:[{inspiration:14},{inspiration:15}],
  S73:[{dice:[4]},{dice:[4,5]}],
  S74:[{used:['TA04'],dice:[6]},{used:[],dice:[6]}]
};
for (const [id,[on,off]] of Object.entries(cases)) {
  const synergy = additions.find(sy => sy.id === id);
  const effect = synergy.effects[0];
  const triggerId = `synergy:${id}:${effect.effectId}`;
  const hit = resolve(synergy,on);
  const miss = resolve(synergy,off);
  if (effect.value > 0) assert.ok(hit.selfCalc.items[4].detail.includes(`羁绊·${synergy.name}`), `${id} 达成条件进入实际算分`);
  if (effect.reward || effect.insight) assert.ok(hit.talentTriggers.some(trigger => trigger.id === triggerId && trigger.reward), `${id} 奖励进入实际结算快照`);
  assert.ok(!miss.selfCalc.items[4].detail.includes(`羁绊·${synergy.name}`), `${id} 未达条件不加分`);
  assert.ok(!miss.talentTriggers.some(trigger => trigger.id === triggerId), `${id} 未达条件不发奖`);
  if (effect.when?.usedTalents) {
    const unused = resolve(synergy,{...on,used:[]});
    assert.ok(!unused.selfCalc.items[4].detail.includes(`羁绊·${synergy.name}`), `${id} 未发动所需文心不加分`);
    assert.ok(!unused.talentTriggers.some(trigger => trigger.id === triggerId), `${id} 未发动所需文心不发奖`);
  }
}

// 成长与限次回灵感不是算分项，单独走真实结算入口。
{
  const game = makeGame([additions.find(sy => sy.id === 'S55')]);
  let attrs;
  game.addAttrs = delta => { attrs = delta; return delta; };
  game.s.nextBattlePct = 0;
  game.applyStudyGain({style:1},'研习','ci',[]);
  assert.deepEqual(attrs,{ci:2}, 'S55 为基础研习额外加 1');
  assert.equal(game.s.nextBattlePct,.04, 'S55 为下一场保留 4% 得分');
}
{
  const synergy = additions.find(sy => sy.id === 'S63');
  const game = makeGame([synergy]);
  const gains = [];
  const addInspiration = game.addInspiration.bind(game);
  game.addInspiration = (value,reason) => { if (reason === `羁绊·${synergy.name}`) gains.push(value); return addInspiration(value,reason); };
  for (let round=0; round<4; round++) {
    game.s.inspiration = 10;
    const session = game.createSession({npc:foe,label:'限次恢复'});
    session.passiveTalents = []; // 排除成员自身恢复，只审计该羁绊的战后钩子。
    const out = game.resolveBattle(session,'ci','zheli',[4]);
    out.result = 'draw';
    await game.settleBattle(session,out);
  }
  assert.deepEqual(gains,[2,2,2], 'S63 真实战后恢复 2 灵感且第四次不再触发');
}
assert.equal(Object.keys(cases).length + 2, additions.length, '每条新增羁绊均有实际效果验证');

// 与旧三文心共鸣同时持有时，新增得分不能无节制累加。
{
  const group = cfg.synergies.filter(sy => ['S30','S58','S59','S73'].includes(sy.id));
  const game = makeGame(group);
  game.s.inspiration = 50;
  const out = game.resolveBattle(game.createSession({npc:foe,label:'同组取高'}),'ci','zheli',[4]);
  assert.match(out.selfCalc.items[4].detail,/羁绊·藏锋守简·骰组 \+12%/);
  assert.doesNotMatch(out.selfCalc.items[4].detail,/羁绊·清野收笔|羁绊·退笔留白/);
}
console.log('wenxin-independent-pairs.test.mjs: 26 条新增羁绊实际效果、条件门、限次、同组取高与三端数据一致 ✓');
