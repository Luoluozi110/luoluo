/**
 * quality.js —— 设备性能分级 + 降级档预算
 *
 * 作用：在移动端 / 低端机上自动收束特效，锁死帧时间预算，避免无谓掉帧。
 * 等级：
 *   high —— 默认档，PC / 强机，开满氛围层与柔影。
 *   low  —— 省电档，移动 / 弱机，关掉最贵的几项（全屏噪点混合、bloom、
 *           SVG 柔影、格子大模糊投影、远山），并拍平渐变（flatGraphics）、
 *           关遮罩模糊（blur）、画布锁 1x（precision）。
 *   档位预算见 BUDGETS：flatGraphics/blur 由 board.css 的
 *   html[data-quality="low"] 覆盖实时驱动；precision 由 precisionScale()
 *   供 album.js 成绩图绘制读取。
 *
 * 优先级（启动）：URL ?quality=high|low  >  localStorage 记忆  >  自动探测。
 * 运行时可用 setTier() 手动切换，CSS 驱动的部分实时生效，JS 驱动的花瓣数
 * 由 board.applyQuality() 重新生成。
 */

const STORE_KEY = 'feihuaqi_quality';

/* 每档预算：所有数值在 board.css / board.js 中被读取或据此生成 CSS 覆盖 */
export const BUDGETS = {
  high: {
    label: '高画质',
    petals: 22,          // 桃花瓣数量
    glyphShadow: true,   // 格子图标 SVG 柔影（CSS 覆盖关闭）
    landmarkShadow: true,// 名胜 / 徽记 SVG 柔影
    ambientNoise: true,  // #scene::before 纸纹噪点（最贵：全屏 feTurbulence + overlay 混合）
    bloom: true,         // #scene::after 顶部暖光 bloom
    farHills: true,      // 远山剪影
    cellSoftShadow: true,// 格子大模糊投影（box-shadow 12px）
    flatGraphics: false, // 是否保留体积渐变 / 柔影细节（false=保留；low 档拍平为实色）
    blur: true,          // 弹窗 / 遮罩的 backdrop-filter 模糊是否开启（CSS 驱动）
    precision: 'high'    // 渲染精度：high=画布按 DPR 提像素比；low=锁 1x 省显存与导出体积
  },
  low: {
    label: '省电档',
    petals: 6,
    glyphShadow: false,
    landmarkShadow: false,
    ambientNoise: false,
    bloom: false,
    farHills: false,
    cellSoftShadow: false,
    flatGraphics: true,  // 拍平渐变→实色（board.css 实色背景 + 徽记填充覆盖）
    blur: false,         // 关掉最贵的 backdrop-filter 模糊（board.css 覆盖）
    precision: 'low'     // 画布锁 1x，降低内存占用与 toDataURL 体积
  }
};

/**
 * 画布 backing-store 倍率：高分档按设备像素比提清晰，省电档锁 1x。
 * 用于 album.js 成绩图绘制——高分档更锐利，省电档更省显存/导出体积。
 */
export function precisionScale() {
  const p = getBudget().precision;
  if (p === 'low') return 1;
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  return Math.min(dpr, 2);
}

function prefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/** 自动探测：触摸 + 小屏/少核，或 少核 + 低内存，或系统要求减少动态效果 → 省电档 */
export function detectTier() {
  if (prefersReducedMotion()) return 'low';
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 760;
  const cores = navigator.hardwareConcurrency || 8;
  const mem = navigator.deviceMemory || 8;        // 仅 Chromium 系支持，缺失按 8 处理
  if (coarse && (small || cores <= 4)) return 'low';
  if (cores <= 4 && mem <= 4) return 'low';
  return 'high';
}

let _tier = null;

export function getTier() { return _tier || 'high'; }

export function getBudget() { return BUDGETS[_tier] || BUDGETS.high; }

export function isLow() { return getTier() === 'low'; }

function writeAttr(tier) {
  document.documentElement.setAttribute('data-quality', tier);
}

function remember(tier) {
  try { localStorage.setItem(STORE_KEY, tier); } catch (e) { /* 隐私模式可能抛错，忽略 */ }
}

function applyTier(tier) {
  _tier = BUDGETS[tier] ? tier : detectTier();
  writeAttr(_tier);
  remember(_tier);
  return _tier;
}

/** 启动入口：URL 覆盖 > 记忆 > 自动探测 */
export function initQuality() {
  const qp = new URLSearchParams(location.search).get('quality');
  if (qp === 'high' || qp === 'low') { applyTier(qp); return _tier; }
  let saved = null;
  try { saved = localStorage.getItem(STORE_KEY); } catch (e) { /* ignore */ }
  if (saved === 'high' || saved === 'low') { applyTier(saved); return _tier; }
  return applyTier(detectTier());
}

/** 运行时手动切换（菜单按钮调用） */
export function setTier(tier) { return applyTier(tier); }
