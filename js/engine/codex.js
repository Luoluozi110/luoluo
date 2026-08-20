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
 *   talentLevels: 对象，键为文心 id，值为该文心「历史最高等级」（跨局累计，供再次获得时继承）
 */

export const CODEX_KEY = 'feihua_codex';
export const FOE_SEP = '|';
export const CODEX_VERSION = 3;

/**
 * 图鉴四级认知：NPC 机制认知度（跨局，随交锋与破绽累计推进）。
 *  - level 0 未识：仅剪影/基础身份
 *  - level 1 相识：招牌名称与概述
 *  - level 2 察意：常见意图与行为倾向
 *  - level 3 破招：精确破绽条件、收益类型和成功次数
 * 推进规则：相遇=相识；交锋≥3 次=察意；本场命中破绽=破招（破招为最高等级）。
 * 存储于 foeCognition[npcId] = { level, meets, weaknessHits }。useFoeId 稳定 id（npc.mech 存在时为具名 id）。
 */

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
  return { v: CODEX_VERSION, foes: [], foeStats: {}, talents: [], synergies: [], foeCognition: {}, sky: [], talentLevels: {} };
}

/** 容错归一：坏数据不至于让游戏起不来 */
export function normalizeCodex(raw) {
  const base = emptyCodex();
  if (!raw || typeof raw !== 'object') return base;
  base.foes = Array.isArray(raw.foes) ? raw.foes.filter(x => typeof x === 'string') : [];
  base.talents = Array.isArray(raw.talents) ? raw.talents.filter(x => typeof x === 'string') : [];
  base.synergies = Array.isArray(raw.synergies) ? raw.synergies.filter(x => typeof x === 'string') : [];
  // 天象：兼容旧档（无 sky 字段）时回落为空数组
  base.sky = Array.isArray(raw.sky) ? raw.sky.filter(x => typeof x === 'string') : [];
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
  // NPC 认知：兼容旧档（无 foeCognition）时回落为空对象
  if (raw.foeCognition && typeof raw.foeCognition === 'object') {
    for (const [k, v] of Object.entries(raw.foeCognition)) {
      if (typeof k !== 'string') continue;
      const o = (v && typeof v === 'object') ? v : {};
      base.foeCognition[k] = {
        level: Math.max(0, Math.min(3, Math.round(Number(o.level) || 0))),
        meets: Math.max(0, Number(o.meets) || 0),
        weaknessHits: Math.max(0, Number(o.weaknessHits) || 0)
      };
    }
  }
  // 文心历史最高等级：兼容旧档（无 talentLevels）时回落为空对象
  if (raw.talentLevels && typeof raw.talentLevels === 'object') {
    for (const [k, v] of Object.entries(raw.talentLevels)) {
      if (typeof k !== 'string') continue;
      base.talentLevels[k] = Math.max(1, Math.round(Number(v) || 1));
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

/**
 * 记录一次 NPC 交锋，推进四级认知（未识→相识→察意→破招）。
 * @param {string} foeId 稳定 NPC id（mechanic NPC 用具名 id，普通 NPC 用档位 id）
 * @param {'win'|'draw'|'lose'} result
 * @param {boolean} weaknessHit 本场是否命中破绽
 * @returns {{level:number, meets:number, weaknessHits:number}}
 */
export function recordFoeCognition(foeId, result, weaknessHit) {
  if (!foeId) return null;
  const c = loadCodex();
  const rec = c.foeCognition[foeId] || { level: 1, meets: 0, weaknessHits: 0 };
  rec.meets++;
  if (weaknessHit) rec.weaknessHits++;
  // 等级推进：相遇=1 相识；击败（win）=2 察意（破绽反制之法即明示）；交锋≥3 次=2 察意；命中破绽=3 破招（最高）
  if (result === 'win') rec.level = Math.max(rec.level, 2);
  if (rec.meets >= 3) rec.level = Math.max(rec.level, 2);
  if (weaknessHit) rec.level = Math.max(rec.level, 3);
  rec.level = Math.max(1, Math.min(3, rec.level));
  c.foeCognition[foeId] = rec;
  saveCodex(c);
  return { level: rec.level, meets: rec.meets, weaknessHits: rec.weaknessHits };
}

/** 读取某 NPC 的四级认知；未交锋默认 { level: 0（未识）, meets: 0, weaknessHits: 0 } */
export function getFoeCognition(foeId) {
  const c = loadCodex();
  const rec = c.foeCognition[foeId];
  return rec ? { level: rec.level, meets: rec.meets, weaknessHits: rec.weaknessHits }
             : { level: 0, meets: 0, weaknessHits: 0 };
}

/** 四级认知的等级名 */
export const FOE_LEVEL_NAMES = ['未识', '相识', '察意', '破招'];

/** 记录一枚已获得的文心；返回是否为「新收入」 */
export function recordTalent(id) {
  if (!id) return false;
  const c = loadCodex();
  if (c.talents.includes(id)) return false;
  c.talents.push(id);
  saveCodex(c);
  return true;
}

/**
 * 记录一枚文心的「历史最高等级」（跨局累计，供再次获得时继承）。
 * 仅在突破旧记录时写入，避免无谓落盘。返回是否为「新高度」。
 */
export function recordTalentLevel(id, level) {
  if (!id) return false;
  const c = loadCodex();
  const lv = Math.max(1, Math.round(Number(level) || 1));
  const prev = Number(c.talentLevels[id]) || 1;
  if (lv <= prev) return false;
  c.talentLevels[id] = lv;
  saveCodex(c);
  return true;
}

/** 读取某文心的历史最高等级；未记录过返回 1（Lv1 起步） */
export function getTalentLevel(id) {
  if (!id) return 1;
  const c = loadCodex();
  return Number(c.talentLevels[id]) || 1;
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

/** 记录一张曾邂逅的天象卡；返回是否为「新发现」（跨局累计收集进度） */
export function recordSky(id) {
  if (!id) return false;
  const c = loadCodex();
  if (c.sky.includes(id)) return false;
  c.sky.push(id);
  saveCodex(c);
  return true;
}

/** 是否已邂逅过某天象卡 */
export function hasSky(id) {
  return loadCodex().sky.includes(id);
}
