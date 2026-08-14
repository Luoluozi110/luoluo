/**
 * save.js —— 对局「随时存档 / 读档」序列化层。
 * 仅负责把 Game 的运行时状态（this.s）与 localStorage 互转；
 * 不含任何 DOM 逻辑，引擎与 UI 共用。
 *
 * 注意：this.s 内含两个 Set（seenEvents / usedQuestions），JSON 无法直接序列化，
 * 这里用 { __set: [...] } 哨兵包裹，读档时还原回 Set。
 */

export const RUN_SAVE_KEY = 'feihua_run_save';

function hasLS() {
  try { return typeof localStorage !== 'undefined' && localStorage !== null; }
  catch (e) { return false; }
}

/** 把一局运行状态序列化为可存储对象 */
export function serializeRun(game) {
  const s = game.s;
  if (!s) return null;
  const state = {};
  for (const k of Object.keys(s)) {
    const v = s[k];
    if (v instanceof Set) state[k] = { __set: Array.from(v) };
    else {
      try { state[k] = JSON.parse(JSON.stringify(v)); }
      catch (e) { state[k] = null; } // 极端情况下丢弃不可克隆字段，不影响读档
    }
  }
  return {
    v: 1,
    savedAt: Date.now(),
    schoolId: s.school ? s.school.id : null,
    loadout: Array.isArray(s.loadout) ? s.loadout.slice() : [],
    state
  };
}

/** 从存储对象还原出可赋值给 game.s 的状态（Set / school 还原） */
export function deserializeRun(obj, cfg) {
  if (!obj || !obj.state) return null;
  const out = {};
  for (const k of Object.keys(obj.state)) {
    const v = obj.state[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && '__set' in v) {
      out[k] = new Set(v.__set || []);
    } else {
      out[k] = v;
    }
  }
  // school 对象重新关联回当前 cfg，保证与运行时引用一致
  const sch = (cfg.schools || []).find(x => x.id === (out.school && out.school.id)) || out.school;
  if (sch) out.school = sch;
  return out;
}

export function saveRun(game) {
  if (!hasLS()) return false;
  const obj = serializeRun(game);
  if (!obj) return false;
  try { localStorage.setItem(RUN_SAVE_KEY, JSON.stringify(obj)); return true; }
  catch (e) { return false; }
}

export function loadRun() {
  if (!hasLS()) return null;
  try {
    const raw = localStorage.getItem(RUN_SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function hasRun() {
  const r = loadRun();
  return !!(r && r.state && !r.state.over);
}

export function clearRun() {
  if (!hasLS()) return;
  try { localStorage.removeItem(RUN_SAVE_KEY); } catch (e) { /* ignore */ }
}
