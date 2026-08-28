#!/usr/bin/env node
// 天象应势（阶段一）：SK01 月圆之夜 / SK03 科场风起 / SK05 梅雨愁绪。
// 覆盖：三卡应势的消耗与结算、构思不足与「顺其自然」的回退、
//       重复触发不重复兑现、doSky 交互选择、存档 roundtrip 与旧档回退。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game } from '../js/engine/game.js';
import { serializeRun, deserializeRun, RUN_SAVE_VERSION } from '../js/engine/save.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'config', `${name}.json`), 'utf8'));
const cfg = {};
for (const name of ['attrs', 'inspiration', 'board', 'questions', 'events', 'talents', 'schools', 'affinity', 'npcs', 'sky', 'grades', 'album', 'synergies', 'npc-mechanics', 'talent-upgrade']) {
  try { cfg[name] = load(name); } catch (_) { cfg[name] = (name === 'npc-mechanics' || name === 'talent-upgrade') ? {} : []; }
}
const boardCells = cfg.board.routeCells || (cfg.board.rings || []).flatMap(r => r.cells || []);
cfg.board.routeCells = boardCells;
cfg.board.routeSize = Number(cfg.board.routeSize) || boardCells.length;
cfg.board.ringOfRouteIndex = new Map(boardCells.map(c => [c.routeIndex, c.ring]));
cfg.board.cellById = new Map(boardCells.map(c => [c.id, { ...c }]));
cfg.board.laps = Number(cfg.board.laps) || 1;
cfg.board.ringSize = Number(cfg.board.ringSize) || boardCells.length;
cfg.affinity.themeNames ||= {};
cfg.affinity.mannerNames ||= {};
cfg.affinity.matrix ||= {};
cfg.talentById = new Map((cfg.talents || []).map(t => [t.id, t]));
cfg.talentUpgradeById = new Map(Object.entries(cfg['talent-upgrade'] || {}));

const skyCard = id => cfg.sky.find(c => c.id === id);
const npc = (name = '应势论敌') => ({ id: `test_${name}`, name, fullName: name, attrs: { shi: 5, ci: 5, lian: 5, bi: 5, xue: 5, si: 5 } });

function makeUi(overrides = {}) {
  return {
    floatAttrs() {}, floatInspiration() {}, onState() {}, toast() {}, showDice() {}, movePiece() {},
    highlightCell() {}, showQuizResult() {}, skyExpired() {}, showTalentGain() {},
    showPalaceIntro() {}, async showResult() {}, async askReplaceTalent() { return 0; },
    async askScenic() { return false; }, async showEvent() { return 0; },
    async showQuiz(q) { return { index: q.answer ?? 0, timedOut: false }; },
    async showSky() { return overrides.skyChoice ?? null; },
    async runBattle() { throw new Error('not used'); },
    ...overrides
  };
}

function newGame(school = 'bowen', uiOverrides = {}) {
  const game = new Game(cfg, makeUi(uiOverrides), () => 0);
  game.push = () => {};
  game.grantTalent = async () => false;
  game.applyLoadout = () => {};
  game.start(school, { name: '测试' });
  return game;
}

/** 向对局挂一张处于指定应势状态的天象（替换同卡旧条目）。 */
function attachSky(game, cardId, { choiceId = null, choiceUsed = false, left = 6 } = {}) {
  game.s.sky = (game.s.sky || []).filter(sk => sk.card.id !== cardId);
  const entry = { card: { ...skyCard(cardId) }, left, choiceId, choiceUsed, choiceTriggeredAt: null };
  game.s.sky.push(entry);
  return entry;
}

const charges = g => Number(g.s.abilityState.strategy.charges) || 0;

/* ====================================================== SK05 梅雨愁绪 */
console.log('== SK05 避雨改韵：构思充足时平韵格改按仄韵结算 ==');
{
  const game = newGame();
  attachSky(game, 'SK05', { choiceId: 'change_rhyme' });
  game.ensureAbilityState().strategy.charges = 2;
  game.s.routeIndex = boardCells.findIndex((c, i) => c.type === 'ping' && boardCells[i + 1]);
  const cell = boardCells[game.s.routeIndex];
  const routeAt = game.s.routeIndex;
  const attrBefore = { ...game.s.attrs };
  await game.doPing(cell);
  assert.equal(charges(game), 1, '改韵消耗 1 构思');
  const entry = game.skyEntry('SK05');
  assert.equal(entry.choiceUsed, true, '避雨改韵每窗口仅一次');
  for (const k of ['bi', 'xue', 'si']) assert.ok(game.s.attrs[k] > attrBefore[k], `仄韵结算使 ${k} 增长`);
  assert.equal(game.s.routeIndex, routeAt, '棋子仍停原格（仅结算类型改变）');
}

console.log('== SK05 避雨改韵：构思不足时保持待应势、平韵照常被雨压制 ==');
{
  const game = newGame();
  attachSky(game, 'SK05', { choiceId: 'change_rhyme' });
  game.ensureAbilityState().strategy.charges = 0;
  const cell = { name: '雨中平韵' };
  const attrBefore = { ...game.s.attrs };
  const inspBefore = game.s.inspiration;
  await game.doPing(cell);
  assert.equal(charges(game), 0);
  assert.equal(game.skyEntry('SK05').choiceUsed, false, '构思不足不消耗应势，留待下次');
  assert.deepEqual(game.s.attrs, attrBefore, '未改韵则无仄韵收益');
  assert.equal(game.s.inspiration, inspBefore, '梅雨被动仍压制平韵恢复');
}

console.log('== SK05 雨中磨墨：接受压制换取残页，且每窗口一次 ==');
{
  const game = newGame();
  attachSky(game, 'SK05', { choiceId: 'ink_in_rain' });
  game.s.abilityState.manuscript.fragments = 0;
  const cell = { name: '雨中平韵' };
  const inspBefore = game.s.inspiration;
  await game.doPing(cell);
  assert.equal(game.s.abilityState.manuscript.fragments, 1, '首次雨中平韵获得 1 残页');
  assert.equal(game.s.inspiration, inspBefore, '灵感不恢复（被动保留）');
  assert.equal(game.skyEntry('SK05').choiceUsed, true);
  await game.doPing(cell);
  assert.equal(game.s.abilityState.manuscript.fragments, 1, '第二次雨中平韵不再重复给残页');
}

console.log('== SK05 顺其自然：不应势则梅雨按原被动结算 ==');
{
  const game = newGame();
  attachSky(game, 'SK05', { choiceId: null });
  const cell = { name: '雨中平韵' };
  const inspBefore = game.s.inspiration;
  const fragBefore = game.s.abilityState.manuscript.fragments;
  await game.doPing(cell);
  assert.equal(game.s.inspiration, inspBefore, '平韵灵感仍被压制');
  assert.equal(game.s.abilityState.manuscript.fragments, fragBefore, '不选择就没有残页补偿');
}

/* ====================================================== SK01 月圆之夜 */
console.log('== SK01 借月养思：首次答题成功构思 +1，每窗口一次 ==');
{
  const game = newGame('bowen');
  attachSky(game, 'SK01', { choiceId: 'nourish' });
  game.ensureAbilityState().strategy.charges = 0;
  const cell = { name: '月下考题' };
  await game.doQuiz(cell);
  assert.equal(charges(game), 1, '首次答题成功构思 +1');
  assert.equal(game.skyEntry('SK01').choiceUsed, true, '借月养思每窗口仅一次');
  await game.doQuiz(cell);
  assert.equal(charges(game), 1, '第二次答题成功不再加构思');
}

console.log('== SK01 借月养思：未选择 / 答错不触发 ==');
{
  const game = newGame('bowen', {
    async showQuiz() { return { index: -1, timedOut: true }; } // 超时答错
  });
  attachSky(game, 'SK01', { choiceId: 'nourish' });
  await game.doQuiz({ name: '月下考题' });
  assert.equal(charges(game), 0, '答错不触发借月养思');
  assert.equal(game.skyEntry('SK01').choiceUsed, false, '答错不消耗应势机会');

  const game2 = newGame('bowen');
  attachSky(game2, 'SK01', { choiceId: null });
  await game2.doQuiz({ name: '月下考题' });
  assert.equal(charges(game2), 0, '顺其自然不加构思');
}

console.log('== SK01 趁月趋行：仄韵格结算后可付 1 构思额外前行 1 格 ==');
{
  const game = newGame();
  attachSky(game, 'SK01', { choiceId: 'advance' });
  game.ensureAbilityState().strategy.charges = 2;
  // 找一个「仄韵格且下一格为平韵格、无阶段门」的位置，保证结算路径确定
  const idx = boardCells.findIndex((c, i) =>
    c.type === 'ze' && boardCells[i + 1] && boardCells[i + 1].type === 'ping' && !boardCells[i + 1].phaseGate);
  assert.ok(idx >= 0, '棋盘存在符合条件的仄韵格');
  game.s.routeIndex = idx;
  const attrBefore = { ...game.s.attrs };
  await game.resolveCell();
  assert.equal(game.s.routeIndex, idx + 1, '额外前行 1 格');
  assert.equal(charges(game), 1, '趋行消耗 1 构思');
  assert.equal(game.skyEntry('SK01').choiceUsed, true);
  for (const k of ['bi', 'xue', 'si']) assert.ok(game.s.attrs[k] > attrBefore[k], '原仄韵格照常结算');
}

console.log('== SK01 趁月趋行：构思不足/顺其自然 不额外移动 ==');
{
  const game = newGame();
  attachSky(game, 'SK01', { choiceId: 'advance' });
  game.ensureAbilityState().strategy.charges = 0;
  const idx = boardCells.findIndex((c, i) =>
    c.type === 'ze' && boardCells[i + 1] && boardCells[i + 1].type === 'ping' && !boardCells[i + 1].phaseGate);
  game.s.routeIndex = idx;
  await game.resolveCell();
  assert.equal(game.s.routeIndex, idx, '构思不足不额外移动');
  assert.equal(game.skyEntry('SK01').choiceUsed, false, '保持待应势');

  const game2 = newGame();
  attachSky(game2, 'SK01', { choiceId: null });
  game2.s.routeIndex = idx;
  await game2.resolveCell();
  assert.equal(game2.s.routeIndex, idx, '顺其自然不额外移动');
}

console.log('== doSky 交互：选择写入 choiceId，顺其自然保持未选，重复触发重置窗口 ==');
{
  const game = newGame('bowen', { skyChoice: 'advance' });
  await game.doSky({ name: '天象格' });
  let entry = game.skyEntry('SK01');
  assert.ok(entry, 'rand=0 时抽到首张天象 SK01');
  assert.equal(entry.choiceId, 'advance', '弹窗选择写入 choiceId');
  assert.equal(entry.choiceUsed, false);

  entry.choiceId = 'advance'; entry.choiceUsed = true; // 模拟旧窗口已消耗
  await game.doSky({ name: '天象格' }); // 再次触发 → 新窗口
  entry = game.skyEntry('SK01');
  assert.equal(entry.choiceUsed, false, '重新触发重置应势窗口');
  assert.equal(entry.choiceId, 'advance', '同一天象格再次弹窗并重新选择');

  const game2 = newGame('bowen', { skyChoice: null });
  await game2.doSky({ name: '天象格' });
  assert.equal(game2.skyEntry('SK01').choiceId, null, '顺其自然 → choiceId 为空');
}

/* ====================================================== SK03 科场风起 */
console.log('== SK03 迎风入场：论战开始时消耗 1 构思，得分 +8% ==');
{
  const mk = () => {
    const game = newGame('bowen');
    game.s.attrs = { shi: 30, ci: 20, lian: 15, bi: 8, xue: 8, si: 8 };
    return game;
  };
  const withAtk = mk();
  attachSky(withAtk, 'SK03', { choiceId: 'attack' });
  withAtk.ensureAbilityState().strategy.charges = 2;
  const sessionA = withAtk.createSession({ npc: npc(), label: '迎风' });
  const outA = withAtk.resolveBattle(sessionA, 'shi', 'zheli', [3]);
  assert.equal(charges(withAtk), 1, '迎风入场消耗 1 构思');
  assert.equal(withAtk.skyEntry('SK03').choiceUsed, true);

  const baseline = mk();
  attachSky(baseline, 'SK03', { choiceId: null });
  baseline.ensureAbilityState().strategy.charges = 2;
  const sessionB = baseline.createSession({ npc: npc(), label: '基线' });
  const outB = baseline.resolveBattle(sessionB, 'shi', 'zheli', [3]);
  assert.ok(outA.selfCalc.total > outB.selfCalc.total, '应势后得分严格高于基线');

  const poor = mk();
  attachSky(poor, 'SK03', { choiceId: 'attack' });
  poor.ensureAbilityState().strategy.charges = 0;
  const sessionC = poor.createSession({ npc: npc(), label: '无构思' });
  const outC = poor.resolveBattle(sessionC, 'shi', 'zheli', [3]);
  assert.equal(charges(poor), 0);
  assert.equal(poor.skyEntry('SK03').choiceUsed, false, '构思不足保持待应势');
  assert.equal(outC.selfCalc.total, outB.selfCalc.total, '未发动时得分与基线一致');
}

console.log('== SK03 避风收笔：放弃奖惩翻倍，首次败北少损 2 灵感 ==');
{
  const game = newGame('bowen');
  attachSky(game, 'SK03', { choiceId: 'guard' });
  assert.equal(game.skyActive('battle_reward_mult'), null, '选择避风后奖惩翻倍失效');
  const st = game.ensureAbilityState().strategy;
  st.charges = 3;
  st.plan = 'steady'; st.nextPlan = 'steady'; // 隔离「留白养气」自动减损，单独验证天象应势
  game.s.lap = 2;                             // 后期败北基础损失 -3，减损后余 -1 可辨
  game.s.inspiration = 40;
  const lossOut = { result: 'lose', style: 'shi', manner: 'zheli', npcStyle: 'ci', npcDice: 2, dicePips: [4], upset: false };
  await game.settleBattle(game.createSession({ npc: npc('守势一'), label: '守势一' }), lossOut);
  const d1 = 40 - game.s.inspiration;
  assert.equal(d1, 1, '首次败北：基础 -3 经避风收笔仅损 1');
  assert.equal(game.skyEntry('SK03').choiceUsed, true, '首次败北即兑现避风收笔');
  await game.settleBattle(game.createSession({ npc: npc('守势二'), label: '守势二' }), lossOut);
  const secondLoss = (40 - d1) - game.s.inspiration;
  assert.equal(secondLoss, 3, '第二次败北恢复基础损失');
  assert.equal(secondLoss - d1, 2, '两次败北差额恰为避风收笔省下的 2 点');
}
{
  const game = newGame('bowen');
  attachSky(game, 'SK03', { choiceId: 'attack' });
  assert.notEqual(game.skyActive('battle_reward_mult'), null, '选择迎风时奖惩翻倍保留');
}

/* ====================================================== 存档 */
console.log('== 存档：应势字段 roundtrip ==');
{
  const game = newGame();
  attachSky(game, 'SK05', { choiceId: 'change_rhyme' });
  game.skyEntry('SK05').choiceUsed = true;
  game.skyEntry('SK05').choiceTriggeredAt = 7;
  attachSky(game, 'SK01', { choiceId: 'advance', choiceUsed: false });
  const blob = serializeRun(game);
  assert.equal(blob.v, RUN_SAVE_VERSION, '新存档版本号');
  const skyById = Object.fromEntries(blob.state.sky.map(sk => [sk.id, sk]));
  assert.equal(skyById.SK05.choiceId, 'change_rhyme');
  assert.equal(skyById.SK05.choiceUsed, true);
  assert.equal(skyById.SK05.choiceTriggeredAt, 7);
  assert.equal(skyById.SK01.choiceUsed, false);

  const restored = deserializeRun(blob, cfg);
  assert.equal(restored.ok, true);
  const r05 = restored.state.sky.find(sk => sk.card.id === 'SK05');
  const r01 = restored.state.sky.find(sk => sk.card.id === 'SK01');
  assert.equal(r05.choiceId, 'change_rhyme', '读档保留应势选择');
  assert.equal(r05.choiceUsed, true, '读档保留已兑现状态（不重复获得）');
  assert.equal(r01.choiceId, 'advance');
  assert.equal(r01.choiceUsed, false);
}

console.log('== 存档：v8 旧档（无应势字段）与非法 choiceId 回退 ==');
{
  const game = newGame();
  attachSky(game, 'SK05', { choiceId: 'change_rhyme' });
  const blob = serializeRun(game);
  // 构造 v8 旧档：应势字段剥掉、版本回写 8
  const oldBlob = JSON.parse(JSON.stringify(blob));
  oldBlob.v = 8;
  oldBlob.state.sky = oldBlob.state.sky.map(({ id, left }) => ({ id, left }));
  const restored = deserializeRun(oldBlob, cfg);
  assert.equal(restored.ok, true, 'v8 旧档可正常读入');
  const r05 = restored.state.sky.find(sk => sk.card.id === 'SK05');
  assert.equal(r05.choiceId, null, '旧档无应势字段 → 视为顺其自然');
  assert.equal(r05.choiceUsed, false);

  // 非法 choiceId（配置里不存在）→ 回退为未选择
  const badBlob = JSON.parse(JSON.stringify(blob));
  badBlob.state.sky = badBlob.state.sky.map(sk => sk.id === 'SK05' ? { ...sk, choiceId: 'bogus' } : sk);
  const restored2 = deserializeRun(badBlob, cfg);
  const b05 = restored2.state.sky.find(sk => sk.card.id === 'SK05');
  assert.equal(b05.choiceId, null, '非法 choiceId 回退为未选择');
  assert.equal(b05.choiceUsed, false);
}

console.log('sky-strategy.test.mjs: all assertions passed');
