/** 静态园景：沿用棋盘 SVG 描边与共享柔影，不新增位图或动画。 */
import { objGroup, LANDMARK_ART } from './svg.js?v=20260831firstrun1';

const art = content => `<svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
const blossom = (x, y, color = '#e6a5b0') => `<g transform="translate(${x} ${y})"><path d="M0-7C8-12 11-2 5 1C12 7 3 13 0 6C-6 13-12 5-5 1C-12-4-5-12 0-7Z" fill="${color}"/><circle r="2" fill="#d3ab60"/></g>`;
export const SEASON_ART = Object.freeze({
  spring: art(`<ellipse cx="59" cy="76" rx="45" ry="7" fill="#98b8a7" opacity=".16"/>
    <path d="M23 77Q40 51 51 27M34 61Q61 62 88 41M47 36 31 19M55 59 74 20" class="ta-brown ta-3"/>
    <path d="M37 51q-19 0-19-14 18 0 19 14M65 51q19-3 24 8-18 9-24-8" fill="#80a58a"/>
    ${[[31,19],[49,28],[73,21],[89,41],[59,49],[40,63]].map(([x,y])=>blossom(x,y)).join('')}
    ${blossom(84,74,'#f0ced4')}${blossom(99,69,'#ecd0cb')}`),
  summer: art(`<ellipse cx="60" cy="72" rx="48" ry="10" fill="#9cc8bd" opacity=".35"/>
    <path d="M18 80q35 9 69 0M32 62q-3-19 5-31M66 66q-1-20 10-34" class="ta-qing ta-1"/>
    <path d="M18 64C10 41 46 40 57 57L35 62 55 65C43 77 26 77 18 64Z" fill="#7caa93"/>
    <path d="M69 65c-8-16 22-27 32-10L83 62l17 2c-7 10-22 12-31 1Z" fill="#a0bd97"/>
    <path d="M57 42q-19-3-17-18 13 0 17 9 0-15 10-22 9 15 2 24 10-10 21-7-4 18-25 17Z" fill="#e6b2ba" class="ta-taohua ta-1"/>
    <path d="m65 44 0 21" class="ta-green ta-2"/>`),
  autumn: art(`<ellipse cx="62" cy="77" rx="45" ry="7" fill="#c6b78e" opacity=".18"/>
    <path d="M32 76 58 20M43 53 83 32M51 37 29 24" class="ta-brown ta-3"/>
    <path d="M58 29Q31 19 45 5q13 9 20-1 23 10-7 25Z" fill="#d3ad63"/>
    <path d="M33 35Q7 29 15 12q16 8 21-2 25 14-3 25Z" fill="#dfbd7d"/>
    <path d="M78 42Q54 29 66 15q9 11 23 4 20 18-11 23Z" fill="#c79a57"/>
    <path d="M43 61Q17 51 28 39q12 7 19 0 24 13-4 22Z" fill="#dfc68d"/>
    <path d="m72 74 10-9 12 9-10 5Z" fill="#d9b674"/>
    <path d="m97 69 5-7 8 5-4 6Z" fill="#bd9155"/>`),
  winter: art(`<ellipse cx="61" cy="77" rx="44" ry="7" fill="#a7bdb9" opacity=".2"/>
    <path d="M28 76Q41 51 73 24M43 56 35 28M61 36 91 42" class="ta-brown ta-3"/>
    <path d="M22 70q11-16 26-1l4 12H16ZM78 73q10-14 20-1l6 10H72Z" fill="#b8c9c5"/>
    <path d="M20 71q13-14 28 0M78 73q10-9 20 0" class="ta-white ta-3"/>
    ${[[35,28],[54,43],[73,24],[89,42]].map(([x,y])=>blossom(x,y,'#cf8f9d')).join('')}
    <path d="m36 28 9-4M63 30l13-9M85 40l9 3" class="ta-white ta-2"/>`)
});

const gateway = `<svg viewBox="0 0 64 62" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <ellipse cx="32" cy="57" rx="25" ry="4" fill="#53766b" opacity=".16"/>
  ${objGroup(`<path d="M14 55V25h6v30M44 55V25h6v30" fill="#a66e55" class="ta-brown ta-1"/>
    <path d="M8 25q12-4 24-17 12 13 24 17Z" fill="#567c70" class="ta-qing ta-2"/>
    <path d="M6 26h52M11 31h42" class="ta-brown ta-2"/>
    <rect x="23" y="22" width="18" height="10" rx="1" fill="#ece0bb" class="ta-gold ta-1"/>
    <path d="M27 27h10" class="ta-gold ta-1"/>
    <path d="M9 56h46l-4-5H13Z" fill="#d4d1ba" class="ta-brown ta-1"/>
    <path d="M24 12q8-5 16 0" class="ta-gold ta-1"/>`)}
</svg>`;

export function waypointArt(cell) {
  if (cell.type === 'gate' || cell.type === 'branch_gate') return gateway;
  if (cell.type === 'start') return LANDMARK_ART.shuyuan;
  if (cell.type === 'landmark') return LANDMARK_ART[cell.icon] || LANDMARK_ART.yuyuan;
  return '';
}

/** 和 board.js 使用同一格距；所有园景都留在当圈格子内侧的空白区。 */
export function gardenBounds(board, ringId) {
  const rings = board.layout === 'concentric_spiral' ? board.rings || [] : [];
  const maxGrid = Math.max(21, ...rings.map(r => Number(r.grid) || 0));
  const ring = rings.find(r => r.id === ringId) || rings[0];
  const grid = Number(ring?.grid) || 21;
  const offset = Math.floor((maxGrid - grid) / 2);
  return { min: offset, max: offset + grid - 1,
    inset: (3 + offset) * 46 + 54, size: Math.max(0, (grid - 1) * 46 - 66) };
}

/** 立牌朝路线内侧偏移。角点沿对角线放置，避免盖住相邻的两条边。 */
export function waypointOffset(col, row, bounds) {
  const x = col === bounds.min ? 1 : col === bounds.max ? -1 : 0;
  const y = row === bounds.min ? 1 : row === bounds.max ? -1 : 0;
  return { left: 21 + x * 70 - 32, top: 21 + y * 70 - 31 };
}
