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
export const STORE_VERSION = 1;
export const SAVECODE_VERSION = 2;
export const SAVECODE_PREFIX = 'FHQS2';
const SAVECODE_MAX_CHARS = 6 * 1024 * 1024;

const STYLES = ['shi', 'ci', 'lian'];

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
    loadout: []
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
    palaceSweep: `单局殿试三连胜 ${need} 次`,
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
  if (!obj || typeof obj !== 'object' || !obj.stats) throw new Error('存档码内容不是有效的飞花棋存档');
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
