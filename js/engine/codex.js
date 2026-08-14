/**
 * codex.js —— 图鉴累计（跨局持久化）。
 *
 * 与 engine/album.js 的思路一致：把「遇到过的对手」「获得过的文心」累计进
 * localStorage，作为「图鉴」的发现进度。本模块不碰引擎规则，只读写存储。
 *
 * 在无 localStorage 的环境（Node）下自动降级为内存存储，读写不报错。
 *
 * 存储键：feihua_codex
 *   foes:     数组，元素为 `${tierId}|${name}`（对手唯一键，标记「曾邂逅」）
 *   foeStats: 对象，键同为 `${tierId}|${name}`，值为 { w, d, l }（胜/平/负场次，跨局累计）
 *   talents:  数组，元素为文心 id
 *   synergies: 数组，元素为羁绊 id（集齐成员后首次激活即记入，跨局累计收集进度）
 */

export const CODEX_KEY = 'feihua_codex';
export const FOE_SEP = '|';
export const CODEX_VERSION = 2;

/** 无 localStorage 时的内存兜底 */
let memoryCodex = null;

function hasLS() {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch (e) {
    return false;
  }
}

export function emptyCodex() {
  return { v: CODEX_VERSION, foes: [], foeStats: {}, talents: [], synergies: [] };
}

/** 容错归一：坏数据不至于让游戏起不来 */
export function normalizeCodex(raw) {
  const base = emptyCodex();
  if (!raw || typeof raw !== 'object') return base;
  base.foes = Array.isArray(raw.foes) ? raw.foes.filter(x => typeof x === 'string') : [];
  base.talents = Array.isArray(raw.talents) ? raw.talents.filter(x => typeof x === 'string') : [];
  base.synergies = Array.isArray(raw.synergies) ? raw.synergies.filter(x => typeof x === 'string') : [];
  // 对手战绩：兼容旧档（无 foeStats 字段）时回落为空对象
  if (raw.foeStats && typeof raw.foeStats === 'object') {
    for (const [k, v] of Object.entries(raw.foeStats)) {
      if (typeof k !== 'string') continue;
      const o = (v && typeof v === 'object') ? v : {};
      base.foeStats[k] = {
        w: Math.max(0, Number(o.w) || 0),
        d: Math.max(0, Number(o.d) || 0),
        l: Math.max(0, Number(o.l) || 0)
      };
    }
  }
  return base;
}

export function loadCodex() {
  if (!hasLS()) return memoryCodex ? normalizeCodex(memoryCodex) : emptyCodex();
  try {
    return normalizeCodex(JSON.parse(localStorage.getItem(CODEX_KEY) || 'null'));
  } catch (e) {
    return emptyCodex();
  }
}

export function saveCodex(c) {
  const s = normalizeCodex(c);
  if (!hasLS()) { memoryCodex = s; return s; }
  try {
    localStorage.setItem(CODEX_KEY, JSON.stringify(s));
  } catch (e) {
    memoryCodex = s;
  }
  return s;
}

export function foeKey(tierId, name) {
  return `${tierId}${FOE_SEP}${name}`;
}

/** 记录一次对手邂逅；返回是否为「新发现」 */
export function recordFoe(tierId, name) {
  if (!tierId || !name) return false;
  const c = loadCodex();
  const k = foeKey(tierId, name);
  if (c.foes.includes(k)) return false;
  c.foes.push(k);
  saveCodex(c);
  return true;
}

/** 记录一次对手战斗结果；跨局累计胜/平/负场次（发现进度独立于胜负） */
export function recordFoeResult(tierId, name, result) {
  if (!tierId || !name || !result) return false;
  const c = loadCodex();
  const k = foeKey(tierId, name);
  const rec = c.foeStats[k] || { w: 0, d: 0, l: 0 };
  if (result === 'win') rec.w++;
  else if (result === 'draw') rec.d++;
  else rec.l++;
  c.foeStats[k] = rec;
  saveCodex(c);
  return true;
}

/** 读取某对手的累计战绩；未交锋返回全 0 */
export function getFoeStats(tierId, name) {
  const c = loadCodex();
  return c.foeStats[foeKey(tierId, name)] || { w: 0, d: 0, l: 0 };
}

/** 记录一枚已获得的文心；返回是否为「新收入」 */
export function recordTalent(id) {
  if (!id) return false;
  const c = loadCodex();
  if (c.talents.includes(id)) return false;
  c.talents.push(id);
  saveCodex(c);
  return true;
}

export function hasFoe(tierId, name) {
  return loadCodex().foes.includes(foeKey(tierId, name));
}

export function hasTalent(id) {
  return loadCodex().talents.includes(id);
}

/** 记录一枚已激活（达成）的羁绊；返回是否为「新收入」（跨局累计收集进度） */
export function recordSynergy(id) {
  if (!id) return false;
  const c = loadCodex();
  if (c.synergies.includes(id)) return false;
  c.synergies.push(id);
  saveCodex(c);
  return true;
}

export function hasSynergy(id) {
  return loadCodex().synergies.includes(id);
}
