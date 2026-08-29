#!/usr/bin/env node
// 名胜格文心三选一：候选数量/去重、选择保留、取消与异常回退。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game } from '../js/engine/game.js';
import { serializeRun, deserializeRun } from '../js/engine/save.js';

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

const cell = { name: '测试名胜' };
const makeUi = ({ go = true, pick = 0, choose = true } = {}) => {
  const seen = { candidates: null, granted: [], toasts: [] };
  return {
    seen,
    floatAttrs() {}, floatInspiration() {}, onState() {}, toast(t) { seen.toasts.push(String(t)); },
    showTalentGain() {}, async askScenic() { return go; },
    async chooseScenicTalent(cards) {
      seen.candidates = cards.slice();
      if (!choose) throw new Error('模拟取消');
      return pick;
    },
    async askReplaceTalent() { return -1; }
  };
};
const gameFor = ui => {
  const game = new Game(cfg, ui, () => 0);
  game.start('cizong_bi', { name: '测试' });
  game.s.inspiration = 30;
  game.s.inspirationMax = 60;
  game.s.passive = [];
  game.s.active = [];
  game.s.talentLevels = {};
  game.s.events.talents = 0;
  return game;
};

console.log('== 名胜格：三张候选、去重、选择保留 ==');
{
  const ui = makeUi({ pick: 1 });
  const game = gameFor(ui);
  const before = game.s.inspiration;
  await game.doScenic(cell);
  assert.equal(ui.seen.candidates.length, 3, '每次名胜格生成三张候选');
  assert.equal(new Set(ui.seen.candidates.map(t => t.id)).size, 3, '三张候选文心 ID 不重复');
  assert.equal(game.s.inspiration, before - Number(cfg.inspiration.scenicCost ?? 8), '确认选择后才扣除名胜格成本');
  assert.deepEqual([...game.s.passive, ...game.s.active].map(t => t.id), [ui.seen.candidates[1].id], '最终只保留玩家选择的文心');
  assert.equal(game.s.events.talents, 1, '选择成功只计入一枚文心收入');
  assert.equal(ui.seen.candidates.some(t => [...game.s.passive, ...game.s.active].some(h => h.id === t.id)), true, '选中文心进入持有状态');
  const restored = deserializeRun(serializeRun(game), cfg);
  assert.equal(restored.ok, true, '三选一结果可正常序列化并读档');
  assert.deepEqual([...restored.state.passive, ...restored.state.active].map(t => t.id), [ui.seen.candidates[1].id], '读档后仍只保留已选文心');
}

console.log('== 名胜格：取消/异常不扣费、不授予 ==');
for (const mode of ['cancel', 'throw', 'out-of-range']) {
  const ui = mode === 'throw' ? makeUi({ choose: false }) : makeUi({ pick: mode === 'out-of-range' ? 99 : -1 });
  const game = gameFor(ui);
  const before = game.s.inspiration;
  await game.doScenic(cell);
  assert.equal(game.s.inspiration, before, `${mode} 时灵感不扣除`);
  assert.equal(game.s.passive.length + game.s.active.length, 0, `${mode} 时没有文心进入持有状态`);
}

console.log('== 名胜格：候选不足时按实际数量降级 ==');
{
  const ui = makeUi({ pick: 0 });
  const game = gameFor(ui);
  const original = game.randomTalent.bind(game);
  let calls = 0;
  game.randomTalent = (...args) => {
    calls++;
    return calls === 1 ? original(...args) : null;
  };
  await game.doScenic(cell);
  assert.equal(ui.seen.candidates.length, 1, '候选池不足时返回实际可抽数量');
  assert.equal(game.s.passive.length + game.s.active.length, 1, '不足时仍可选择唯一候选');
}

console.log('scenic-talent-pick.test.mjs: all assertions passed');
