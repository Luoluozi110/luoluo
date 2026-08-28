#!/usr/bin/env node
// 文心等级「跨局继承」回归测试（Node 无头，mock localStorage）
// 关键：第一局把某文心升级到 LvN → 第二局（全新 Game，共享 codex 存储）重新获得该文心，
// 断言其起始等级 = 图鉴记录的历史最高 LvN，且生效副本、可继续升级均正确。
// 同时验证「从未升级过的文心」跨局仍为 Lv1（无回归）。
import fs from 'fs';
import path from 'path';
import { Game } from '../js/engine/game.js';
import * as Codex from '../js/engine/codex.js';

// ---- mock Web Storage（须在调用前就绪）----
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
const T004 = cfg.talentById.get('T004');
const maxLv = cfg.talentUpgradeById.get('T004').maxLevel;

console.log('== 第一局：获得并升级 ==');
const g1 = new Game(cfg, makeUI(), rng);
g1.start('shixian', { name: '测' });
g1.s.inspiration = 999; g1.s.inspirationMax = 999;
g1.grantTalent(T004, { silent: true });
ok(g1.s.talentLevels.T004 === 1, '第一局 T004 初始 Lv1');
let lvl = 1;
while (lvl < maxLv) { const r = g1.upgradeTalent('T004'); if (!r.ok) break; lvl = r.level; }
ok(g1.s.talentLevels.T004 === lvl, `第一局 T004 升至 Lv${lvl}`);
ok(Codex.getTalentLevel('T004') === lvl, `图鉴记录历史最高 Lv${lvl}`);

console.log('== 第二局：全新开局重新获得 T004 应继承 ==');
const g2 = new Game(cfg, makeUI(), rng);
g2.start('shixian', { name: '测' });
g2.grantTalent(T004, { silent: true });
ok(g2.s.talentLevels.T004 === lvl, `第二局 T004 承袭历史最高 Lv${lvl}`);
const held2 = g2.s.passive.find(t => t.id === 'T004');
const expectEffect = cfg.talentUpgradeById.get('T004').levels[lvl - 1].effect;
ok(held2 && JSON.stringify(held2.effect) === JSON.stringify(expectEffect), `第二局 T004 生效副本 = Lv${lvl} 效果`);
if (lvl < maxLv) {
  const r2 = g2.upgradeTalent('T004');
  ok(r2.ok && r2.level === lvl + 1, `第二局可从 Lv${lvl} 继续升到 Lv${lvl + 1}`);
  ok(Codex.getTalentLevel('T004') === lvl + 1, `图鉴更新为 Lv${lvl + 1}`);
}

console.log('== 无回归：未升级过的文心跨局仍为 Lv1 ==');
const otherId = (cfg.talents || []).map(t => t.id).find(id => id !== 'T004');
ok(otherId && Codex.getTalentLevel(otherId) === 1, `未升级文心 ${otherId} 的图鉴等级 = Lv1（无回归）`);

console.log(`\n文心跨局继承测试：${fail === 0 ? '全部通过 ✓' : fail + ' 项失败 ✗'}`);
process.exit(fail ? 1 : 0);
