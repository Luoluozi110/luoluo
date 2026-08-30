// 存档系统 v2 回归测试（Node 无头，mock localStorage/sessionStorage）
// 用法：node tests/save-v2.test.mjs
// 覆盖：往返一致性 / 续玩 / v1→v2 迁移 / 损坏恢复 / 双槽位 / 日志截断 / 失效引用过滤 / 存储降级

/* ---------------- mock Web Storage（须在 import 引擎前定义） ---------------- */
function makeStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    clear: () => m.clear(),
    _map: m
  };
}
globalThis.localStorage = makeStorage();
globalThis.sessionStorage = makeStorage();

const { Game } = await import('../feihuaqi-playable/js/engine/game.js');
const R = await import('../feihuaqi-playable/js/engine/rules.js');
const Save = await import('../feihuaqi-playable/js/engine/save.js');
const { normalizeConfig } = await import('../feihuaqi-playable/js/engine/config.js');
const fs = await import('fs');

/* ---------------- 真实配置 ---------------- */
// 使用相对本测试文件的 URL，避免由 scripts/run-test-suite.mjs 改变 cwd 后读不到配置。
const configPath = name => new URL(`../feihuaqi-playable/config/${name}.json`, import.meta.url);
const cfg = {};
for (const n of ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies','npc-mechanics','talent-upgrade','narrative']) {
  try { cfg[n] = JSON.parse(fs.readFileSync(configPath(n), 'utf8')); } catch { cfg[n] = []; }
}
normalizeConfig(cfg);

function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function makeUI(rand) {
  return {
    floatAttrs() {}, floatInspiration() {}, onState() {}, showDice() {}, movePiece() {}, toast() {},
    highlightCell() {}, showQuizResult() {}, showSky() {}, skyExpired() {},
    showTalentGain() {}, showPalaceIntro() {}, async showResult() {},
    async askReplaceTalent() { return 0; },
    async askScenic(cell, cost, insp) { return insp >= cost + 12; },
    async showQuiz(q) { return { index: q.type === 'knowledge' ? q.answer : 0, timedOut: false }; },
    async showEvent(ev) { const ch = (ev.choices || []).length; return ch ? Math.floor(rand() * ch) : 0; },
    async runBattle(session) {
      const allow = ['shi', 'ci', 'lian'].filter(s => session.canUseStyle(s));
      let style = allow[0], best = -1;
      for (const s of allow) { const v = R.expectedScore(session.playerAttrs, s); if (v > best) { best = v; style = s; } }
      let manner = session.manners[0], mv = -Infinity;
      for (const m of session.manners) { const v = session.affinityOf(m); if (v > mv) { mv = v; manner = m; } }
      return session.resolve(style, manner, 1 + Math.floor(rand() * 6));
    }
  };
}

/* ---------------- 断言工具 ---------------- */
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.error('  ✗', name); }
}
function eq(a, b, name) { ok(JSON.stringify(a) === JSON.stringify(b), `${name}（期望 ${JSON.stringify(b)}，实际 ${JSON.stringify(a)}）`); }

/* ================= 用例 1：回合往返一致性 + 续玩 ================= */
console.log('\n[1] 回合往返一致性 + 读档续玩');
{
  const rand = rng(42);
  const g = new Game(cfg, makeUI(rand), rand);
  g.start(cfg.schools[0].id, { name: '测试生' });
  let guard = 0;
  while (!g.s.over && g.s.turn < 15 && guard++ < 100) await g.playTurn();
  ok(g.s.turn >= 5, `已进行 ${g.s.turn} 回合（≥5）`);

  const obj = Save.serializeRun(g);
  const text = JSON.stringify(obj);
  const res = Save.deserializeRun(JSON.parse(text), cfg);
  ok(res.ok, 'deserializeRun 成功');
  eq(res.state.turn, g.s.turn, 'turn 一致');
  eq(res.state.pos, g.s.pos, 'pos 一致');
  eq(res.state.attrs, g.s.attrs, 'attrs 一致');
  eq(res.state.inspiration, g.s.inspiration, 'inspiration 一致');
  eq(res.state.passive.map(t => t.id), g.s.passive.map(t => t.id), '被动文心 ID 一致');
  eq(res.state.active.map(t => t.id), g.s.active.map(t => t.id), '主动文心 ID 一致');
  ok(res.state.school && res.state.school.id === g.s.school.id && res.state.school === cfg.schools.find(x => x.id === g.s.school.id), 'school 重新关联到当前 cfg 对象');
  ok(res.state.seenEvents instanceof Set && res.state.usedQuestions instanceof Set, 'Set 字段正确还原');
  ok(!('tendencies' in res.state), '已删除系统的字段不残留');

  // 读档后续玩：不崩溃且回合继续推进
  const rand2 = rng(777);
  const g2 = new Game(cfg, makeUI(rand2), rand2);
  g2.s = res.state;
  g2.rehydrate();
  const t0 = g2.s.turn;
  guard = 0;
  while (!g2.s.over && g2.s.turn < t0 + 5 && guard++ < 50) await g2.playTurn();
  ok(g2.s.turn > t0 || g2.s.over, `续玩正常（turn ${t0} → ${g2.s.turn}${g2.s.over ? '，已结算' : ''}）`);
  ok(Array.isArray(g2.s.synergies), 'rehydrate 后 synergies 为数组');
}

/* ================= 用例 2：历史存档兼容边界 ================= */
console.log('\n[2] 历史存档兼容边界');
{
  const t0 = cfg.talents[0];
  const v1 = {
    v: 1, savedAt: Date.now(), schoolId: cfg.schools[1].id, loadout: [],
    state: {
      school: cfg.schools[1],                      // v1 存完整对象
      playerName: '旧生', attrs: { shi: 5, ci: 3, lian: 0, bi: 2, xue: 2, si: 2 },
      inspiration: 20, inspirationMax: 40,
      passive: [t0], active: [],                   // v1 存天赋对象
      track: 'main', pos: 7, branchId: null, branchIndex: -1,
      lap: 1, turn: 9, phase: 'lap1', sky: [], nextBattlePct: 0,
      battle: { win: 1, draw: 0, loss: 0, streak: 0, maxStreak: 1, upsets: 0, winsByStyle: { shi: 1, ci: 0, lian: 0 } },
      events: { total: 2, rare: 0, legend: 0, talents: 1, items: 0 },
      quiz: { asked: 3, right: 2 },
      seenEvents: { __set: ['E001'] }, usedQuestions: { __set: ['Q0001'] },
      palaceWins: 0, palaceDone: 0,
      zeitgeist: { theme: 'yongwu', manner: 'haofang' },
      affStreak: { manner: null, n: 0 }, synergies: [], loadout: [], titles: [],
      over: false, reachedEnd: false, endReason: '', log: [],
      tendencies: { '豪放派': 3 }                  // 已删除系统的字段，应被丢弃
    }
  };
  const res = Save.deserializeRun(v1, cfg);
  ok(!res.ok && /旧单环存档/.test(res.error), 'v1 单环档被明确拒绝，不静默映射到三圈错误位置');

  // 当前地图坐标体系内的上一版本仍应自动迁移，并补齐 v5 新增的 schoolState。
  const g = new Game(cfg, makeUI(rng(17)), rng(17));
  g.start(cfg.schools[1].id);
  const v4 = Save.serializeRun(g);
  v4.v = 4;
  delete v4.state.schoolState;
  v4.state.passive = [t0.id];
  v4.state.talentLevels = { [t0.id]: 1 };
  v4.state.tendencies = { '豪放派': 3 };
  const migrated = Save.deserializeRun(v4, cfg);
  ok(migrated.ok, 'v4 三圈档迁移成功');
  if (migrated.ok) {
    ok(migrated.state.passive.length === 1 && migrated.state.passive[0].id === t0.id, 'v4 文心按 ID 重新关联');
    ok(!('tendencies' in migrated.state), '已删除字段在迁移时被清理');
    ok(migrated.state.school === cfg.schools[1], 'v4 school 重新关联当前配置');
    ok(migrated.state.schoolState && Array.isArray(migrated.state.schoolState.settledBattleIds), 'v5 schoolState 默认值已补齐');
  }

  const v6 = Save.serializeRun(g);
  v6.v = 6;
  v6.state.abilityState.study = { focus: ['ci'], progress: { ci: 2 } };
  v6.state.abilityState.strategy = { points: 2, refillPhase: 'child', freeChapterPhases: { child: true } };
  const strategyMigrated = Save.deserializeRun(v6, cfg);
  ok(strategyMigrated.ok, 'v6 反应式筹策档迁移成功');
  if (strategyMigrated.ok) {
    eq(strategyMigrated.state.abilityState.strategy.charges, 2, 'v6 剩余筹策迁移为阶段充能');
    eq(strategyMigrated.state.abilityState.strategy.plan, 'guard', 'v6 默认迁移为守成策');
    ok(!('points' in strategyMigrated.state.abilityState.strategy) && !('freeChapterPhases' in strategyMigrated.state.abilityState.strategy), '旧调步/立章状态已清理');
    ok(strategyMigrated.state.abilityState.study.nextFocus.includes('ci'), '旧研修方向迁移为下阶段队列');
  }
}

/* ================= 用例 3：损坏 / 非法存档恢复 ================= */
console.log('\n[3] 损坏与非法存档');
{
  ok(!Save.deserializeRun(null, cfg).ok, 'null 档 → ok:false');
  ok(!Save.deserializeRun({}, cfg).ok, '空对象 → ok:false');
  ok(!Save.deserializeRun({ v: 2 }, cfg).ok, '缺 state → ok:false');
  ok(!Save.deserializeRun({ v: 2, state: { turn: 1 } }, cfg).ok, '缺 school → ok:false');
  ok(!Save.deserializeRun({ v: 99, state: {} }, cfg).ok, '未知版本 → ok:false');
  // loadRun 读到手写坏 JSON → 返回损坏标记而非抛错
  localStorage.setItem(Save.RUN_SAVE_KEY, '{bad json…');
  const r = Save.loadRun(Save.RUN_SAVE_KEY);
  ok(r && r.__corrupt === true, '坏 JSON → __corrupt 标记');
  localStorage.clear();
}

/* ================= 用例 4：双槽位 ================= */
console.log('\n[4] 手动 / 自动双槽位');
{
  const rand = rng(9);
  const g = new Game(cfg, makeUI(rand), rand);
  g.start(cfg.schools[0].id);
  let guard = 0; while (!g.s.over && g.s.turn < 3 && guard++ < 50) await g.playTurn();
  const autoTurn = g.s.turn;
  Save.saveRun(g);                                   // 自动槽
  guard = 0; while (!g.s.over && g.s.turn < 8 && guard++ < 50) await g.playTurn();
  const manualTurn = g.s.turn;
  Save.saveRun(g, Save.RUN_SAVE_MANUAL_KEY);         // 手动槽（更晚回合）
  const best = Save.loadBestRun();
  ok(best && best.slot === Save.RUN_SAVE_MANUAL_KEY, 'loadBestRun 优先手动槽');
  eq(best.obj.state.turn, manualTurn, '手动槽回合数正确');
  ok(manualTurn > autoTurn, '手动槽晚于自动槽');
  const runs = Save.listRuns();
  ok(runs.length === 2 && runs.some(r => r.manual) && runs.some(r => !r.manual), 'listRuns 列出两个槽');
  Save.clearRun(Save.RUN_SAVE_MANUAL_KEY);           // 只清手动槽
  const best2 = Save.loadBestRun();
  ok(best2 && best2.slot === Save.RUN_SAVE_KEY, '清手动槽后回落自动槽');
  Save.clearRun();
  ok(!Save.hasRun(), 'clearRun() 全清后 hasRun=false');
}

/* ================= 用例 5：日志截断 ================= */
console.log('\n[5] 日志截断');
{
  const g = new Game(cfg, makeUI(rng(1)), rng(1));
  g.start(cfg.schools[0].id);
  for (let i = 0; i < 300; i++) g.push('测试日志 ' + i);
  ok(g.s.log.length <= 200, `运行时 log ≤ 200（实际 ${g.s.log.length}）`);
  const obj = Save.serializeRun(g);
  ok(obj.state.log.length <= 200, `存档 log ≤ 200（实际 ${obj.state.log.length}）`);
  eq(obj.state.log[obj.state.log.length - 1].text, '测试日志 299', '保留的是最近日志');
}

/* ================= 用例 6：配置更新后失效引用过滤 ================= */
console.log('\n[6] 天赋/图鉴失效过滤');
{
  const rand = rng(5);
  const g = new Game(cfg, makeUI(rand), rand);
  const albumCard = (cfg.album || [])[0];
  g.start(cfg.schools[0].id, { loadout: albumCard ? [albumCard] : [] });
  let guard = 0; while (!g.s.over && g.s.turn < 10 && guard++ < 80) await g.playTurn();
  const obj = JSON.parse(JSON.stringify(Save.serializeRun(g)));
  ok(!albumCard || obj.state.loadout.includes(albumCard.id), '开局装配卡已进入存档');
  // 构造「配置更新后」的环境：删掉当前持有的第一枚文心 + 全部图鉴卡
  // 浅复制配置容器以保留 normalizeConfig 生成的 Map 等派生结构，只替换本用例要模拟更新的内容集合。
  const cfg2 = { ...cfg, talents: cfg.talents.map(t => JSON.parse(JSON.stringify(t))), album: [] };
  const heldId = obj.state.passive[0];
  if (heldId) cfg2.talents = cfg2.talents.filter(t => t.id !== heldId);
  cfg2.talentById = new Map(cfg2.talents.map(t => [t.id, t]));
  const res = Save.deserializeRun(obj, cfg2);
  ok(res.ok, '失效引用下读档仍成功');
  if (heldId) {
    ok(!res.state.passive.some(t => t.id === heldId), '失效文心被移除');
    ok(res.warnings.some(w => w.includes('文心')), '产生文心失效告警');
  } else {
    ok(true, '（本局未持有文心，跳过文心失效断言）');
  }
  if (albumCard) {
    ok(res.warnings.some(w => w.includes('图鉴')), '产生图鉴失效告警');
    eq(res.state.loadout, [], '失效装配卡被清空');
  } else {
    ok(true, '（配置无图鉴卡，跳过图鉴失效断言）');
  }
}

/* ================= 用例 7：localStorage 写失败降级 ================= */
console.log('\n[7] 存储写失败降级');
{
  const g = new Game(cfg, makeUI(rng(3)), rng(3));
  g.start(cfg.schools[0].id);
  const origSet = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  const r = Save.saveRun(g);
  ok(r.ok && (r.where === 'session' || r.where === 'memory'), `localStorage 失败 → 降级 ${r.where}`);
  // sessionStorage 也失败 → 内存
  const origSetS = sessionStorage.setItem;
  sessionStorage.setItem = () => { throw new Error('full'); };
  const r2 = Save.saveRun(g);
  ok(r2.ok && r2.where === 'memory', '双存储失败 → 内存兜底');
  localStorage.setItem = origSet; sessionStorage.setItem = origSetS;
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
