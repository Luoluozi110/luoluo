#!/usr/bin/env node
// 文心升级系统 · 结构 + 引擎单测
// 校验：talent-upgrade.json 完整性；grantTalent 落 Lv1 生效副本；upgradeTalent 扣灵感/缩放效果/
// 一次性差值；存档 serialize→deserialize 等级与生效副本还原。
import fs from 'fs';
import path from 'path';
import { Game } from '../js/engine/game.js';
import { applyProjectOverride } from '../js/engine/config.js';
import { serializeRun, deserializeRun, RUN_SAVE_VERSION } from '../js/engine/save.js';

const CFG_DIR = path.join(process.cwd(), 'config');
function load(n) {
  try { return JSON.parse(fs.readFileSync(path.join(CFG_DIR, n + '.json'), 'utf8')); }
  catch (e) { return n === 'talent-upgrade' ? {} : []; }
}
function buildCfg() {
  const cfg = {};
  for (const n of ['attrs', 'inspiration', 'board', 'questions', 'events', 'talents', 'schools', 'affinity', 'npcs', 'sky', 'grades', 'album', 'talent-upgrade']) {
    cfg[n] = load(n);
  }
  const board = cfg.board;
  const byId = new Map();
  for (const c of board.mainRing) byId.set(c.id, { ...c, ring: 'main' });
  board.cellById = byId; board.laps = Number(board.laps) || 2; board.ringSize = board.mainRing.length;
  cfg.questions = (cfg.questions || []).filter(q => q.enabled !== false);
  cfg.events = (cfg.events || []).filter(e => e.enabled !== false);
  const af = cfg.affinity; af.themeNames = af.themeNames || {}; af.mannerNames = af.mannerNames || {}; af.matrix = af.matrix || {};
  cfg.talentById = new Map((cfg.talents || []).map(t => [t.id, t]));
  cfg.talentUpgradeById = new Map(Object.entries(cfg['talent-upgrade'] || {}));
  return cfg;
}
function makeUI() {
  return {
    floatAttrs() {}, floatInspiration() {}, onState() {}, showDice() {}, movePiece() {}, toast() {},
    highlightCell() {}, showQuizResult() {}, showSky() {}, skyExpired() {},
    showTalentGain() {}, showPalaceIntro() {}, async showResult() {},
    async askReplaceTalent() { return 0; },
    async askScenic() { return false; },
    async showQuiz() { return { index: 0, timedOut: false }; },
    async showEvent() { return 0; },
    async runBattle() { return { win: true, score: 1, oppScore: 0 }; }
  };
}
const rng = (() => { let s = 12345; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();
const assert = (c, m) => { if (!c) { console.error('  ✗ ' + m); process.exitCode = 1; throw new Error(m); } else console.log('  ✓ ' + m); };
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let pass = 0;
function ok(m) { pass++; console.log('  ✓ ' + m); }

console.log('== 结构校验：talent-upgrade.json ==');
const cfg = buildCfg();
const up = cfg['talent-upgrade'] || {};
const UPCOST = { common: [6, 10], rare: [7, 11, 16], epic: [8, 12, 17, 23], legend: [9, 13, 18, 24, 31] };
assert(Object.keys(up).length === cfg.talents.length, `升级表覆盖全部 ${cfg.talents.length} 枚文心（实际 ${Object.keys(up).length}）`);
for (const t of cfg.talents) {
  const u = up[t.id];
  assert(u, `${t.id} 有升级数据`);
  assert(u.levels.length === u.maxLevel, `${t.id} levels 长度=maxLevel(${u.maxLevel})`);
  assert(deepEq(u.upCost, UPCOST[u.quality].slice(0, u.maxLevel - 1)), `${t.id} upCost 与${u.quality}曲线一致`);
  assert(u.levels[0].effect != null, `${t.id} Lv1 含 effect`);
  if (t.kind === 'active') assert(u.levels[0].cost != null, `${t.id} 主动含 cost`);
}

console.log('\n== 云端工程：talents 与 talent-upgrade 同步覆盖 ==');
const cloudUpgrade = JSON.parse(JSON.stringify(up));
cloudUpgrade.TA03.levels[0].cost = 77;
const cloudCfg = applyProjectOverride(cfg, { talents: cfg.talents, 'talent-upgrade': cloudUpgrade });
assert(cloudCfg.talentUpgradeById.get('TA03').levels[0].cost === 77, '工程内 talent-upgrade 覆盖并重建 talentUpgradeById');
assert(cloudCfg.talentById.size === cfg.talentById.size, '同步覆盖后文心目录完整');

console.log('\n== 引擎：grantTalent 落 Lv1 生效副本 ==');
const game = new Game(cfg, makeUI(), rng);
game.start('cizong_bi', { name: '测' }); // 三派之一；初始文心 T006（bi），与下文 T004 无关，避免重复授予
game.s.inspiration = 60; game.s.inspirationMax = 60;
// 选 attr_flat 文心 T004（学力 +2@Lv1 → +4@Lv3）
const T004 = cfg.talentById.get('T004');
const xueBefore = game.s.attrs.xue;
game.grantTalent(T004, { silent: true });
assert(game.s.talentLevels.T004 === 1, 'T004 等级=1');
const held004 = game.s.passive.find(t => t.id === 'T004');
assert(held004 && held004.effect.attrs.xue === 2, 'T004 持有副本 Lv1 学力+2');
assert(game.s.attrs.xue === xueBefore + 2, 'T004 落地后学力+2（attr_flat 常驻）');

console.log('\n== 引擎：upgradeTalent 扣灵感 + 缩放 + 一次性差值 ==');
const cost0 = up.T004.upCost[0];
const inspBefore = game.s.inspiration;
const r1 = game.upgradeTalent('T004');
assert(r1.ok && r1.level === 2, 'T004 升级至 Lv2 成功');
assert(game.s.inspiration === inspBefore - cost0, `灵感扣减 ${cost0}`);
assert(held004.effect.attrs.xue === 3, 'T004 Lv2 学力+3');
assert(game.s.attrs.xue === xueBefore + 3, '学力净 +3（差值结算，未重复 +2）');
// 再升到 Lv3（满级）
const r2 = game.upgradeTalent('T004');
assert(r2.ok && r2.level === 3, 'T004 升级至 Lv3（满级）');
assert(held004.effect.attrs.xue === 4, 'T004 Lv3 学力+4');
const r3 = game.upgradeTalent('T004');
assert(!r3.ok && r3.reason === '已满级', '满级后再升级被拒');

console.log('\n== 引擎：灵感不足被拒 ==');
const T016 = cfg.talentById.get('T016'); // extra_dice_pct 史诗 max5，首级成本 8
game.grantTalent(T016, { silent: true });
game.s.inspiration = 3; // 不足 8
const r4 = game.upgradeTalent('T016');
assert(!r4.ok && r4.reason === '灵感不足', '灵感不足时升级被拒');
assert(game.s.talentLevels.T016 === 1, '灵感不足不扣等级');

console.log('\n== 引擎：insp_max 扩容差值 ==');
const T032 = cfg.talentById.get('T032'); // insp_max 史诗，首级 +4
game.grantTalent(T032, { silent: true });
const max0 = game.s.inspirationMax;
game.s.inspiration = 60;
const r5 = game.upgradeTalent('T032');
assert(r5.ok, 'T032 升级成功');
assert(game.s.inspirationMax === max0 + (up.T032.levels[1].effect.value - up.T032.levels[0].effect.value), '灵感上限按差值扩容（+' + (game.s.inspirationMax - max0) + '）');

console.log('\n== 存档：serialize→deserialize 还原等级与生效副本 ==');
game.s.inspiration = 50;
const blob = serializeRun(game);
assert(blob.v === RUN_SAVE_VERSION, `存档版本=${RUN_SAVE_VERSION}`);
const de = deserializeRun(blob, cfg);
assert(de.ok, '反序列化成功');
assert(de.state.talentLevels.T004 === 3, '读档后 T004 仍为 Lv3');
const held004b = de.state.passive.find(t => t.id === 'T004');
assert(held004b && held004b.effect.attrs.xue === 4, '读档后 T004 生效副本=学力+4（Lv3）');
assert(de.state.attrs.xue === xueBefore + 4, '读档后学力累计值正确');

console.log(`\n全部升级单测通过 ✓（RUN_SAVE_VERSION=${RUN_SAVE_VERSION}）`);
