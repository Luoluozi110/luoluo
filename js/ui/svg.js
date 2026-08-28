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
  // 平韵格：横笛 + 平缓声纹；与仄韵的折转笔势组成一对声调语法。
  ping: glyphCell(`
    <path d="M3.2 13.8c4.2-2.1 7.2-2.1 10.2 0s5.2 2.1 7.4.6" class="ta-green ta-1" opacity=".66"/>
    <path d="M4.1 9.2 19.9 6.8l.7 4.4L4.8 13.6z" fill="#79a96c" class="ta-green ta-2"/>
    <path d="m6.4 8.9.7 4.3M17.3 7.2l.7 4.3" class="ta-gold ta-1"/>
    <circle cx="9.6" cy="10.1" r=".85" fill="#f4eccf"/><circle cx="13" cy="9.55" r=".85" fill="#f4eccf"/><circle cx="16.1" cy="9.1" r=".85" fill="#f4eccf"/>
    <path d="M5 17.2c3.4-1.2 6.1-1.2 8.9 0 2.5 1.1 4.7 1.1 6.1.4" class="ta-blue ta-1" opacity=".72"/>`),
  // 仄韵格：斜置墨笔 + 折转节拍纹。
  ze: glyphCell(`
    <path d="m3.4 17.6 4-4.2 3.3 2.3 3.8-5.1 3 2.2 3.1-5" class="ta-blue ta-2"/>
    <path d="M5 20.2c2.7-.2 4.8-.8 6.1-2.1" class="ta-brown ta-1" opacity=".72"/>
    <path d="M7.1 17.9 17.8 4.4l2.8 2.2L9.7 19.8z" fill="#8a6648" class="ta-brown ta-2"/>
    <path d="m17.8 4.4 1.6-1.3 2.7 2.1-1.5 1.4z" fill="#d7b45b" class="ta-gold ta-1"/>
    <path d="m7.1 17.9-2.4 3.2 5-1.3z" fill="#2d2b34"/>
    <path d="M18.4 5.3 8.6 18.5" class="ta-gold ta-1" opacity=".55"/>`),
  // 考题格：展开的科举试卷 + 朱砂小印。
  quiz: glyphCell(`
    <path d="M3.6 6.2c3.2-.8 6-.4 8.4 1.1 2.4-1.5 5.2-1.9 8.4-1.1v12.1c-3.2-.7-6-.3-8.4 1.3-2.4-1.6-5.2-2-8.4-1.3z" fill="#f4e8c9" class="ta-brown ta-2"/>
    <path d="M12 7.3v12.2M6.2 9.5c1.6-.2 2.9 0 4 .6M6.2 12.2c1.5-.2 2.8 0 3.9.5M13.8 9.9c1.5-.6 2.8-.8 4-.5" class="ta-brown ta-1" opacity=".78"/>
    <path d="M15 13.1h3.1v3.1H15z" fill="#b94b42" class="ta-zhu ta-1"/>
    <path d="m5 5.4.6-1.6M19 5.4l-.6-1.6" class="ta-gold ta-2"/>`),
  // 奇遇格：桃色锦囊 + 祥云，去除现代问号。
  event: glyphCell(`
    <path d="M7.2 7.1c1.8-1.2 3.4-1.7 4.8-1.7s3 .5 4.8 1.7l-1.2 2.4H8.4z" fill="#d68aa1" class="ta-taohua ta-2"/>
    <path d="M8.3 9.2h7.4c1.8 2.1 2.7 4.2 2.4 6.2-.4 3-2.8 4.9-6.1 4.9s-5.7-1.9-6.1-4.9c-.3-2 .6-4.1 2.4-6.2z" fill="#efb3c3" class="ta-taohua ta-2"/>
    <path d="M7.5 9.4c2.9 1 6.1 1 9 0M10.8 5.7 9.7 3.9M13.2 5.7l1.1-1.8" class="ta-gold ta-1"/>
    <path d="M12 11.7c.6-1 2.2-.4 1.7.8 1.3-.3 1.7 1.4.5 1.8.9.8-.2 2.1-1.2 1.3-.1 1.3-1.9 1.3-2 0-1 .8-2.1-.5-1.2-1.3-1.2-.4-.8-2.1.5-1.8-.5-1.2 1.1-1.8 1.7-.8z" fill="#fff1cf" class="ta-gold ta-1"/>
    <path d="M3.1 13.8c1.2-1.4 2.3-1.8 3.5-1.2M17.4 12.6c1.2-.6 2.3-.2 3.5 1.2" class="ta-blue ta-1" opacity=".72"/>`),
  // 论战格：朱漆战鼓 + 交叉鼓槌。
  battle: glyphCell(`
    <path d="M6.2 8.4 3.7 4.1M17.8 8.4l2.5-4.3M4.3 4.1l2.1-1.2M19.7 4.1l-2.1-1.2" class="ta-brown ta-2"/>
    <path d="M5.2 8.1h13.6v9.3H5.2z" fill="#ad3d35" class="ta-zhu ta-2"/>
    <ellipse cx="12" cy="8.2" rx="6.8" ry="2.35" fill="#ead39b" class="ta-brown ta-2"/>
    <ellipse cx="12" cy="8.2" rx="4.8" ry="1.35" fill="#f4e7c5" class="ta-gold ta-1"/>
    <path d="M5.5 12.7h13M7.3 17.5l-1.1 2.4M16.7 17.5l1.1 2.4" class="ta-gold ta-1"/>
    <circle cx="6.2" cy="10.5" r=".7" fill="#f4d77a"/><circle cx="17.8" cy="10.5" r=".7" fill="#f4d77a"/><circle cx="6.2" cy="15" r=".7" fill="#f4d77a"/><circle cx="17.8" cy="15" r=".7" fill="#f4d77a"/>`),
  // 天象格：靛青浑仪 + 月牙星芒。
  sky: glyphCell(`
    <circle cx="12" cy="11.8" r="8.5" fill="#34456f" class="ta-blue ta-2"/>
    <ellipse cx="12" cy="11.8" rx="8.1" ry="3.9" transform="rotate(-24 12 11.8)" class="ta-gold ta-1"/>
    <ellipse cx="12" cy="11.8" rx="3.8" ry="8" transform="rotate(28 12 11.8)" class="ta-blue ta-1"/>
    <path d="M10.8 7.3a4 4 0 1 0 4.4 5.8A4.7 4.7 0 0 1 10.8 7.3z" fill="#f6df8b"/>
    <path d="m17.5 5 .65 1.45 1.55.2-1.15 1.05.3 1.5-1.35-.75-1.35.75.3-1.5-1.15-1.05 1.55-.2z" fill="#fff1a8"/>
    <path d="M8.8 20.1h6.4M10.2 20.1v1.2M13.8 20.1v1.2" class="ta-brown ta-2"/>`),
  // 岔路格：分叉箭头
  branch_gate: glyphCell(`
    <path d="M12 21V12.6" class="ta-brown ta-3"/>
    <path d="M12 13 6.4 7.1M12 13l5.6-5.9" class="ta-brown ta-3"/>
    <path d="M4.4 5.4h6.1L8.7 7.2l1.8 1.8H4.4zM19.6 5.4h-6.1l1.8 1.8L13.5 9h6.1z" fill="#d5a451" class="ta-brown ta-1"/>
    <path d="M9 20.8h6" class="ta-green ta-2"/>`),
  // 访胜格：月洞门框景，不再使用会遮格的独立建筑轮廓。
  mingjing: glyphCell(`
    <path d="M4 20V10.5C4 6.2 7.6 3 12 3s8 3.2 8 7.5V20z" fill="#ead8b2" class="ta-brown ta-2"/>
    <path d="M7 20v-8.7C7 8 9.2 6 12 6s5 2 5 5.3V20z" fill="#b9d9d4" class="ta-blue ta-1"/>
    <path d="m7.4 16.5 3.5-4.2 2.1 2.3 2.1-3 1.9 2.1V20H7z" fill="#648b73" class="ta-green ta-1"/>
    <path d="M15.2 9.1c1.8-.2 3-1.1 3.8-2.4-.1 1.9-.9 3.1-2.5 3.7" class="ta-taohua ta-1"/>
    <circle cx="18.7" cy="6.2" r="1.1" fill="#ed9db5"/><circle cx="16.7" cy="8.3" r=".8" fill="#f7c0d0"/>
    <path d="M3 20h18" class="ta-brown ta-2"/>`),
  // 起点：线装书函叠册 + 朱砂书签。
  start: glyphCell(`
    <path d="M4.1 5.2h13.7l2.1 2.2-2.1 2.2H4.1z" fill="#e8ce91" class="ta-brown ta-2"/>
    <path d="M5.2 9.6h14.2v4.8H5.2z" fill="#f4e4bd" class="ta-brown ta-2"/>
    <path d="M3.5 14.4h14.2l2.3 2.2-2.3 2.3H3.5z" fill="#d7b66c" class="ta-brown ta-2"/>
    <path d="M7 6.4v2M8.8 6.4v2M8 10.8v2.4M9.8 10.8v2.4M6.4 15.7v2" class="ta-zhu ta-1"/>
    <path d="M15.1 5.2v8.4l1.8-1.25 1.8 1.25V6.2" fill="#b9443c" class="ta-zhu ta-1"/>
    <path d="M5.2 20.7h13.6" class="ta-gold ta-2"/>`),
  // 阶段门：科举牌楼 + 朱色门槛，区别于起点书册。
  gate: glyphCell(`
    <path d="M3 7.1h18L17.9 4H6.1z" fill="#b84a3d" class="ta-zhu ta-2"/>
    <path d="M5.1 10.1h13.8L17 7.1H7z" fill="#e7c66f" class="ta-brown ta-1"/>
    <path d="M6.2 10.1v9.4M17.8 10.1v9.4" class="ta-brown ta-3"/>
    <path d="M9.1 10.2v7.2h5.8v-7.2" fill="#8d4f3c" class="ta-brown ta-2"/>
    <path d="M4.4 19.5h15.2M8.2 21.2h7.6" class="ta-zhu ta-2"/>
    <circle cx="12" cy="8.7" r="1.25" fill="#b9443c" class="ta-zhu ta-1"/>`),
  landmark: glyphCell(`
    <circle cx="12" cy="12" r="8.6" fill="#f1d8c5" class="ta-brown ta-2"/>
    <path d="M12 5.1c.7 2.2 2.1 3.3 4.2 3.4-1.8 1.3-2.4 2.9-1.7 4.9-1.7-1.2-3.4-1.2-5.1 0 .7-2-.1-3.6-1.8-4.9 2.2-.1 3.6-1.2 4.4-3.4z" fill="#e889a8" class="ta-taohua ta-1"/>
    <circle cx="12" cy="10.3" r="1.45" fill="#f5d66f"/>
    <path d="M12 15v5M8.5 20h7" class="ta-green ta-2"/>`)
};

/** 优先使用格子类型的视觉语义；仅当类型没有专属资产时才接受配置中的兼容图标。 */
export function cellGlyphKey(cell = {}) {
  const type = String(cell.type || '');
  const configured = String(cell.icon || '');
  if (CELL_GLYPH[type]) return type;
  if (CELL_GLYPH[configured]) return configured;
  return type || configured;
}

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

/* ------------------------------------------------- 棋盘中央园景
   参考「园林即棋盘」的空间叙事：湖面、环形石岸、岛心亭与引桥共同承担视觉锚点。
   全部复用 ta-soft-lg / ta-vol，不新增 gradient / filter id，省电档可统一关闭柔影。 */
export const CENTER_GARDEN_ART = S(
  `<ellipse cx="180" cy="278" rx="138" ry="18" fill="rgba(30,40,34,.24)"/>` +
  objGroup(`
    <ellipse cx="180" cy="152" rx="164" ry="125" fill="#d9cfb3" class="ta-brown ta-3"/>
    <ellipse cx="180" cy="150" rx="148" ry="109" fill="#4ba9b3" class="ta-qing ta-3"/>
    <ellipse cx="180" cy="150" rx="148" ry="109" fill="url(#ta-vol)" opacity=".34"/>
    <path d="M40 158c32-16 52-10 78 3s49 17 76 3 55-19 86-4 49 12 70 2" class="ta-white ta-1" opacity=".38"/>
    <path d="M55 118c25-11 43-8 61 1M246 105c25-10 43-8 59 1M76 203c20 8 36 8 54 0" class="ta-white ta-1" opacity=".32"/>

    <ellipse cx="180" cy="158" rx="72" ry="51" fill="#746d54" class="ta-brown ta-2"/>
    <ellipse cx="180" cy="148" rx="68" ry="46" fill="#78965a" class="ta-green ta-3"/>
    <path d="M119 159c22-12 39-11 58 1s38 11 64-2v27c-35 17-91 17-122 0z" fill="#6c7652" opacity=".72"/>

    <path d="M170 190h20l25 79h-70z" fill="#d7ccb0" class="ta-brown ta-2"/>
    <path d="M174 198h12M169 216h22M163 235h34M157 254h46" class="ta-white ta-1" opacity=".72"/>
    <path d="M170 190h20M145 269h70" class="ta-brown ta-3"/>

    <ellipse cx="129" cy="106" rx="25" ry="12" fill="#5b7d4a"/>
    <path d="M129 112V74" class="ta-brown ta-3"/>
    <circle cx="117" cy="73" r="17" fill="#6f9a56" class="ta-green ta-2"/>
    <circle cx="137" cy="66" r="21" fill="#86aa63" class="ta-green ta-2"/>
    <circle cx="151" cy="82" r="16" fill="#6f9355" class="ta-green ta-2"/>
    <circle cx="128" cy="61" r="5" fill="#fff" opacity=".14"/>

    <ellipse cx="239" cy="123" rx="25" ry="11" fill="#5b7448"/>
    <path d="M239 128V91" class="ta-brown ta-3"/>
    <circle cx="224" cy="91" r="16" fill="#759653" class="ta-green ta-2"/>
    <circle cx="243" cy="80" r="20" fill="#89a95e" class="ta-green ta-2"/>
    <circle cx="257" cy="97" r="15" fill="#6b8e50" class="ta-green ta-2"/>
    <circle cx="238" cy="74" r="5" fill="#fff" opacity=".14"/>

    <ellipse cx="180" cy="173" rx="43" ry="10" fill="rgba(38,42,34,.26)"/>
    <rect x="151" y="125" width="58" height="43" rx="3" fill="#ead7ad" class="ta-brown ta-2"/>
    <rect x="159" y="132" width="7" height="36" fill="#8f4b32"/>
    <rect x="176" y="132" width="7" height="36" fill="#8f4b32"/>
    <rect x="193" y="132" width="7" height="36" fill="#8f4b32"/>
    <path d="M139 129h82l-16-15h-50z" fill="#173f4a" class="ta-ln ta-3"/>
    <path d="M146 114h68l-17-15h-34z" fill="#286170" class="ta-ln ta-3"/>
    <path d="M134 128c19 1 29-4 38-11M226 128c-19 1-29-4-38-11" class="ta-gold ta-2"/>
    <path d="M157 145h46M148 169h64" class="ta-brown ta-3"/>
    <rect x="171" y="143" width="18" height="25" fill="#4f3326"/>
    <circle cx="180" cy="98" r="4" fill="#e3b85e"/>
  `) +
  `<ellipse cx="137" cy="115" rx="20" ry="10" fill="#fff" opacity=".12"/>
   <g opacity=".92">
     <ellipse cx="73" cy="175" rx="13" ry="6" fill="#5e8c52" transform="rotate(-12 73 175)"/>
     <circle cx="73" cy="175" r="3" fill="#f4a4bc"/>
     <ellipse cx="291" cy="150" rx="14" ry="6" fill="#699554" transform="rotate(10 291 150)"/>
     <circle cx="291" cy="149" r="3" fill="#f4a4bc"/>
     <ellipse cx="263" cy="206" rx="12" ry="5" fill="#5d8a50" transform="rotate(-18 263 206)"/>
   </g>`
, '0 0 360 300');

/* ------------------------------------------------- 对决人物半身像
   以盘内 Q 版棋子为基准，提供应试者 / 对手两套高辨识剪影；仅复用共享体积与柔影。 */
const scholarPortrait = ({ robe, robeDeep, disk, hat, accent, beard = false }) => S(
  `<ellipse cx="48" cy="89" rx="31" ry="5" fill="rgba(0,0,0,.24)"/>` +
  objGroup(`
    <circle cx="48" cy="45" r="39" fill="${disk}" class="ta-brown ta-2"/>
    <circle cx="48" cy="45" r="39" fill="url(#ta-vol)" opacity=".22"/>
    <path d="M18 90c3-24 14-35 30-35s27 11 30 35z" fill="${robe}" class="ta-ln ta-2"/>
    <path d="M34 89c1-18 5-28 14-28s13 10 14 28z" fill="${robeDeep}"/>
    <path d="M40 61l8 11 8-11" fill="#f5ead1" class="ta-brown ta-1"/>
    <circle cx="48" cy="38" r="19" fill="#f2ceb0" class="ta-brown ta-1"/>
    <path d="M29 36c1-16 9-25 19-25s18 9 19 25c-5-8-11-11-19-11S34 28 29 36z" fill="${hat}"/>
    <path d="M34 24h28l-4-9H38z" fill="${hat}" class="ta-ln ta-2"/>
    <circle cx="41" cy="39" r="2" fill="#2b2622"/><circle cx="55" cy="39" r="2" fill="#2b2622"/>
    <circle cx="41.5" cy="38.5" r=".55" fill="#fff"/><circle cx="55.5" cy="38.5" r=".55" fill="#fff"/>
    ${beard ? `<path d="M43 48q5 3 10 0M45 50l3 9 3-9" class="ta-brown ta-2"/>` : `<path d="M44 48q4 3 8 0" class="ta-brown ta-1"/>`}
    <path d="M68 62l8 25" class="ta-brown ta-3"/><path d="M75 85l4 7-6-1z" fill="#2b2622"/>
    <circle cx="25" cy="20" r="5" fill="${accent}" opacity=".78"/>
  `) +
  `<ellipse cx="36" cy="28" rx="8" ry="5" fill="#fff" opacity=".13"/>`
, '0 0 96 96');

export const SCHOLAR_PORTRAIT = {
  self: scholarPortrait({ robe: '#4f8ca5', robeDeep: '#2f667e', disk: '#e8f1df', hat: '#273331', accent: '#6ab3b5' }),
  opponent: scholarPortrait({ robe: '#a85643', robeDeep: '#73372f', disk: '#f0dfcf', hat: '#392821', accent: '#d5a044', beard: true })
};

/* ------------------------------------------------- 模态叙事插画
   奇遇按“抉择 / 挑战 / 获赠”分三类，题卡使用独立卷册印记；都保持短宽构图，
   不挤压正文的第一屏阅读空间。 */
export const EVENT_VIGNETTE = {
  choice: S(objGroup(`
    <path d="M28 61c24-7 34-22 42-43 10 21 22 35 48 43" class="ta-brown ta-3"/>
    <path d="M70 18v48" class="ta-brown ta-3"/>
    <path d="M70 42L43 24M70 42l29-20" class="ta-brown ta-2"/>
    <circle cx="41" cy="23" r="7" fill="#f0a2b8"/><circle cx="101" cy="21" r="7" fill="#e0b85f"/>
    <path d="M20 64h112" class="ta-brown ta-2"/>
  `), '0 0 150 78'),
  challenge: S(objGroup(`
    <rect x="46" y="25" width="58" height="34" rx="12" fill="#b44839" class="ta-zhu ta-2"/>
    <ellipse cx="75" cy="25" rx="29" ry="9" fill="#e8c985" class="ta-brown ta-2"/>
    <path d="M46 42h58M35 14l18 13M115 14L97 27" class="ta-gold ta-3"/>
    <circle cx="35" cy="14" r="5" fill="#7b5236"/><circle cx="115" cy="14" r="5" fill="#7b5236"/>
    <path d="M30 64h90" class="ta-brown ta-2"/>
  `), '0 0 150 78'),
  encounter: S(objGroup(`
    <path d="M36 20h78v42H36z" fill="#f1e4c7" class="ta-brown ta-2"/>
    <path d="M31 18h88v8H31zM31 58h88v8H31z" fill="#8d6a45" class="ta-brown ta-2"/>
    <path d="M50 34h50M50 43h38M50 52h44" class="ta-brown ta-2"/>
    <circle cx="107" cy="49" r="10" fill="#b23a2e" opacity=".82"/>
    <path d="M103 49h8M107 45v8" class="ta-gold ta-1"/>
  `), '0 0 150 78')
};

export const QUIZ_MARK = S(objGroup(`
  <circle cx="36" cy="36" r="31" fill="#efe2c5" class="ta-brown ta-2"/>
  <path d="M20 20h32v35H20z" fill="#f8efd9" class="ta-brown ta-2"/>
  <path d="M25 28h22M25 36h18M25 44h22" class="ta-brown ta-2"/>
  <path d="M50 17l7 7-15 27-8 4 1-9z" fill="#395d60" class="ta-qing ta-2"/>
  <circle cx="21" cy="17" r="4" fill="#b23a2e"/>
`), '0 0 72 72');

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
  <path d="M0 220L0 150 120 96 240 148 360 78 500 140 620 92 760 152 900 84 1040 146 1180 96 1320 152 1460 104 1600 156 1600 220z" fill="#6f8fa2"/>
  <path d="M0 220L0 178 140 140 300 182 460 132 620 180 800 138 960 184 1120 142 1300 186 1460 148 1600 190 1600 220z" fill="#8eabb8"/>
</svg>`;

/* ------------------------------------------------- 通用 */
export const STAR_ICON = S(`<path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8z" fill="#ffe08a"/>`);

export function glyph(type) { return CELL_GLYPH[type] || ''; }
