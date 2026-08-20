/** 照我传灯·跨局传承存储。独立于 Game 生命周期，支持 Web Storage 与无头测试内存兜底。 */
import { ATTR_KEYS } from './rules.js';

export const REINCARNATE_KEY = 'feihua_reincarnate_v1';

export const Reincarnate = {
  _mem: null,
  _read() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        const raw = localStorage.getItem(REINCARNATE_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch (e) { /* 存储不可用 → 内存兜底 */ }
    return this._mem;
  },
  _write(obj) {
    this._mem = obj;
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        if (obj) localStorage.setItem(REINCARNATE_KEY, JSON.stringify(obj));
        else localStorage.removeItem(REINCARNATE_KEY);
      }
    } catch (e) { /* 存储不可用 → 内存兜底 */ }
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
    this._write({ talentId, talentName: t.name || talentId, ratio, attrs, ts: typeof Date !== 'undefined' ? Date.now() : 0 });
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
