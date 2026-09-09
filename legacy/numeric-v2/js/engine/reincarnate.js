/** 照我传灯·跨局传承存储。独立于 Game 生命周期，支持 Web Storage 与无头测试内存兜底。 */
import { ATTR_KEYS } from './rules.js';
import { NUMERIC_VERSION, legacyTenthsToV2 } from './numeric.js';

export const REINCARNATE_KEY = 'feihua_reincarnate_v1';

export const Reincarnate = {
  _mem: null,
  _read() {
    let record = null;
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        const raw = localStorage.getItem(REINCARNATE_KEY);
        if (raw) record = JSON.parse(raw);
      }
    } catch (e) { /* localStorage 不可用或坏档 → 尝试 sessionStorage */ }
    try {
      if (!record && typeof sessionStorage !== 'undefined' && sessionStorage) {
        const raw = sessionStorage.getItem(REINCARNATE_KEY);
        if (raw) record = JSON.parse(raw);
      }
    } catch (e) { /* sessionStorage 不可用 → 内存兜底 */ }
    record = record || this._mem;
    if (record && Number(record.numericVersion) !== NUMERIC_VERSION) {
      for (const key of ATTR_KEYS) if (record.attrs && key in record.attrs) record.attrs[key] = legacyTenthsToV2(record.attrs[key]);
      record.numericVersion = NUMERIC_VERSION;
      this._write(record);
    }
    return record;
  },
  _write(obj) {
    this._mem = obj;
    let wroteLocal = false;
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        if (obj) localStorage.setItem(REINCARNATE_KEY, JSON.stringify(obj));
        else localStorage.removeItem(REINCARNATE_KEY);
        wroteLocal = true;
      }
    } catch (e) { /* 尝试 sessionStorage；内存副本已在上方保留 */ }
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage) {
        // localStorage 成功时清掉旧会话副本，失败时则让会话副本接管。
        if (wroteLocal || obj == null) sessionStorage.removeItem(REINCARNATE_KEY);
        else sessionStorage.setItem(REINCARNATE_KEY, JSON.stringify(obj));
      }
    } catch (e) { /* 内存兜底已保留 */ }
  },
  pend(game, talentId) {
    const s = game.s;
    const t = (s.passive || []).find(x => x.id === talentId) || (s.active || []).find(x => x.id === talentId);
    if (!t || !t.effect || t.effect.type !== 'reincarnate') return false;
    const threshold = Number(t.effect.inspThreshold) || 0;
    const ratio = Number(t.effect.attrRatio) || 0;
    if (s.inspiration < threshold || ratio <= 0) return false;
    const attrs = {};
    for (const k of ATTR_KEYS) attrs[k] = Math.floor((Number(s.attrs[k]) || 0) * ratio);
    const talentLevel = Math.max(1, Math.floor(Number((s.talentLevels || {})[talentId]) || 1));
    // 传承不仅保留当前属性，也保留点灯者本身。否则下一局虽得到属性，
    // 却无法再次点灯，传承链会在一局后中断。
    this._write({ numericVersion: NUMERIC_VERSION, talentId, talentName: t.name || talentId, talentLevel, ratio, attrs, ts: typeof Date !== 'undefined' ? Date.now() : 0 });
    return true;
  },
  consume() {
    const obj = this._read();
    if (!obj || !obj.attrs) return null;
    this._write(null);
    return obj;
  },
  peek() { return this._read(); },
  reset() { this._write(null); }
};
