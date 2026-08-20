#!/usr/bin/env node
// 方案 B 无信息约束：静态边界 + 运行时代理双重校验。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game } from '../js/engine/game.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(ROOT, 'js/engine/game.js'), 'utf8');
const abilityCore = source.slice(source.indexOf('/* -------------------------------------------------- 方案 B：三功系统 */'), source.indexOf('/* ---------------------------------------------------------- 开局 */'));
const growthCore = source.slice(source.indexOf('/** 方案 B：战斗完成后的熟练'), source.indexOf('/** 应用战斗奖惩'));
const forbidden = ['correctIndex', 'answerIndex', 'hiddenTag', 'futureDice', 'futureStyle', 'winRate', 'randomPool', 'intentLocked', 'expectedScore('];
for (const token of forbidden) {
  assert.equal(abilityCore.includes(token), false, `三功核心不得读取 ${token}`);
  assert.equal(growthCore.includes(token), false, `成长结算不得读取 ${token}`);
}

const CFG_DIR = path.join(ROOT, 'config');
const load = name => JSON.parse(fs.readFileSync(path.join(CFG_DIR, `${name}.json`), 'utf8'));
const cfg = {};
for (const name of ['attrs', 'inspiration', 'board', 'questions', 'events', 'talents', 'schools', 'affinity', 'npcs', 'sky', 'grades', 'album', 'synergies', 'npc-mechanics', 'talent-upgrade']) {
  try { cfg[name] = load(name); } catch (_) { cfg[name] = (name === 'npc-mechanics' || name === 'talent-upgrade') ? {} : []; }
}
cfg.board.cellById = new Map((cfg.board.mainRing || []).map(c => [c.id, { ...c, ring: 'main' }]));
cfg.board.laps = Number(cfg.board.laps) || 2;
cfg.board.ringSize = cfg.board.mainRing.length;
cfg.affinity.themeNames ||= {};
cfg.affinity.mannerNames ||= {};
cfg.affinity.matrix ||= {};
cfg.talentById = new Map((cfg.talents || []).map(t => [t.id, t]));
cfg.talentUpgradeById = new Map(Object.entries(cfg['talent-upgrade'] || {}));

const ui = { onState() {}, floatAttrs() {}, floatInspiration() {}, toast() {} };
const game = new Game(cfg, ui, () => 0);
game.push = () => {};
game.grantTalent = async () => false;
game.applyLoadout = () => {};
game.start('bowen', { name: '' });
game.rand = () => { throw new Error('三功成长不应调用随机数'); };

const denied = new Set(['npc', 'npcAttrs', 'intentLocked', 'answer', 'correctIndex', 'futureDice', 'futureStyle', 'randomPool']);
const guard = data => new Proxy(data, {
  get(target, prop, receiver) {
    if (denied.has(String(prop))) throw new Error(`越界读取：${String(prop)}`);
    return Reflect.get(target, prop, receiver);
  }
});

const session = guard({ passiveTalents: [], usedPolish: false });
const out = guard({ result: 'lose', style: 'ci', dicePips: [2], upset: false });
assert.doesNotThrow(() => game.applyAbilityBattleGrowth(session, out), '成长只读取已选文体、已掷骰面与已发生结果');
assert.equal(game.s.abilityState.familiarity.ci, 1);
assert.equal(game.s.abilityState.insight, 3);

console.log('无信息约束：静态边界与运行时代理全部通过 ✓');
