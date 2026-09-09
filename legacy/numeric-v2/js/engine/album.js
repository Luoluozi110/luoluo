/**
 * album.js —— 图鉴 / 累计统计 / 装配 / 存档码。
 *
 * 全部状态落在 localStorage：
 *   feihua_album     —— 主存档（累计统计 + 已解锁图鉴 + 当前装配）
 *   feihua_savecode  —— 最近一次导出的存档码（base64），仅作备份留痕
 *
 * 本模块在无 localStorage 的环境（Node / critic_profile.mjs）下自动降级为
 * 内存存档，读写不报错，因此引擎可以无条件调用。
 */

import { loadCodex, saveCodex } from './codex.js';
import { loadRun, replaceRun, RUN_SAVE_KEY, RUN_SAVE_MANUAL_KEY, validateRun } from './save.js';

export const ALBUM_KEY = 'feihua_album';
export const SAVECODE_KEY = 'feihua_savecode';
export const REINCARNATE_KEY = 'feihua_reincarnate_v1';
export const LOADOUT_MAX = 2;
export const STORE_VERSION = 3;          // v3: 传世名篇成长、分支与熟练度
export const SAVECODE_VERSION = 2;
export const ALBUM_LEVEL_THRESHOLDS = [0, 3, 8, 16];
export const ALBUM_LEVEL_NAMES = ['初见篇章', '熟读成诵', '融会贯通', '传世定稿'];
const ALBUM_STYLES = ['shi', 'ci', 'lian'];
export const SAVECODE_PREFIX = 'FHQS2';
const SAVECODE_MAX_CHARS = 6 * 1024 * 1024;

const STYLES = ['shi', 'ci', 'lian'];

/* -------------------------------------------------- 流派熟练度
 * 每流派独立、跨局永久累积。xp 累加；达阈值升 level（1→5）。
 * 等级影响开局主属性（每级主力 +2）与流派特殊效果增强。
 */
export const MASTERY_LEVELS = 5;
// 首局结算固定获得 12 点熟练度，因此 Lv2 门槛同为 12：无论胜负，
// 玩家都能在结算后带着一次可见、可用的跨局成长进入下一局。
export const MASTERY_THRESHOLDS = [0, 12, 100, 200, 340];   // 累计需 xp
export const MASTERY_LEVEL_NAMES = ['初学乍练', '渐入佳境', '通达晓畅', '炉火纯青', '登峰造极'];
export const MASTERY_ATTR_PER_LEVEL = 20;                   // 每级主属性额外 +20（Lv5 累计 +90）
export const MASTERY_XP_FINISH = 12;                        // 完成一局（结算）基础 xp，胜负同等
export const MASTERY_XP_CLEAR = 20;                         // 该局殿试通关额外 xp
export const MASTERY_XP_WENZONG = 8;                        // 该局评为文宗（tier≥4）额外 xp
/** 新流派等级名（等级从 1 起） */
export function masteryLevelName(level) {
  const i = Math.max(1, Math.min(MASTERY_LEVELS, Number(level) || 1)) - 1;
  return MASTERY_LEVEL_NAMES[i];
}
/** 由累计 xp 求等级（1..MASTERY_LEVELS） */
export function masteryLevelFromXp(xp) {
  const x = Math.max(0, Number(xp) || 0);
  let lv = 1;
  for (let i = 0; i < MASTERY_LEVELS; i++) if (x >= MASTERY_THRESHOLDS[i]) lv = i + 1;
  return lv;
}
/** 累计 xp + 对应等级；封装一条熟练度记录 */
export function masteryEntry(xp = 0) {
  const v = Math.max(0, Number(xp) || 0);
  return { xp: v, level: masteryLevelFromXp(v) };
}
/** 空 mastery（三派默认 Lv1） */
export function emptyMastery() {
  return { bowen: masteryEntry(0), qishi: masteryEntry(0), cizong_bi: masteryEntry(0) };
}
/** 容错归一 mastery；任何缺字段补默认，坏数据不至于让熟练度系统起不来 */
export function normalizeMastery(raw) {
  const base = emptyMastery();
  if (!raw || typeof raw !== 'object') return base;
  for (const k of Object.keys(base)) {
    const e = raw[k];
    const xp = e && typeof e === 'object' ? e.xp : Number(e) || 0;
    base[k] = masteryEntry(xp);
  }
  return base;
}

/* 流派机制按等级增强表（等级 1 = 现网基线，不增强）。
 * 方向贴合各派性格、给深度而不整体膨胀；Lv5 有单点"质变"。
 */
export function albumLevelFromXp(xp) {
  const x = Math.max(0, Number(xp) || 0);
  let lv = 1;
  for (let i = 0; i < ALBUM_LEVEL_THRESHOLDS.length; i++) if (x >= ALBUM_LEVEL_THRESHOLDS[i]) lv = i + 1;
  return lv;
}
export function albumLevelName(level) {
  return ALBUM_LEVEL_NAMES[Math.max(1, Math.min(ALBUM_LEVEL_NAMES.length, Number(level) || 1)) - 1];
}
export function emptyAlbumProgress() {
  return { xp: 0, level: 1, branch: '', branchLocked: false, uses: 0, wins: 0, draws: 0, losses: 0, styleUses: { shi: 0, ci: 0, lian: 0 }, flags: {} };
}
export function normalizeAlbumProgress(raw) {
  const base = emptyAlbumProgress();
  if (!raw || typeof raw !== 'object') return base;
  const xp = Math.max(0, Number(raw.xp) || 0);
  base.xp = xp; base.level = albumLevelFromXp(xp);
  base.branch = typeof raw.branch === 'string' ? raw.branch : '';
  base.branchLocked = !!raw.branchLocked;
  base.uses = Math.max(0, Number(raw.uses) || 0);
  base.wins = Math.max(0, Number(raw.wins) || 0);
  base.draws = Math.max(0, Number(raw.draws) || 0);
  base.losses = Math.max(0, Number(raw.losses) || 0);
  for (const k of ALBUM_STYLES) base.styleUses[k] = Math.max(0, Number(raw.styleUses && raw.styleUses[k]) || 0);
  base.flags = raw.flags && typeof raw.flags === 'object' ? { ...raw.flags } : {};
  return base;
}
export function normalizeAlbumProgressMap(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, value] of Object.entries(raw)) if (typeof id === 'string' && id) out[id] = normalizeAlbumProgress(value);
  return out;
}
export function albumXpGain(card, out = {}) {
  const g = card && card.growth || {};
  let xp = Number(g.baseXp) || 1;
  if (out.result === 'win') xp += Number(g.winXp) || 1;
  else if (out.result === 'draw') xp += Number(g.drawXp) || 1;
  else xp += Number(g.loseXp) || 1;
  if (out.style && g.style === out.style) xp += Number(g.styleXp) || 1;
  return Math.max(1, Math.floor(xp));
}
export function addAlbumProgress(map, card, out = {}) {
  if (!card || !card.id) return null;
  const before = normalizeAlbumProgress(map[card.id]);
  const after = normalizeAlbumProgress(before);
  const gain = albumXpGain(card, out);
  after.xp += gain; after.level = albumLevelFromXp(after.xp);
  after.uses += 1;
  if (out.result === 'win') after.wins += 1;
  else if (out.result === 'draw') after.draws += 1;
  else if (out.result === 'lose') after.losses += 1;
  if (out.style && ALBUM_STYLES.includes(out.style)) after.styleUses[out.style] += 1;
  if (out.branch && !after.branchLocked) { after.branch = out.branch; after.branchLocked = true; }
  map[card.id] = after;
  return { before, after, gained: gain, leveledUp: after.level > before.level };
}
export function cardBranches(card) {
  return Array.isArray(card && card.branches) ? card.branches.filter(b => b && b.id) : [];
}
export function branchById(card, id) {
  return cardBranches(card).find(b => b.id === id) || null;
}

/**
 * 在跨局图鉴存档中选择名篇路线。路线一经选择即锁定，避免同一张名篇
 * 在每局开始前反复切换而失去构筑取舍；返回结果不依赖 DOM，装配 UI 与
 * 引擎读档都可复用。
 */
export function chooseAlbumBranch(store, card, branchId) {
  if (!store || !card || !card.id) return { ok: false, reason: '名篇不存在' };
  const branch = branchById(card, branchId);
  if (!branch) return { ok: false, reason: '名篇分支不存在' };
  const normalized = normalizeStore(store);
  const p = normalized.progress[card.id] || emptyAlbumProgress();
  if (p.branchLocked && p.branch !== branchId) return { ok: false, reason: '该名篇路线已定型' };
  if (p.branch === branchId) return { ok: true, branch, progress: p, store: normalized };
  const need = Math.max(1, Number(branch.minLevel) || 1);
  if (p.level < need) return { ok: false, reason: `名篇等级不足（需 Lv${need}）` };
  p.branch = branchId;
  p.branchLocked = true;
  normalized.progress[card.id] = p;
  return { ok: true, branch, progress: p, store: normalized };
}

const MASTERY_MECH = {
  bowen: {
    // knowledgeThreshold: 2→1 于 Lv4 开始（阈值不能低于 1，Lv4/5 共享）
    perLv: { 4: { knowledgeThreshold: 1 }, 5: { knowledgeThreshold: 1 } },
    // 高造诣增加知识转化出的心得，不再直接叠加学力。
    apex: { 5: { knowledgeInsightBonus: 10 } }
  },
  qishi: {
    // 新版奇士的主轴是构思；灵感放大只保留轻量成长。
    perLv: {
      2: { inspirationBonusRate: 0.22 },
      3: { inspirationBonusRate: 0.24 },
      4: { inspirationBonusRate: 0.26 },
      5: { inspirationBonusRate: 0.28 }
    },
    apex: { 5: { strategyChargePlus: 2 } }
  },
  cizong_bi: {
    perLv: { 2: { manuscriptCapPlus: 2 }, 3: { manuscriptCapPlus: 2 }, 4: { manuscriptCapPlus: 3 }, 5: { manuscriptCapPlus: 3 } },
    apex: { 5: { firstFinishedPagePlus: 2 } }
  }
};

/**
 * 将 base 机制按流派熟练度等级 lv 增强，返回浅拷贝后的新机制对象。
 * 纯函数：不修改入参；未知流派/等级 1 返回 base 原引用（即不增强）。
 */
export function applyMasteryMechanics(base, schoolId, lv) {
  if (!base || !schoolId || !(lv >= 2)) return base;
  const tbl = MASTERY_MECH[schoolId];
  if (!tbl) return base;
  const out = { ...base };
  const per = (tbl.perLv && tbl.perLv[lv]) || null;
  const apex = (tbl.apex && tbl.apex[lv]) || null;
  if (per) Object.assign(out, per);
  if (apex) Object.assign(out, apex);
  return out;
}

/** 单条熟练度记录的人类可读摘要：如 "Lv3 通达晓畅 · 100/200" */
export function masterySummary(entry) {
  const e = masteryEntry(entry && entry.xp);
  const next = e.level < MASTERY_LEVELS ? MASTERY_THRESHOLDS[e.level] : null;
  return next == null
    ? `Lv${e.level} ${masteryLevelName(e.level)}（已满级）`
    : `Lv${e.level} ${masteryLevelName(e.level)} · ${e.xp}/${next}`;
}

/**
 * 结算一局后，按 run 累加该流派的熟练度。
 * 完成一局（结算）即 +MASTERY_XP_FINISH（胜负同等）；殿试通关 +MASTERY_XP_CLEAR；
 * 评语为文宗（tier≥4）再 +MASTERY_XP_WENZONG。
 * 就地修改 store.mastery[schoolId] 并存储，返回 { before, after, gained, leveledUp }。
 * 未知流派（保护性）：不写入，返回 null。
 */
export function addMasteryXp(store, schoolId, run = {}) {
  if (!store.mastery) store.mastery = emptyMastery();
  if (!schoolId || !store.mastery[schoolId]) return null;
  let xp = MASTERY_XP_FINISH;
  if (run.reachedEnd) xp += MASTERY_XP_CLEAR;
  if (Number(run.wenzong) || (run.tier != null && Number(run.tier) >= 4)) xp += MASTERY_XP_WENZONG;
  const before = masteryEntry(store.mastery[schoolId].xp);
  const newEntry = masteryEntry(before.xp + xp);
  store.mastery[schoolId] = newEntry;
  saveStore(store);
  return {
    before,
    after: newEntry,
    gained: xp,
    leveledUp: newEntry.level > before.level
  };
}

/** 无 localStorage 时的内存兜底（Node 环境） */
let memoryStore = null;

function hasLS() {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch (e) {
    return false;
  }
}

export function emptyStore() {
  return {
    v: STORE_VERSION,
    stats: {
      games: 0, wins: 0, draws: 0, losses: 0,
      quizzes: 0, quizRight: 0, events: 0,
      fengbi: 0, palaceSweep: 0, palaceDone: 0,
      multiplayer: 0, maxTotal: 0,
      styleWins: { shi: 0, ci: 0, lian: 0 }
    },
    unlocked: [],
    loadout: [],
    mastery: emptyMastery(),
    progress: {}
  };
}

/** 容错归一：任何缺字段都补齐，坏数据不至于让游戏起不来 */
export function normalizeStore(raw) {
  const base = emptyStore();
  if (!raw || typeof raw !== 'object') return base;
  const st = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
  for (const k of Object.keys(base.stats)) {
    if (k === 'styleWins') continue;
    const v = Number(st[k]);
    base.stats[k] = Number.isFinite(v) && v >= 0 ? v : 0;
  }
  const sw = st.styleWins && typeof st.styleWins === 'object' ? st.styleWins : {};
  for (const k of STYLES) {
    const v = Number(sw[k]);
    base.stats.styleWins[k] = Number.isFinite(v) && v >= 0 ? v : 0;
  }
  base.unlocked = Array.isArray(raw.unlocked) ? raw.unlocked.filter(x => typeof x === 'string') : [];
  base.loadout = Array.isArray(raw.loadout)
    ? raw.loadout.filter(x => typeof x === 'string' && base.unlocked.includes(x)).slice(0, LOADOUT_MAX)
    : [];
  base.mastery = normalizeMastery(raw.mastery);
  base.progress = normalizeAlbumProgressMap(raw.progress);
  return base;
}

export function loadStore() {
  if (!hasLS()) return memoryStore ? normalizeStore(memoryStore) : emptyStore();
  try {
    return normalizeStore(JSON.parse(localStorage.getItem(ALBUM_KEY) || 'null'));
  } catch (e) {
    return emptyStore();
  }
}

export function saveStore(store) {
  const s = normalizeStore(store);
  if (!hasLS()) { memoryStore = s; return s; }
  try {
    localStorage.setItem(ALBUM_KEY, JSON.stringify(s));
  } catch (e) {
    memoryStore = s;
  }
  return s;
}

export function resetStore() {
  if (hasLS()) { try { localStorage.removeItem(ALBUM_KEY); } catch (e) { /* ignore */ } }
  memoryStore = null;
  return emptyStore();
}

/* ---------------------------------------------------- 解锁条件 */

/** 某张图鉴卡当前进度：{ cur, need, done } */
export function progressOf(card, stats) {
  const u = card.unlock || {};
  const need = Math.max(1, Number(u.min) || 1);
  let cur = 0;
  switch (u.type) {
    case 'wins': cur = stats.wins; break;
    case 'styleWins': cur = (stats.styleWins || {})[u.style] || 0; break;
    case 'quizzes': cur = stats.quizzes; break;
    case 'events': cur = stats.events; break;
    case 'fengbi': cur = stats.fengbi; break;
    case 'palaceSweep': cur = stats.palaceSweep; break;
    case 'games': cur = stats.games; break;
    case 'multiplayer': cur = stats.multiplayer; break;
    case 'maxTotal': cur = stats.maxTotal; break;
    default: cur = 0;
  }
  return { cur, need, done: cur >= need };
}

/** 人话版条件提示；未解锁时带「还差 N」 */
export function conditionText(card, stats) {
  const u = card.unlock || {};
  const { cur, need, done } = progressOf(card, stats);
  const SN = { shi: '诗', ci: '词', lian: '联' };
  const label = {
    wins: `累计论战获胜 ${need} 次`,
    styleWins: `累计以${SN[u.style] || u.style}出战获胜 ${need} 次`,
    quizzes: `累计答对 ${need} 题`,
    events: `累计触发奇遇 ${need} 次`,
    fengbi: `触发封笔 ${need} 次`,
    palaceSweep: `单局殿试取胜 ${need} 次`,
    games: `完成 ${need} 局对弈`,
    multiplayer: `多人局获胜 ${need} 次`,
    maxTotal: `单局总评达到 ${need} 分`
  }[u.type] || '条件未定义';
  if (done) return label;
  return `${label}（已 ${cur}／还差 ${Math.max(0, need - cur)}）`;
}

/** 把一局结果并入累计统计（就地修改并返回 stats） */
export function mergeRun(stats, run) {
  const b = run.battle || {};
  stats.games += 1;
  stats.wins += b.win || 0;
  stats.draws += b.draw || 0;
  stats.losses += b.loss || 0;
  for (const k of STYLES) {
    stats.styleWins[k] = (stats.styleWins[k] || 0) + ((b.winsByStyle || {})[k] || 0);
  }
  stats.quizzes += run.quizRight || 0;
  stats.quizRight += run.quizRight || 0;
  stats.events += (run.events || {}).total || 0;
  if (run.endReason === 'fengbi') stats.fengbi += 1;
  if (run.palaceSweep) stats.palaceSweep += 1;
  if (run.reachedEnd) stats.palaceDone += 1;
  stats.maxTotal = Math.max(stats.maxTotal || 0, Number(run.total) || 0);
  return stats;
}

/** 依当前累计统计求出新解锁的卡（不改 store） */
export function findNewUnlocks(cards, store) {
  const have = new Set(store.unlocked);
  return (cards || []).filter(c => !have.has(c.id) && progressOf(c, store.stats).done);
}

/* ---------------------------------------------------- 装配 */

/** 已解锁且可装配的卡（multiplayer 类奖励为 title，仍可装配但无数值） */
export function unlockedCards(cards, store) {
  const set = new Set(store.unlocked);
  return (cards || []).filter(c => set.has(c.id));
}

export function loadoutCards(cards, store) {
  const byId = new Map((cards || []).map(c => [c.id, c]));
  return store.loadout.map(id => byId.get(id)).filter(Boolean);
}

/* ---------------------------------------------------- 存档码 */

function toB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  if (typeof btoa === 'function') return btoa(bin);
  return Buffer.from(str, 'utf8').toString('base64');
}

function fromB64(code) {
  if (typeof atob === 'function') {
    const bin = atob(code);
    const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(code, 'base64').toString('utf8');
}

function checksum(text) {
  // FNV-1a 32 位校验：识别剪贴板截断、误改与不完整粘贴（不是加密或防作弊）。
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

function readReincarnate() {
  if (!hasLS()) return null;
  try {
    const raw = localStorage.getItem(REINCARNATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveReincarnate(value) {
  if (!hasLS()) return;
  try {
    if (value == null) localStorage.removeItem(REINCARNATE_KEY);
    else localStorage.setItem(REINCARNATE_KEY, JSON.stringify(value));
  } catch (e) { /* ignore */ }
}

function saveCodeHistory(code) {
  if (hasLS()) { try { localStorage.setItem(SAVECODE_KEY, code); } catch (e) { /* ignore */ } }
}

/**
 * 导出全量存档：累计图鉴、对手认知、传承与进行中的自动/手动对局。
 * 代码带固定前缀、版本与校验和；仅在用户设备间复制，不会上传服务器。
 */
export function exportCode(store = loadStore()) {
  const payload = {
    v: SAVECODE_VERSION,
    album: normalizeStore(store),
    codex: loadCodex(),
    reincarnate: readReincarnate(),
    runs: {
      auto: loadRun(RUN_SAVE_KEY),
      manual: loadRun(RUN_SAVE_MANUAL_KEY)
    }
  };
  const body = toB64(JSON.stringify(payload));
  const code = `${SAVECODE_PREFIX}.${checksum(body)}.${body}`;
  saveCodeHistory(code);
  return code;
}

function parseLegacyCode(raw) {
  let obj;
  try { obj = JSON.parse(fromB64(raw)); }
  catch (e) { throw new Error('存档码无法解析，请确认完整复制'); }
  if (!obj || typeof obj !== 'object' || !obj.stats) throw new Error('存档码内容不是有效的文心棋存档');
  return { legacy: true, album: normalizeStore(obj) };
}

function parseCode(code) {
  const raw = String(code || '').replace(/\s+/g, '');
  if (!raw) throw new Error('存档码为空');
  if (raw.length > SAVECODE_MAX_CHARS) throw new Error('存档码过长，已拒绝导入');
  if (!raw.startsWith(`${SAVECODE_PREFIX}.`)) return parseLegacyCode(raw);

  const parts = raw.split('.');
  if (parts.length !== 3 || !parts[1] || !parts[2]) throw new Error('存档码格式不完整');
  const [, sig, body] = parts;
  if (checksum(body) !== sig) throw new Error('存档码校验未通过，请重新完整复制');
  let payload;
  try { payload = JSON.parse(fromB64(body)); }
  catch (e) { throw new Error('存档码无法解析，请确认完整复制'); }
  if (!payload || payload.v !== SAVECODE_VERSION || !payload.album || !payload.codex || !payload.runs) {
    throw new Error('存档码版本不受支持');
  }
  for (const run of [payload.runs.auto, payload.runs.manual]) {
    if (run == null) continue;
    const chk = validateRun(run);
    if (!chk.ok) throw new Error(`对局存档校验失败：${chk.error}`);
  }
  return { legacy: false, album: normalizeStore(payload.album), codex: payload.codex, reincarnate: payload.reincarnate, runs: payload.runs };
}

/**
 * 导入存档码并覆盖本机同类数据。新版导入前完成全部解析和校验，避免半写入；
 * 旧版图鉴码仍可导入，但不含进行中的对局、图鉴阁认知与传承。
 */
export function importCode(code) {
  const parsed = parseCode(code);
  if (parsed.legacy) {
    const store = saveStore(parsed.album);
    saveCodeHistory(String(code || '').replace(/\s+/g, ''));
    return { store, legacy: true, hasRun: false };
  }

  const auto = parsed.runs.auto;
  const manual = parsed.runs.manual;
  if (auto && !replaceRun(auto, RUN_SAVE_KEY).ok) throw new Error('自动对局存档写入失败');
  if (manual && !replaceRun(manual, RUN_SAVE_MANUAL_KEY).ok) throw new Error('手动对局存档写入失败');
  if (!auto && hasLS()) { try { localStorage.removeItem(RUN_SAVE_KEY); } catch (e) { /* ignore */ } }
  if (!manual && hasLS()) { try { localStorage.removeItem(RUN_SAVE_MANUAL_KEY); } catch (e) { /* ignore */ } }
  const store = saveStore(parsed.album);
  saveCodex(parsed.codex);
  saveReincarnate(parsed.reincarnate);
  saveCodeHistory(String(code || '').replace(/\s+/g, ''));
  return { store, legacy: false, hasRun: !!(auto || manual) };
}
