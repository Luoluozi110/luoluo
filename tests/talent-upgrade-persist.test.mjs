#!/usr/bin/env node
// 文心升级「存档绑定 / 重载不回退」回归测试（Node 无头，mock localStorage）
// 关键：模拟真实流程——先落一次存档点（升级前 Lv1），再升级，再「重新读取存档」，
// 断言读出的进度是升级后状态（Lv2 + 对应效果）。若无立即落盘修复，升级后重载会回退到 Lv1。
import fs from 'fs';
import path from 'path';
import { Game } from '../js/engine/game.js';
import { saveRun, loadRun, loadBestRun, serializeRun, deserializeRun, RUN_SAVE_KEY, RUN_SAVE_MANUAL_KEY, RUN_SAVE_VERSION } from '../js/engine/save.js';

// ---- mock Web Storage（须在调用 saveRun 前就绪）----
function makeStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() };
}
globalThis.localStorage = makeStorage();
globalThis.sessionStorage = makeStorage();

const CFG_DIR = path.join(process.cwd(), 'config');
function load(n) { try { return JSON.parse(fs.readFileSync(path.join(CFG_DIR, n + '.json'), 'utf8')); } catch { return n === 'talent-upgrade' ? {} : []; } }
function buildCfg() {
  const cfg = {};
  for (const n of ['attrs', 'inspiration', 'board', 'questions', 'events', 'talents', 'schools', 'affinity', 'npcs', 'sky', 'grades', 'album', 'talent-upgrade'])
    cfg[n] = load(n);
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
function makeUI() {
  return { floatAttrs() {}, floatInspiration() {}, onState() {}, showDice() {}, movePiece() {}, toast() {}, highlightCell() {}, showQuizResult() {}, showSky() {}, skyExpired() {}, showTalentGain() {}, showPalaceIntro() {}, async showResult() {}, async askReplaceTalent() { return 0; }, async askScenic() { return false; }, async showQuiz() { return { index: 0, timedOut: false }; }, async showEvent() { return 0; }, async runBattle() { return { win: true, score: 1, oppScore: 0 } } };
}
const rng = (() => { let s = 99; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();
let fail = 0;
const ok = (c, m) => { if (c) console.log('  ✓ ' + m); else { console.error('  ✗ ' + m); fail++; } };

const cfg = buildCfg();
console.log('== 升级立即落盘：自动槽重载 ==');
const g = new Game(cfg, makeUI(), rng);
g.start('shixian', { name: '测' });
g.s.inspiration = 60; g.s.inspirationMax = 60;
// 挂接存档回调（镜像 app.js：onSavePoint=自动槽；onForceSave=自动+手动）
g.onSavePoint = () => saveRun(g, RUN_SAVE_KEY);
g.onForceSave = () => { saveRun(g, RUN_SAVE_KEY); const m = loadRun(RUN_SAVE_MANUAL_KEY); if (m && !m.__corrupt && m.state && !m.state.over) saveRun(g, RUN_SAVE_MANUAL_KEY); };

const T004 = cfg.talentById.get('T004'); // attr_flat 学力 +2@Lv1 → +3@Lv2
g.grantTalent(T004, { silent: true });
ok(g.s.talentLevels.T004 === 1, 'T004 初始 Lv1');

// 模拟「升级前先经过一次自动存档点」→ 此时存档是 Lv1
g.onSavePoint();
const preBlob = loadRun(RUN_SAVE_KEY);
ok(preBlob && preBlob.state.talentLevels.T004 === 1, '升级前自动存档 = Lv1（基线）');

// 升级（应触发 onForceSave → 立即落盘为 Lv2）
const r = g.upgradeTalent('T004');
ok(r.ok && r.level === 2, 'T004 升级至 Lv2');

// 「重新读取存档」（继续上局逻辑）
const best = loadBestRun();
const de = deserializeRun(best.obj, cfg);
ok(de.ok, '读档成功');
ok(de.state.talentLevels.T004 === 2, '重载后 T004 = Lv2（升级已持久化）');
const held = de.state.passive.find(t => t.id === 'T004');
ok(held && held.effect.attrs.xue === 4, '重载后生效副本 = 学力+4（Lv2 效果保留）');
ok(de.state.attrs.xue === (g.s.attrs.xue), '重载后学力累计值与升级后一致');

console.log('== 升级立即落盘：手动槽同步（含跨局继承基线）==');
const g2 = new Game(cfg, makeUI(), rng);
g2.start('shixian', { name: '测' });
g2.s.inspiration = 999; g2.s.inspirationMax = 999;
g2.onSavePoint = () => saveRun(g2, RUN_SAVE_KEY);
g2.onForceSave = () => { saveRun(g2, RUN_SAVE_KEY); const m = loadRun(RUN_SAVE_MANUAL_KEY); if (m && !m.__corrupt && m.state && !m.state.over) saveRun(g2, RUN_SAVE_MANUAL_KEY); };
g2.grantTalent(T004, { silent: true });
// 继承上局 T004 的 Lv2（跨局保持），手动槽基线即 Lv2
saveRun(g2, RUN_SAVE_MANUAL_KEY);
ok(loadRun(RUN_SAVE_MANUAL_KEY).state.talentLevels.T004 === 2, '手动槽基线 = 继承 Lv2');
// 再升级 → 应同步手动槽
const r2 = g2.upgradeTalent('T004');
ok(r2.ok && r2.level === 3, 'T004 从继承 Lv2 升级至 Lv3');
const best2 = loadBestRun(); // 优先手动槽
const de2 = deserializeRun(best2.obj, cfg);
ok(de2.state.talentLevels.T004 === 3, '继续上局（手动槽优先）重载后 = Lv3（手动槽已同步升级）');

console.log('== 跨场会话快照：本场锁定、下一场更新、重载后继续更新 ==');
const g3 = new Game(cfg, makeUI(), rng);
g3.start('shixian', { name: '测' });
g3.s.inspiration = 99; g3.s.inspirationMax = 99;
const TA03 = cfg.talentById.get('TA03');
await g3.grantTalent(TA03, { silent: true });
const lv1Value = cfg.talentUpgradeById.get('TA03').levels[0].effect.value;
const beforeSession = g3.createSession({ npc: g3.pickNpc(false), label: '升级前会话' });
ok(beforeSession.activeTalents.find(t => t.id === 'TA03').effect.value === lv1Value, '升级前会话锁定 TA03 Lv1 效果');
const r3 = g3.upgradeTalent('TA03');
const lv2Value = cfg.talentUpgradeById.get('TA03').levels[1].effect.value;
ok(r3.ok && r3.level === 2, 'TA03 升级至 Lv2');
ok(beforeSession.activeTalents.find(t => t.id === 'TA03').effect.value === lv1Value, '已建立会话不被升级原地改写');
ok(beforeSession.activeTalents.find(t => t.id === 'TA03') !== g3.s.active.find(t => t.id === 'TA03'), '会话文心与全局持有副本不共享对象');
const nextSession = g3.createSession({ npc: g3.pickNpc(false), label: '升级后下一场' });
ok(nextSession.activeTalents.find(t => t.id === 'TA03').effect.value === lv2Value, '升级后下一场采用 Lv2 效果');
const reloaded3 = deserializeRun(serializeRun(g3), cfg);
const g4 = new Game(cfg, makeUI(), rng); g4.s = reloaded3.state; g4.rehydrate();
const afterReloadSession = g4.createSession({ npc: g4.pickNpc(false), label: '重载后下一场' });
ok(afterReloadSession.activeTalents.find(t => t.id === 'TA03').effect.value === lv2Value, '存档重载后的下一场仍采用 Lv2 效果');

console.log('== 异常存档等级归一：状态等级与生效副本保持一致 ==');
const badBlob = serializeRun(g4);
badBlob.state.talentLevels.TA03 = 999;
const fixed = deserializeRun(badBlob, cfg);
const maxTA03 = cfg.talentUpgradeById.get('TA03').maxLevel;
ok(fixed.ok && fixed.state.talentLevels.TA03 === maxTA03, '越界等级钳制后同步回写状态等级');
ok(fixed.state.active.find(t => t.id === 'TA03').effect.value === cfg.talentUpgradeById.get('TA03').levels[maxTA03 - 1].effect.value, '钳制后的等级与生效副本严格一致');
ok(fixed.warnings.some(w => w.includes('TA03') && w.includes('归一')), '等级归一产生可诊断警告');

console.log(`\n升级持久化测试：${fail === 0 ? '全部通过 ✓' : fail + ' 项失败 ✗'}（RUN_SAVE_VERSION=${RUN_SAVE_VERSION}）`);
process.exit(fail ? 1 : 0);
