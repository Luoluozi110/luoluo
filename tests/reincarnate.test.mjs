#!/usr/bin/env node
// 传说文心「照我传灯」跨局传承回归测试（Node 无头）
// 校验：配置结构（传说/Lv6/逐级门槛递减·比例递增）；殿试结算点亮传承；
//       下一局开局消费传承、继承 80%~100% 属性且一次性清除；灵感不足不点亮。
import fs from 'fs';
import path from 'path';
import { Game, Reincarnate } from '../js/engine/game.js';

const CFG_DIR = path.join(process.cwd(), 'config');
function load(n) { try { return JSON.parse(fs.readFileSync(path.join(CFG_DIR, n + '.json'), 'utf8')); } catch (e) { return n === 'talent-upgrade' ? {} : []; } }
function buildCfg() {
  const cfg = {};
  for (const n of ['attrs', 'inspiration', 'board', 'questions', 'events', 'talents', 'schools', 'affinity', 'npcs', 'sky', 'grades', 'album', 'talent-upgrade']) cfg[n] = load(n);
  const board = cfg.board; const byId = new Map();
  for (const c of board.mainRing) byId.set(c.id, { ...c, ring: 'main' });
  board.cellById = byId; board.laps = Number(board.laps) || 2; board.ringSize = board.mainRing.length;
  cfg.questions = (cfg.questions || []).filter(q => q.enabled !== false);
  cfg.events = (cfg.events || []).filter(e => e.enabled !== false);
  const af = cfg.affinity; af.themeNames = af.themeNames || {}; af.mannerNames = af.mannerNames || {}; af.matrix = af.matrix || {};
  cfg.talentById = new Map((cfg.talents || []).map(t => [t.id, t]));
  cfg.talentUpgradeById = new Map(Object.entries(cfg['talent-upgrade'] || {}));
  return cfg;
}
function makeUI(toasts) {
  toasts = toasts || [];
  return {
    floatAttrs() {}, floatInspiration() {}, onState() {}, showDice() {}, movePiece() {}, toast(m) { toasts.push(m); }, highlightCell() {}, showQuizResult() {}, showSky() {}, skyExpired() {}, showTalentGain() {}, showPalaceIntro() {}, async showResult() {}, async askReplaceTalent() { return 0; }, async askScenic() { return false; }, async showQuiz() { return { index: 0, timedOut: false }; }, async showEvent() { return 0; }, async runBattle() { return { win: true, score: 1, oppScore: 0 } }
  };
}
const rng = (() => { let s = 7; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();
let fail = 0;
const ok = (c, m) => { if (c) console.log('  ✓ ' + m); else { console.error('  ✗ ' + m); fail++; } };

const cfg = buildCfg();
const T034 = cfg.talentById.get('T034');
// 三派（博闻 bowen/xue、奇士 qishi/si、辞宗 cizong_bi/bi）：attr 均不含 shi，
// 用它们做跨局继承断言不会被「流派入门加成」污染 shi/诗力。
const S_BOWEN = 'bowen';  // attr=xue
const S_QISHI = 'qishi';  // attr=si
const schoolBonus = cfg.attrs.schoolBonus ?? 3;
Reincarnate.reset();

console.log('== 结构：T034 传说 / Lv6 / 逐级门槛递减·比例递增 ==');
ok(!!T034, 'T034 存在于 talents.json');
ok(T034 && T034.kind === 'passive' && !T034.school, 'T034 为被动且无流派限制');
ok(T034 && T034.effect.type === 'reincarnate', 'T034 效果类型为 reincarnate');
const up = cfg['talent-upgrade'].T034;
ok(up && up.quality === 'legend' && up.maxLevel === 6, 'T034 升级：传说 / 满级 6');
ok(up && up.levels.length === 6, 'T034 升级：6 级逐级效果');
const ths = up.levels.map(l => l.effect.inspThreshold);
const ras = up.levels.map(l => l.effect.attrRatio);
ok(JSON.stringify(ths) === JSON.stringify([40, 36, 32, 28, 24, 20]), '门槛随等级递减 40→20：' + ths.join(','));
ok(JSON.stringify(ras) === JSON.stringify([0.8, 0.84, 0.88, 0.92, 0.96, 1.0]), '比例随等级递增 0.8→1.0：' + ras.join(','));
ok(up.levels[0].effect.inspThreshold === T034.effect.inspThreshold, 'Lv1 升级效果与 talents.json 基础一致（消除覆盖陷阱）');

console.log('\n== 点亮：殿试结算且余灵达标 → 记录传承 ==');
const g1 = new Game(cfg, makeUI(), rng);
g1.start(S_BOWEN, { name: '甲' });
g1.grantTalent(T034, { silent: true });
const held1 = g1.s.passive.find(t => t.id === 'T034');
ok(held1 && held1.effect.type === 'reincarnate' && held1.effect.inspThreshold === 40, '持有 T034（Lv1，门槛 40 / 比例 0.8）');
g1.s.attrs = { shi: 50, ci: 40, lian: 30, bi: 20, xue: 60, si: 10 };
g1.s.inspiration = 45; // ≥ 40 门槛
g1._maybePendReincarnate();
const pend1 = Reincarnate.peek();
ok(pend1 && pend1.talentId === 'T034', '殿试结算点亮传承火种');
ok(pend1 && pend1.attrs.shi === 40 && pend1.attrs.xue === 48, '继承属性 = floor(本局 × 0.8)：诗 50→40、学 60→48');
ok(Math.round(pend1.ratio * 100) === 80, '记录比例 80%');

console.log('\n== 消费：下一局开局继承并一次性清除 ==');
const baseShi = cfg.attrs.initial.shi;          // bowen 流派加成落在 xue，不污染 shi 断言
const g2 = new Game(cfg, makeUI(), rng);
g2.start(S_BOWEN, { name: '乙' }); // 不同流派（xue），验证无视流派加成叠加到 shi
const inheritGained = g2.s.attrs.shi - baseShi;
ok(inheritGained === 40, '开局继承：诗力 +40（来自上局 50×0.8，无视新流派）');
ok(g2.s.attrs.bi === cfg.attrs.initial.bi + 16, '开局继承：笔力 +16（本局基础 5 + 传承 16，bi 非流派属性）');
ok(Reincarnate.peek() === null, '传承消费后已清除（一次性）');
// 再开一局（换 qishi/si）不应重复继承——si 仅吃到流派入门加成，无继承带来的 shi
const g3 = new Game(cfg, makeUI(), rng);
g3.start(S_QISHI, { name: '丙' });
const baseSi3 = cfg.attrs.initial.si;
ok(g3.s.attrs.si === baseSi3 + schoolBonus && g3.s.attrs.shi === cfg.attrs.initial.shi,
  '第三局不再继承（火种已耗尽，si 仅基础+流派加成，诗力无继承）');

console.log('\n== 门槛：余灵不足不点亮 ==');
Reincarnate.reset();
const g4 = new Game(cfg, makeUI(), rng);
g4.start(S_BOWEN, { name: '丁' });
g4.grantTalent(T034, { silent: true });
g4.s.attrs = { shi: 50, ci: 40, lian: 30, bi: 20, xue: 60, si: 10 };
g4.s.inspiration = 30; // < 40 门槛
g4._maybePendReincarnate();
ok(Reincarnate.peek() === null, '余灵 30 < 门槛 40 → 不点亮传承');

console.log('\n== 满级：Lv6 门槛 20 / 比例 100% ==');
Reincarnate.reset();
const g5 = new Game(cfg, makeUI(), rng);
g5.start(S_BOWEN, { name: '戊' });
g5.s.inspirationMax = 200; // 放宽上限，模拟玩家逐次升级（单次升级成本 ≤31 远低于上限）
g5.s.inspiration = 200;
g5.grantTalent(T034, { silent: true });
for (let i = 0; i < 5; i++) g5.upgradeTalent('T034');
const held5 = g5.s.passive.find(t => t.id === 'T034');
ok(g5.s.talentLevels.T034 === 6, 'T034 升至 Lv6');
ok(held5.effect.inspThreshold === 20 && Math.abs(held5.effect.attrRatio - 1) < 1e-9, 'Lv6 门槛 20 / 比例 100%');
g5.s.attrs = { shi: 50, ci: 40, lian: 30, bi: 20, xue: 60, si: 10 };
g5.s.inspiration = 25; // ≥ 20 门槛
g5._maybePendReincarnate();
const pend5 = Reincarnate.peek();
ok(pend5 && pend5.attrs.shi === 50 && pend5.attrs.xue === 60, 'Lv6 继承 100%：诗 50→50、学 60→60');

console.log('\n== 图鉴同步：modals.talentEffectText 须正确渲染 reincarnate ==');
// 图鉴阁「文心」分页与文心详情/获得/升级弹窗共用同一渲染函数；缺 case 会回退占位文案。
let talentEffectText;
try { ({ talentEffectText } = await import('../js/ui/modals.js')); } catch (e) { talentEffectText = null; }
ok(!!talentEffectText, 'modals.js 可导入（含 talentEffectText）');
if (talentEffectText) {
  const baseTxt = talentEffectText(T034);
  ok(/剩余灵感 ≥ 40/.test(baseTxt) && /继承本局属性的 80%/.test(baseTxt),
    'Lv1 图鉴文案：殿试结算若剩余灵感 ≥ 40，下一局继承本局属性的 80%');
  const lv6Txt = talentEffectText({ effect: { type: 'reincarnate', inspThreshold: 20, attrRatio: 1 } });
  ok(/剩余灵感 ≥ 20/.test(lv6Txt) && /继承本局属性的 100%/.test(lv6Txt),
    'Lv6 图鉴文案：剩余灵感 ≥ 20，继承 100%');
  const def = talentEffectText({ effect: { type: 'reincarnate' } });
  ok(!/效果由配置定义/.test(def), 'reincarnate 不回退到占位文案「效果由配置定义」');
}

console.log(`\n照我传灯·跨局传承测试：${fail === 0 ? '全部通过 ✓' : fail + ' 项失败 ✗'}`);
process.exit(fail ? 1 : 0);
