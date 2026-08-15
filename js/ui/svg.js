/** svg.js —— 纯 CSS/SVG 绘制的图形资产（不使用 emoji） */

const S = (inner, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

/* ------------------------------------------------- 资产助手：统一包裹共享柔影
   - 引用 ensureDefs() 注入的 ta-* 资源，避免每资产内联同名 def（重复 id 会让
     url(#id) 错解析）；
   - 柔影写在内部 <g filter> 「呈现属性」上（非 CSS），以便省电档
     html[data-quality="low"] .cell .glyph g { filter:none } 能一键实时关闭。
   新增题型图标 / 名胜 / 流派徽记一律走这两个助手，禁止手写 filter 字面量。 */
export function glyphCell(inner, vb = '0 0 24 24') {
  return S(`<g filter="url(#ta-soft)">${inner}</g>`, vb);
}
export function objGroup(inner) {
  return `<g filter="url(#ta-soft-lg)">${inner}</g>`;
}

/* ------------------------------------------------- 共享体积资源（一次性注入）
   内联 SVG 的 gradient/filter 在文档作用域内 id 必须唯一；若每个格子都内联同名
   def，60+ 重复 id 会让 url(#id) 全部解析到第一个，且无效 HTML。
   故把所有可复用渐变/柔影抽到一份隐藏 <defs>，全资产引用同一份。 */
let _defsInjected = false;
export function ensureDefs() {
  if (_defsInjected) return;
  if (document.getElementById('ta-defs')) { _defsInjected = true; return; }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'ta-defs';
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.innerHTML = `<defs>
    <radialGradient id="ta-vol" cx="35%" cy="30%" r="78%">
      <stop offset="0" stop-color="#fff" stop-opacity=".5"/>
      <stop offset="44%" stop-color="#fff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity=".34"/>
    </radialGradient>
    <linearGradient id="ta-vol-lin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".4"/>
      <stop offset=".5" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".28"/>
    </linearGradient>
    <filter id="ta-soft" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="1.4" stdDeviation="1.3" flood-color="#000" flood-opacity=".3"/>
    </filter>
    <filter id="ta-soft-lg" x="-45%" y="-45%" width="190%" height="190%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity=".36"/>
    </filter>
  </defs>`;
  document.body.appendChild(svg);
  _defsInjected = true;
}

/* ---------------------------------------------------- 格子图标
   所有描边改用 class="ta-颜色 ta-粗细"（见 board.css 描边令牌），禁止手写 stroke 字面量；
   粗细吸附到 --sw-1/2/3 三档，颜色引用主调色板。fill 保留。 */
export const CELL_GLYPH = {
  // 平韵格：竹叶
  ping: glyphCell(`
    <path d="M12 21V9" class="ta-green ta-2"/>
    <path d="M12 12c-4-1-6-4-6-7 3 0 6 2 6 6z" fill="#78ac5e"/>
    <path d="M12 15c4-1.2 6-4 6-7.4-3.2.2-6 2.2-6 6.2z" fill="#96c47b"/>`),
  // 仄韵格：砚台
  ze: glyphCell(`
    <ellipse cx="12" cy="15" rx="8" ry="4.6" fill="#524a41"/>
    <ellipse cx="12" cy="13.4" rx="6.2" ry="3.4" fill="#2b2622"/>
    <ellipse cx="10.6" cy="12.8" rx="2.6" ry="1.3" fill="#585049" opacity=".7"/>
    <path d="M17.5 6.5l-4.5 5.2" class="ta-brown ta-3"/>`),
  // 考题格：卷轴
  quiz: glyphCell(`
    <rect x="5" y="5" width="14" height="14" rx="2" fill="#f2e7cd" class="ta-brown ta-2"/>
    <path d="M8 9.5h8M8 12.5h8M8 15.5h5" class="ta-brown ta-2"/>
    <rect x="3.4" y="3.4" width="17.2" height="2.6" rx="1.3" fill="#8d6a45"/>
    <rect x="3.4" y="18" width="17.2" height="2.6" rx="1.3" fill="#8d6a45"/>`),
  // 奇遇格：祥云 + 问
  event: glyphCell(`
    <path d="M5 15.5c-1.6 0-2.6-1.1-2.6-2.4 0-1.3 1-2.3 2.3-2.4.2-2 1.9-3.5 3.9-3.5 1.5 0 2.8.8 3.4 2 .4-.2.9-.3 1.4-.3 1.8 0 3.2 1.4 3.3 3.1 1.4.1 2.5 1.2 2.5 2.6 0 1.4-1.2 2.6-2.6 2.6z" fill="#cfd9ef" class="ta-blue ta-1"/>
    <path d="M10.6 12.4c0-1 .7-1.6 1.6-1.6.9 0 1.6.6 1.6 1.4 0 1.2-1.5 1.2-1.5 2.3" class="ta-blue ta-2"/>
    <circle cx="12.3" cy="16.6" r=".9" fill="#4a5a80"/>`),
  // 论战格：擂鼓
  battle: glyphCell(`
    <rect x="5" y="8" width="14" height="9" rx="3.4" fill="#b23a2e" class="ta-zhu ta-2"/>
    <ellipse cx="12" cy="8" rx="7" ry="2.4" fill="#e6c98f" class="ta-zhu ta-1"/>
    <path d="M5 12.5h14" class="ta-gold ta-2"/>
    <path d="M17.5 5.5l3-2.4M6.5 5.5l-3-2.4" class="ta-brown ta-2"/>`),
  // 天象格：星盘
  sky: glyphCell(`
    <circle cx="12" cy="12" r="8" fill="#26345c" class="ta-blue ta-2"/>
    <circle cx="12" cy="12" r="4.4" class="ta-blue ta-1"/>
    <path d="M12 3.4l1.4 3 3.2.4-2.4 2.2.7 3.2L12 10.6 9.1 12.2l.7-3.2L7.4 6.8l3.2-.4z" fill="#ffe08a"/>`),
  // 岔路格：分叉箭头
  branch_gate: glyphCell(`
    <path d="M12 20V13" class="ta-brown ta-3"/>
    <path d="M12 13L6 6.5M12 13l6-6.5" class="ta-brown ta-3"/>
    <path d="M6 6.5l.4 3.4M6 6.5l3.4-.4M18 6.5l-.4 3.4M18 6.5l-3.4-.4" class="ta-brown ta-2"/>`),
  // 名胜格：楼阁（访胜抽签）
  mingjing: glyphCell(`
    <path d="M3.5 12l8.5-5 8.5 5z" fill="#b23a2e" class="ta-zhu ta-2"/>
    <path d="M5.5 12l6.5-3.8 6.5 3.8z" fill="#e6c98f" class="ta-brown ta-1"/>
    <rect x="7.5" y="12" width="9" height="6" rx="1" fill="#f0dcb4" class="ta-brown ta-2"/>
    <rect x="9.4" y="13.6" width="1.8" height="4.4" fill="#8d5a2a"/>
    <rect x="13" y="13.6" width="1.8" height="4.4" fill="#8d5a2a"/>
    <rect x="4.6" y="18" width="14.8" height="2" rx="1" fill="#b23a2e" class="ta-zhu ta-1"/>`),
  // 起点：书铺
  start: glyphCell(`
    <path d="M3.5 11L12 4.5 20.5 11" class="ta-brown ta-3" fill="#e5b657"/>
    <rect x="6" y="11" width="12" height="8.5" rx="1.2" fill="#f6e2b2" class="ta-brown ta-2"/>
    <rect x="10.2" y="14" width="3.6" height="5.5" rx=".6" fill="#b23a2e"/>`),
  landmark: glyphCell(`
    <path d="M12 3.6l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 8.9l5-.7z" fill="#e56a94" class="ta-taohua ta-1"/>`)
};

/* ------------------------------------------------- 名胜建筑（立牌） */
export const LANDMARK_ART = {
  shanshui: S(
    `<ellipse cx="32" cy="56" rx="26" ry="5" fill="rgba(0,0,0,.28)"/>` +
    objGroup(`
    <path d="M18 56V36" class="ta-brown ta-3"/><path d="M46 56V38" class="ta-brown ta-3"/>
    <circle cx="18" cy="30" r="13" fill="#f6a8c0"/><circle cx="46" cy="33" r="11" fill="#efc0d2"/>
    <circle cx="32" cy="22" r="14" fill="#f78fae"/>
    <circle cx="24" cy="26" r="2.2" fill="#fff" opacity=".7"/><circle cx="39" cy="30" r="1.8" fill="#fff" opacity=".7"/>`) +
    `<ellipse cx="32" cy="18" rx="11" ry="7" fill="#fff" opacity=".14"/>`
  , '0 0 64 62'),
  shuyuan: S(
    `<ellipse cx="32" cy="56" rx="24" ry="5" fill="rgba(0,0,0,.28)"/>` +
    objGroup(`
    <path d="M8 26L32 12l24 14z" fill="#5b6f52" class="ta-green ta-2"/>
    <rect x="13" y="26" width="38" height="28" fill="#f0e3c4" class="ta-brown ta-2"/>
    <rect x="27" y="36" width="10" height="18" fill="#8d5a2a"/>
    <rect x="17" y="32" width="7" height="7" fill="#c8dbe8" class="ta-brown ta-2"/>
    <rect x="40" y="32" width="7" height="7" fill="#c8dbe8" class="ta-brown ta-2"/>`) +
    `<ellipse cx="20" cy="20" rx="9" ry="5" fill="#fff" opacity=".14"/>
    <ellipse cx="32" cy="52" rx="18" ry="3" fill="#000" opacity=".10"/>`
  , '0 0 64 62'),
  yuyuan: S(
    `<ellipse cx="32" cy="56" rx="24" ry="5" fill="rgba(0,0,0,.28)"/>` +
    objGroup(`
    <path d="M6 24Q32 6 58 24z" fill="#c9432f" class="ta-zhu ta-2"/>
    <path d="M18 24v30M46 24v30M32 24v30" class="ta-brown ta-3"/>
    <rect x="12" y="50" width="40" height="5" rx="1.5" fill="#e0cf9f" class="ta-brown ta-2"/>
    <path d="M12 34h40" class="ta-brown ta-3"/>
    <circle cx="32" cy="18" r="3.4" fill="#f0d574"/>`) +
    `<ellipse cx="32" cy="16" rx="12" ry="6" fill="#fff" opacity=".14"/>`
  , '0 0 64 62'),
  biansai: S(
    `<ellipse cx="32" cy="56" rx="25" ry="5" fill="rgba(0,0,0,.28)"/>` +
    objGroup(`
    <rect x="8" y="26" width="48" height="28" fill="#d9c39b" class="ta-brown ta-2"/>
    <path d="M8 26v-6h6v6M20 26v-6h6v6M32 26v-6h6v6M44 26v-6h6v6" fill="#d9c39b" class="ta-brown ta-2"/>
    <path d="M24 54V38a8 8 0 0116 0v16z" fill="#5a4632"/>
    <path d="M8 40h48" class="ta-brown ta-2"/>`) +
    `<ellipse cx="24" cy="22" rx="9" ry="5" fill="#fff" opacity=".12"/>`
  , '0 0 64 62')
};

/* ------------------------------------------------- 流派徽记 */
export const SCHOOL_EMBLEM = {
  shi: S(objGroup(`
    <circle cx="32" cy="32" r="28" fill="#fdf1d6" class="ta-jin ta-3"/>
    <circle cx="32" cy="32" r="28" fill="url(#ta-vol)"/>
    <path d="M20 40c6-3 8-9 8-16" class="ta-jin ta-3"/>
    <path d="M22 22h20M26 30h14" class="ta-jin ta-3"/>
    <circle cx="42" cy="42" r="6" fill="#f0a2b8"/>`), '0 0 64 64'),
  ci: S(objGroup(`
    <circle cx="32" cy="32" r="28" fill="#e8f4f3" class="ta-qing ta-3"/>
    <circle cx="32" cy="32" r="28" fill="url(#ta-vol)"/>
    <path d="M16 40q8-14 16 0t16-6" class="ta-qing ta-3"/>
    <path d="M20 22h24" class="ta-qing ta-3"/>
    <circle cx="32" cy="46" r="4" fill="#a8dcdd"/>`), '0 0 64 64'),
  lian: S(objGroup(`
    <circle cx="32" cy="32" r="28" fill="#fbe4ec" class="ta-taohua ta-3"/>
    <circle cx="32" cy="32" r="28" fill="url(#ta-vol)"/>
    <rect x="17" y="14" width="9" height="36" rx="3" fill="#cf6486"/>
    <rect x="38" y="14" width="9" height="36" rx="3" fill="#cf6486"/>
    <path d="M21.5 22v20M42.5 22v20" class="ta-white ta-3"/>`), '0 0 64 64'),
  xue: S(objGroup(`
    <circle cx="32" cy="32" r="28" fill="#f2ecdc" class="ta-brown ta-3"/>
    <circle cx="32" cy="32" r="28" fill="url(#ta-vol)"/>
    <path d="M14 20h16v26H14zM34 20h16v26H34z" fill="#e0cf9f" class="ta-brown ta-3"/>
    <path d="M32 18v30" class="ta-brown ta-3"/>`), '0 0 64 64'),
  si: S(objGroup(`
    <circle cx="32" cy="32" r="28" fill="#eee6f6" class="ta-purple ta-3"/>
    <circle cx="32" cy="32" r="28" fill="url(#ta-vol)"/>
    <path d="M32 12l5 12 12 2-9 8 3 13-11-7-11 7 3-13-9-8 12-2z" fill="#a98fd0" class="ta-purple ta-2"/>`), '0 0 64 64'),
  bi: S(objGroup(`
    <circle cx="32" cy="32" r="28" fill="#fdf3e2" class="ta-mo ta-3"/>
    <circle cx="32" cy="32" r="28" fill="url(#ta-vol)"/>
    <path d="M40 14c-2 4-5 7-8 10l-2 2 6 6 3-2c3-2 5-6 7-8-1-4-4-7-6-8z" fill="#33302a" class="ta-mo ta-2"/>
    <path d="M30 27l7 7-13 13c-2 2-6 2-8-1 3-2 2-5 0-8l-1 0c1-5 6-8 10-8l5-3z" fill="#cf6486" class="ta-mo ta-2"/>`), '0 0 64 64')
};

/* ------------------------------------------------- 远山 */
export const FAR_HILLS = `<svg viewBox="0 0 1600 220" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M0 220L0 150 120 96 240 148 360 78 500 140 620 92 760 152 900 84 1040 146 1180 96 1320 152 1460 104 1600 156 1600 220z" fill="#5a4459"/>
  <path d="M0 220L0 178 140 140 300 182 460 132 620 180 800 138 960 184 1120 142 1300 186 1460 148 1600 190 1600 220z" fill="#3d2f3d"/>
</svg>`;

/* ------------------------------------------------- 通用 */
export const STAR_ICON = S(`<path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8z" fill="#ffe08a"/>`);

export function glyph(type) { return CELL_GLYPH[type] || ''; }
