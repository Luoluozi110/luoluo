/**
 * boardView.js —— 棋盘镜头模式、设备降级与投影尺寸工具。
 *
 * 桌面高画质默认启用 2.5D；用 ?boardView=flat 可显式关闭。屏幕平移、统一缩放与
 * 世界投影由三个独立 DOM 层承接，HUD 与模态始终留在屏幕空间。
 */

export const BOARD_VIEW_MODE = Object.freeze({
  FLAT: 'flat',
  PERSPECTIVE: '25d'
});

export const BOARD_VIEW_ANGLE_PRESETS = Object.freeze([
  Object.freeze({ angle: 20, label: '舒展' }),
  Object.freeze({ angle: 28, label: '标准' }),
  Object.freeze({ angle: 36, label: '俯瞰' })
]);

export const DEFAULT_BOARD_VIEW_ANGLE = 28;

const PROFILES = Object.freeze({
  flat: Object.freeze({
    mode: 'flat', perspective: 0, pitch: 0, yaw: 0, lift: 0,
    islandZ: 0, worldZ: 0, tileZ: 0, pieceZ: 0,
    billboardPitch: 0, billboardYaw: 0, screenYScale: 1
  }),
  '25d': Object.freeze({
    mode: '25d', perspective: 1500, pitch: DEFAULT_BOARD_VIEW_ANGLE, yaw: -0.6, lift: -18,
    islandZ: -18, worldZ: -3, tileZ: 8, pieceZ: 18,
    billboardPitch: -DEFAULT_BOARD_VIEW_ANGLE, billboardYaw: 0.6,
    screenYScale: Math.cos(DEFAULT_BOARD_VIEW_ANGLE * Math.PI / 180)
  })
});

export function normalizeBoardViewMode(value) {
  const v = String(value || '').trim().toLowerCase();
  return ['25d', '2.5d', 'perspective', 'tilt'].includes(v)
    ? BOARD_VIEW_MODE.PERSPECTIVE
    : BOARD_VIEW_MODE.FLAT;
}

export function resolveBoardViewMode(search = '') {
  let value = '';
  try { value = new URLSearchParams(String(search || '')).get('boardView') || ''; } catch (_) { /* ignore */ }
  return value ? normalizeBoardViewMode(value) : BOARD_VIEW_MODE.PERSPECTIVE;
}

export function normalizeBoardViewAngle(value) {
  const requested = Number(value);
  if (!Number.isFinite(requested)) return DEFAULT_BOARD_VIEW_ANGLE;
  return BOARD_VIEW_ANGLE_PRESETS.reduce((best, preset) =>
    Math.abs(preset.angle - requested) < Math.abs(best.angle - requested) ? preset : best
  ).angle;
}

export function resolveBoardViewAngle(search = '', storedValue = '') {
  let value = '';
  try { value = new URLSearchParams(String(search || '')).get('boardAngle') || ''; } catch (_) { /* ignore */ }
  return normalizeBoardViewAngle(value || storedValue);
}

export function boardViewAngleLabel(value) {
  const angle = normalizeBoardViewAngle(value);
  return BOARD_VIEW_ANGLE_PRESETS.find(preset => preset.angle === angle)?.label || '标准';
}

export function nextBoardViewAngle(value) {
  const angle = normalizeBoardViewAngle(value);
  const index = BOARD_VIEW_ANGLE_PRESETS.findIndex(preset => preset.angle === angle);
  return BOARD_VIEW_ANGLE_PRESETS[(index + 1) % BOARD_VIEW_ANGLE_PRESETS.length].angle;
}

export function boardViewProfile(mode, angle = DEFAULT_BOARD_VIEW_ANGLE) {
  const normalizedMode = normalizeBoardViewMode(mode);
  const base = PROFILES[normalizedMode];
  if (normalizedMode === BOARD_VIEW_MODE.FLAT) return base;
  const pitch = normalizeBoardViewAngle(angle);
  return {
    ...base,
    pitch,
    billboardPitch: -pitch,
    screenYScale: Math.cos(pitch * Math.PI / 180)
  };
}

/**
 * 区分“用户请求的镜头”与“设备实际启用的镜头”。低画质、小视口与粗指针设备
 * 自动拍平，避免移动端为少量纵深额外建立大量 3D 合成层。
 */
export function resolveEffectiveBoardViewMode(mode, {
  quality = 'high', compact = false, coarse = false
} = {}) {
  const requested = normalizeBoardViewMode(mode);
  if (requested !== BOARD_VIEW_MODE.PERSPECTIVE) return BOARD_VIEW_MODE.FLAT;
  return quality === 'low' || compact || coarse
    ? BOARD_VIEW_MODE.FLAT
    : BOARD_VIEW_MODE.PERSPECTIVE;
}

function writeProfile(root, profile) {
  const style = root && root.style;
  if (!style || typeof style.setProperty !== 'function') return;
  style.setProperty('--board-perspective', `${profile.perspective}px`);
  style.setProperty('--board-camera-pitch', `${profile.pitch}deg`);
  style.setProperty('--board-camera-yaw', `${profile.yaw}deg`);
  style.setProperty('--board-camera-lift', `${profile.lift}px`);
  style.setProperty('--board-island-z', `${profile.islandZ}px`);
  style.setProperty('--board-world-z', `${profile.worldZ}px`);
  style.setProperty('--board-tile-z', `${profile.tileZ}px`);
  style.setProperty('--board-piece-z', `${profile.pieceZ}px`);
  style.setProperty('--board-billboard-pitch', `${profile.billboardPitch}deg`);
  style.setProperty('--board-billboard-yaw', `${profile.billboardYaw}deg`);
}

/** 只更新实际镜头，保留 data-board-view 中的用户请求值。 */
export function applyEffectiveBoardViewMode(
  root,
  mode,
  doc = (typeof document !== 'undefined' ? document : null),
  angle = DEFAULT_BOARD_VIEW_ANGLE
) {
  const profile = boardViewProfile(mode, angle);
  if (!root) return profile.mode;
  if (root.dataset) root.dataset.boardViewEffective = profile.mode;
  writeProfile(root, profile);
  if (doc && doc.documentElement) {
    doc.documentElement.setAttribute('data-board-view-effective', profile.mode);
  }
  return profile.mode;
}

/** 记录请求镜头并先按同档应用；设备能力判断完成后可再调用 applyEffectiveBoardViewMode。 */
export function applyBoardViewMode(
  root,
  mode,
  doc = (typeof document !== 'undefined' ? document : null),
  angle = DEFAULT_BOARD_VIEW_ANGLE
) {
  const profile = boardViewProfile(mode, angle);
  if (!root) return profile.mode;
  if (root.dataset) root.dataset.boardView = profile.mode;
  if (doc && doc.documentElement) doc.documentElement.setAttribute('data-board-view', profile.mode);
  return applyEffectiveBoardViewMode(root, profile.mode, doc, angle);
}

/**
 * 计算正方形棋盘经过 yaw / pitch / perspective 后的屏幕包围盒。
 * fit 与 panBounds 共用同一公式，缩放时不会再按未投影的正方形错误裁切近端。
 */
export function projectedBoardFootprint(span, scale, mode, angle = DEFAULT_BOARD_VIEW_ANGLE) {
  const size = Math.max(0, Number(span) || 0) * Math.max(0, Number(scale) || 0);
  const p = boardViewProfile(mode, angle);
  if (!size || p.mode === BOARD_VIEW_MODE.FLAT || !p.perspective) {
    return { width: size, height: size };
  }

  const half = size / 2;
  const yaw = p.yaw * Math.PI / 180;
  const pitch = p.pitch * Math.PI / 180;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const points = [];
  for (const x of [-half, half]) {
    for (const y of [-half, half]) {
      const xr = x * cy - y * sy;
      const yr = x * sy + y * cy;
      const yp = yr * cp;
      const z = yr * sp;
      const perspectiveScale = p.perspective / Math.max(1, p.perspective - z);
      points.push({ x: xr * perspectiveScale, y: yp * perspectiveScale });
    }
  }
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
}

/**
 * 近似把屏幕增量反投影到棋盘平面。正式手势无需调用：平移与缩放已位于投影层外，
 * 可直接使用屏幕 dx/dy。这里只为未来的空白棋盘坐标工具保留正交近似；透视命中应使用
 * 浏览器命中结果或四角单应变换，不能把它当作精确 picking。
 */
export function projectScreenDelta(dx, dy, mode, angle = DEFAULT_BOARD_VIEW_ANGLE) {
  const p = boardViewProfile(mode, angle);
  const sx = Number(dx) || 0;
  const sy = (Number(dy) || 0) / Math.max(.6, p.screenYScale);
  const yaw = p.yaw * Math.PI / 180;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: sx * c + sy * s, y: -sx * s + sy * c };
}
