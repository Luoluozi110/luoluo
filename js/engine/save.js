/**
 * save.js —— 对局「随时存档 / 读档」序列化层（v2）。
 * 仅负责把 Game 的运行时状态（this.s）与 localStorage 互转；
 * 不含任何 DOM 逻辑，引擎与 UI 共用。
 *
 * v2 相对 v1 的改动：
 *   - STATE_KEYS 白名单：只序列化受控字段，新增/删除引擎字段不再污染存档。
 *   - 引用按 ID 存储：school / passive / active / sky / loadout 只存 ID，
 *     读档时从当前 cfg 重新关联，配置更新后旧存档不引用过时对象。
 *   - 版本迁移 migrateRun：v1/v2 → v3（ID 引用 + 文心触发状态），并清理已删除系统字段。
 *   - 结构化校验 validateRun：坏档、缺字段、类型错误都能 graceful 降级。
 *   - 双槽位：自动槽 feihua_run_save + 手动槽 feihua_run_save_manual。
 *   - 日志截断：s.log 最多保留最近 150 条，防 localStorage 撑爆。
 *   - 写失败降级：localStorage → sessionStorage → 内存，且上报存储位置。
 */

export const RUN_SAVE_KEY = 'feihua_run_save';               // 自动存档槽（每回合结束）
export const RUN_SAVE_MANUAL_KEY = 'feihua_run_save_manual'; // 手动存档槽（菜单「保存当前进度」）
export const RUN_SAVE_VERSION = 4;
export const SAVE_WARN_BYTES = 3 * 1024 * 1024;              // 体积预警阈值 3MB

const LOG_MAX = 200;   // 超过则截断
const LOG_KEEP = 150;  // 截断后保留最近条数

/** 参与序列化的运行时状态白名单 */
const STATE_KEYS = [
  'school', 'playerName', 'attrs', 'inspiration', 'inspirationMax',
  'passive', 'active', 'track', 'pos', 'branchId', 'branchIndex',
  'lap', 'turn', 'phase',   'sky', 'nextBattlePct', 'battle', 'events',
  'quiz', 'seenEvents', 'usedQuestions', 'palaceWins', 'palaceDone',
  'zeitgeist', 'affStreak', 'synergies', 'talentState', 'npcMech', 'loadout', 'titles',
  'talentLevels', 'over', 'reachedEnd', 'endReason', 'log'
];

/**
 * 取某文心「指定等级」的生效副本（与引擎 game.leveledTalent 同口径，供读档重建）。
 * effect 取自升级表 levels[level-1]（设计 Lv1 起为权威生效值）；主动文心附带该等级 cost。
 * 返回新对象，绝不改动 cfg 模板。
 */
function leveledClone(cfg, id, level) {
  const t = cfg.talentById && cfg.talentById.get(id);
  if (!t) return null;
  const up = cfg.talentUpgradeById && cfg.talentUpgradeById.get(id);
  const clone = { ...t };
  if (up && up.levels && up.levels[level - 1]) {
    clone.effect = JSON.parse(JSON.stringify(up.levels[level - 1].effect));
    if (up.levels[level - 1].cost != null) clone.cost = up.levels[level - 1].cost;
    else if (t.cost != null) clone.cost = t.cost;
  } else if (t.effect) {
    clone.effect = JSON.parse(JSON.stringify(t.effect));
  }
  return clone;
}

function hasLS() {
  try { return typeof localStorage !== 'undefined' && localStorage !== null; }
  catch (e) { return false; }
}
function hasSS() {
  try { return typeof sessionStorage !== 'undefined' && sessionStorage !== null; }
  catch (e) { return false; }
}

/** 内存兜底：所有 Web 存储不可用时仍能本局内存档/读档 */
const memorySlots = new Map();

/* ------------------------------------------------ 序列化辅助 */

function encodeValue(v) {
  if (v instanceof Set) return { __set: Array.from(v) };
  if (v instanceof Map) return { __map: Array.from(v.entries()) };
  try { return JSON.parse(JSON.stringify(v)); }
  catch (e) { return null; }
}

function decodeValue(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('__set' in v) return new Set(v.__set || []);
    if ('__map' in v) return new Map(v.__map || []);
  }
  return v;
}

/** 天赋/图鉴卡等「配置引用」统一只存 ID */
function idsOf(arr) {
  return (Array.isArray(arr) ? arr : [])
    .map(t => (typeof t === 'string' ? t : (t && t.id)))
    .filter(x => typeof x === 'string' && x);
}

/* ------------------------------------------------ 序列化 */

/** 把一局运行状态序列化为可存储对象 */
export function serializeRun(game) {
  const s = game && game.s;
  if (!s) return null;
  const state = {};
  for (const k of STATE_KEYS) {
    if (!(k in s)) continue;
    const v = s[k];
    switch (k) {
      case 'school':
        state.school = s.school && s.school.id ? { id: s.school.id } : null;
        break;
      case 'passive':
      case 'active':
        state[k] = idsOf(v);
        break;
      case 'sky':
        state.sky = (Array.isArray(v) ? v : [])
          .filter(sk => sk && sk.card && sk.card.id)
          .map(sk => ({ id: sk.card.id, left: Number(sk.left) || 1 }));
        break;
      case 'loadout':
        state.loadout = idsOf(v);
        break;
      case 'log': {
        const log = Array.isArray(v) ? v : [];
        state.log = log.length > LOG_MAX ? log.slice(-LOG_KEEP) : log;
        break;
      }
      default:
        state[k] = encodeValue(v);
    }
  }
  return { v: RUN_SAVE_VERSION, savedAt: Date.now(), state };
}

/* ------------------------------------------------ 迁移与校验 */

/** v1/v2 → v3：对象引用改 ID、补文心触发状态、清理已删除系统字段 */
function migrateRun(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.v >= RUN_SAVE_VERSION) return obj;
  const src = obj.state && typeof obj.state === 'object' ? obj.state : null;
  if (!src) return null;
  const state = {};
  for (const k of Object.keys(src)) {
    if (!STATE_KEYS.includes(k)) continue;   // 丢弃已删除字段（如 tendencies）与未知字段
    state[k] = src[k];
  }
  // school：v1 存的是完整对象
  if (state.school && typeof state.school === 'object' && !Array.isArray(state.school)) {
    state.school = state.school.id ? { id: state.school.id } : null;
  }
  // passive/active：v1 存天赋对象数组
  state.passive = idsOf(state.passive);
  state.active = idsOf(state.active);
  // sky：v1 存 { card, left }
  state.sky = (Array.isArray(state.sky) ? state.sky : [])
    .map(sk => (sk && sk.card ? { id: sk.card.id, left: Number(sk.left) || 1 } : sk))
    .filter(sk => sk && typeof sk.id === 'string');
  // loadout：v1 包装层可能存对象数组
  state.loadout = idsOf(state.loadout);
  // v3：旧档没有文心限次/互斥状态；默认空对象，不重复触发旧的一次性文心。
  state.talentState = (state.talentState && typeof state.talentState === 'object')
    ? state.talentState : { triggers: {}, flags: {} };
  // v4：文心等级。v3 及更早旧档无此字段 → 按持有文心置 Lv1（上限钳制推迟到 deserialize，因此处无 cfg）。
  if (!state.talentLevels || typeof state.talentLevels !== 'object') {
    state.talentLevels = {};
    for (const id of [...idsOf(state.passive), ...idsOf(state.active)]) state.talentLevels[id] = 1;
  }
  return { v: RUN_SAVE_VERSION, savedAt: Number(obj.savedAt) || Date.now(), state };
}

/** 结构化校验：返回 { ok, error } */
export function validateRun(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, error: '存档不是有效对象' };
  if (obj.v !== RUN_SAVE_VERSION) return { ok: false, error: `存档版本不受支持（v${obj.v}）` };
  const st = obj.state;
  if (!st || typeof st !== 'object') return { ok: false, error: '存档缺少 state' };
  if (!st.school || typeof st.school.id !== 'string') return { ok: false, error: '存档缺少流派信息' };
  if (typeof st.turn !== 'number' || st.turn < 0) return { ok: false, error: '存档回合数异常' };
  if (!Array.isArray(st.passive) || !Array.isArray(st.active)) return { ok: false, error: '文心数据异常' };
  if (!st.attrs || typeof st.attrs !== 'object') return { ok: false, error: '属性数据异常' };
  return { ok: true };
}

/* ------------------------------------------------ 反序列化 */

/**
 * 从存储对象还原出可赋值给 game.s 的状态。
 * 返回 { ok, state, warnings:[], error } —— 引用失效的字段会被过滤并记入 warnings。
 */
export function deserializeRun(rawObj, cfg) {
  const obj = migrateRun(rawObj);
  const chk = validateRun(obj);
  if (!chk.ok) return { ok: false, state: null, warnings: [], error: chk.error };

  const warnings = [];
  const st = obj.state;
  const out = {};
  for (const k of STATE_KEYS) {
    if (k in st) out[k] = decodeValue(st[k]);
  }

  // school：重新关联当前配置；找不到则回退第一个流派并告警
  const sch = (cfg.schools || []).find(x => x.id === (st.school && st.school.id));
  if (sch) out.school = sch;
  else {
    out.school = (cfg.schools || [])[0] || null;
    warnings.push(`存档流派「${st.school && st.school.id}」已失效，回退为「${out.school ? out.school.name : '无'}」`);
  }

  // 天赋：按 ID 重新关联，并以存档中的等级重建「生效副本」（effect 取自升级表对应等级）。
  // 旧档 talentLevels 缺失 → 全部按 Lv1；等级越界（>maxLevel 或 <1）钳制，保证读档不崩。
  const lostTalents = [];
  const levels = (st.talentLevels && typeof st.talentLevels === 'object') ? { ...st.talentLevels } : {};
  for (const id of [...(st.passive || []), ...(st.active || [])]) if (!(id in levels)) levels[id] = 1;
  const upById = cfg.talentUpgradeById || new Map();
  const relink = ids => (Array.isArray(ids) ? ids : []).map(id => {
    const t = cfg.talentById && cfg.talentById.get(id);
    if (!t) { lostTalents.push(id); return null; }
    const maxL = (upById.get(id) || {}).maxLevel || 1;
    const lvl = Math.max(1, Math.min(Number(levels[id]) || 1, maxL));
    return leveledClone(cfg, id, lvl);
  }).filter(Boolean);
  out.passive = relink(st.passive);
  out.active = relink(st.active);
  out.talentLevels = levels;
  if (lostTalents.length) warnings.push(`有 ${lostTalents.length} 枚文心在当前配置中已失效，已移除（${lostTalents.join('、')}）`);

  // 天象：按 ID 重新关联 cfg.sky
  const skyPool = new Map((cfg.sky || []).map(c => [c.id, c]));
  out.sky = (Array.isArray(st.sky) ? st.sky : [])
    .map(sk => {
      const card = skyPool.get(sk.id);
      return card ? { card, left: Math.max(1, Number(sk.left) || 1) } : null;
    })
    .filter(Boolean);

  // 图鉴装配：按 ID 校验当前图鉴
  const albumIds = new Set((cfg.album || []).map(c => c.id));
  const keptLoadout = (Array.isArray(st.loadout) ? st.loadout : []).filter(id => albumIds.has(id));
  if (keptLoadout.length !== (st.loadout || []).length)
    warnings.push('部分图鉴装配卡在当前配置中已失效，已移除');
  out.loadout = keptLoadout;

  // 兜底默认值：防止缺字段导致后续回合崩溃
  out.attrs = (out.attrs && typeof out.attrs === 'object') ? out.attrs : { ...(cfg.attrs && cfg.attrs.initial) };
  const baseInsp = Math.max(0, Number(cfg.inspiration && cfg.inspiration.initial) || 20);
  const baseMax = Math.max(baseInsp, Number(cfg.inspiration && cfg.inspiration.max) || 40);
  // 配置提高基础上限时，旧档至少升级到新基线；已有更高的文心扩容上限则保留。
  out.inspirationMax = Math.max(baseMax, Number.isFinite(Number(out.inspirationMax)) ? Number(out.inspirationMax) : baseMax);
  out.inspiration = Math.max(0, Math.min(out.inspirationMax,
    Number.isFinite(Number(out.inspiration)) ? Number(out.inspiration) : baseInsp));
  out.track = out.track === 'branch' ? 'branch' : 'main';
  out.pos = Math.max(0, Number(out.pos) || 0);
  out.branchIndex = Number.isFinite(Number(out.branchIndex)) ? Number(out.branchIndex) : -1;
  out.lap = Math.max(1, Number(out.lap) || 1);
  out.turn = Math.max(0, Number(out.turn) || 0);
  out.seenEvents = out.seenEvents instanceof Set ? out.seenEvents : new Set();
  out.usedQuestions = out.usedQuestions instanceof Set ? out.usedQuestions : new Set();
  out.log = Array.isArray(out.log) ? out.log.slice(-LOG_KEEP) : [];
  out.titles = Array.isArray(out.titles) ? out.titles : [];
  out.synergies = Array.isArray(out.synergies) ? out.synergies : [];
  out.talentState = (out.talentState && typeof out.talentState === 'object') ? out.talentState : { triggers: {}, flags: {} };
  out.talentState.triggers = (out.talentState.triggers && typeof out.talentState.triggers === 'object') ? out.talentState.triggers : {};
  out.talentState.flags = (out.talentState.flags && typeof out.talentState.flags === 'object') ? out.talentState.flags : {};
  out.npcMech = (out.npcMech && typeof out.npcMech === 'object') ? out.npcMech : { history: {}, palace: {} };
  out.battle = (out.battle && typeof out.battle === 'object') ? out.battle : { win: 0, draw: 0, loss: 0, streak: 0, maxStreak: 0, upsets: 0, winsByStyle: { shi: 0, ci: 0, lian: 0 } };
  out.events = (out.events && typeof out.events === 'object') ? out.events : { total: 0, rare: 0, legend: 0, talents: 0, items: 0 };
  out.quiz = (out.quiz && typeof out.quiz === 'object') ? out.quiz : { asked: 0, right: 0 };
  out.over = !!out.over;
  out.reachedEnd = !!out.reachedEnd;

  return { ok: true, state: out, warnings, error: null };
}

/* ------------------------------------------------ 读写与降级 */

/**
 * 写存档。返回 { ok, where, bytes, tooBig }
 *   where: 'local' | 'session' | 'memory' | null
 *   tooBig: 体积超过 SAVE_WARN_BYTES 时 true（仍尝试写入）
 */
export function saveRun(game, slot = RUN_SAVE_KEY) {
  const obj = serializeRun(game);
  if (!obj) return { ok: false, where: null, bytes: 0, tooBig: false };
  let text;
  try { text = JSON.stringify(obj); }
  catch (e) { return { ok: false, where: null, bytes: 0, tooBig: false }; }
  const bytes = text.length;
  const tooBig = bytes > SAVE_WARN_BYTES;

  if (hasLS()) {
    try { localStorage.setItem(slot, text); return { ok: true, where: 'local', bytes, tooBig }; }
    catch (e) { /* 配额/隐私模式 → 走 session */ }
  }
  if (hasSS()) {
    try { sessionStorage.setItem(slot, text); return { ok: true, where: 'session', bytes, tooBig }; }
    catch (e) { /* 继续降级 */ }
  }
  memorySlots.set(slot, text);
  return { ok: true, where: 'memory', bytes, tooBig };
}

/** 读指定槽位（local → session → memory），返回原始对象或 null */
export function loadRun(slot = RUN_SAVE_KEY) {
  let raw = null;
  if (hasLS()) { try { raw = localStorage.getItem(slot); } catch (e) { /* ignore */ } }
  if (raw == null && hasSS()) { try { raw = sessionStorage.getItem(slot); } catch (e) { /* ignore */ } }
  if (raw == null) raw = memorySlots.get(slot) || null;
  if (raw == null) return null;
  try { return JSON.parse(raw); }
  catch (e) { return { __corrupt: true, slot }; }   // 损坏标记，供 UI 提示
}

/**
 * 用已校验的原始存档替换指定槽位。供存档码导入使用，复用与 saveRun 相同的降级策略。
 * 返回 { ok, where, bytes, tooBig }；无效对象不会写入任何存储。
 */
export function replaceRun(rawObj, slot = RUN_SAVE_KEY) {
  const chk = validateRun(rawObj);
  if (!chk.ok) return { ok: false, error: chk.error, where: null, bytes: 0, tooBig: false };
  let text;
  try { text = JSON.stringify(rawObj); }
  catch (e) { return { ok: false, error: '存档序列化失败', where: null, bytes: 0, tooBig: false }; }
  const bytes = text.length;
  const tooBig = bytes > SAVE_WARN_BYTES;
  if (hasLS()) {
    try { localStorage.setItem(slot, text); return { ok: true, where: 'local', bytes, tooBig }; }
    catch (e) { /* 配额/隐私模式 → 走 session */ }
  }
  if (hasSS()) {
    try { sessionStorage.setItem(slot, text); return { ok: true, where: 'session', bytes, tooBig }; }
    catch (e) { /* 继续降级 */ }
  }
  memorySlots.set(slot, text);
  return { ok: true, where: 'memory', bytes, tooBig };
}

/** 读取「最佳可用存档」：手动槽优先，其次自动槽。返回 { obj, slot } 或 null */
export function loadBestRun() {
  const m = loadRun(RUN_SAVE_MANUAL_KEY);
  if (m && !m.__corrupt && m.state && !m.state.over) return { obj: m, slot: RUN_SAVE_MANUAL_KEY };
  const a = loadRun(RUN_SAVE_KEY);
  if (a && !a.__corrupt && a.state && !a.state.over) return { obj: a, slot: RUN_SAVE_KEY };
  // 手动槽存在但已结束/损坏时，返回它以便 UI 提示
  if (m && m.__corrupt) return { obj: m, slot: RUN_SAVE_MANUAL_KEY };
  if (a && a.__corrupt) return { obj: a, slot: RUN_SAVE_KEY };
  return null;
}

/** 是否有可继续的存档（任一槽位、未结束、未损坏） */
export function hasRun() {
  const best = loadBestRun();
  return !!(best && best.obj && !best.obj.__corrupt);
}

/** 列出各槽位摘要，供菜单/主菜单展示 */
export function listRuns() {
  const out = [];
  for (const slot of [RUN_SAVE_MANUAL_KEY, RUN_SAVE_KEY]) {
    const r = loadRun(slot);
    if (!r || r.__corrupt || !r.state) continue;
    out.push({
      slot,
      manual: slot === RUN_SAVE_MANUAL_KEY,
      savedAt: Number(r.savedAt) || 0,
      turn: Number(r.state.turn) || 0,
      lap: Number(r.state.lap) || 1,
      schoolId: r.state.school && r.state.school.id || '',
      over: !!r.state.over
    });
  }
  return out;
}

/** 清除存档；不传 slot 则两槽都清 */
export function clearRun(slot) {
  const slots = slot ? [slot] : [RUN_SAVE_KEY, RUN_SAVE_MANUAL_KEY];
  for (const s of slots) {
    if (hasLS()) { try { localStorage.removeItem(s); } catch (e) { /* ignore */ } }
    if (hasSS()) { try { sessionStorage.removeItem(s); } catch (e) { /* ignore */ } }
    memorySlots.delete(s);
  }
}
