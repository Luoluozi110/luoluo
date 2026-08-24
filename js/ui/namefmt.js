/**
 * namefmt.js —— 角色名注入（纯函数，无 DOM 依赖，便于单测）。
 *
 * 玩法背景：本作叙事采用第二人称「你」指称玩家。开局起名后，
 * 把叙事文本里的「你」替换为玩家自起之名，使名号贯穿奇遇 / 天象 / 文心 / 考题等文本。
 * 名字留空时（或默认值），维持原第二人称「你」，叙事不变。
 *
 * 约定：叙事数据（events / sky / talents / questions 的 text 字段）一律用「你」，
 * 由本函数统一替换，无需在数据中写占位符。
 */
const YOU = '你';
const NAME_MAX = 12;

/** 规整玩家输入的名字：去首尾空白、截断到上限；纯空白返回空串（代表「你」） */
export function normalizeName(raw) {
  const n = (raw == null ? '' : String(raw)).trim().slice(0, NAME_MAX);
  return n;
}

/**
 * 把 text 中的「你」替换为玩家名字；名字为空则原样返回（保留「你」）。
 * 同时支持传入 null/undefined 的 text，安全返回空串。
 * @param {string} text 叙事文本
 * @param {string} name 玩家名字（空 = 用「你」）
 */
export function personalize(text, name) {
  const n = normalizeName(name);
  if (!n) return text == null ? '' : String(text);
  return String(text == null ? '' : text).split(YOU).join(n);
}

/** 展示用：有名字返回「「名」」，否则返回「你」 */
export function playerLabel(name) {
  const n = normalizeName(name);
  return n ? `「${n}」` : '你';
}

export { NAME_MAX };
