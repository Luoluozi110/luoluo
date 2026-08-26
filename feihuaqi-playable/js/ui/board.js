/** board.js —— 镜头可切换棋盘渲染、棋子移动、掷骰、飘字 */
import { glyph, cellGlyphKey, FAR_HILLS, ensureDefs } from './svg.js?v=20260820mapart1';
import { getBudget } from './quality.js';
import { play } from './audio.js';
import {
  applyBoardViewMode,
  applyEffectiveBoardViewMode,
  boardViewAngleLabel,
  nextBoardViewAngle,
  normalizeBoardViewAngle,
  projectedBoardFootprint,
  resolveBoardViewAngle,
  resolveBoardViewMode,
  resolveEffectiveBoardViewMode
} from './boardView.js?v=20260820anglecontrol2';

const UNIT = 46;        // 原版单环格距：42px 格面 + 4px 间距
const GRID = 21;        // 兼容旧单环；三圈布局按各 ring.grid 计算
const PAD = 3;          // 外扩单位（浮岛边框留白）
const CELL = 42;        // 格子边长
const VIEW_ANGLE_STORE_KEY = 'feihua_board_view_angle';

const MAP_TEXTURES = Object.freeze({
  full: Object.freeze({
    tier: 'full',
    srcset: 'assets/art/peach-academy-island-v1-640.webp 640w, assets/art/peach-academy-island-v1.webp 960w',
    fallback: 'assets/art/peach-academy-island-v1.png',
    width: 960,
    height: 960
  }),
  lite: Object.freeze({
    tier: 'lite',
    // 省电档不让浏览器在高低档之间猜尺寸，避免移动端误取 960px 贴图。
    srcset: 'assets/art/peach-academy-island-v1-640.webp 640w',
    fallback: 'assets/art/peach-academy-island-v1.png',
    width: 640,
    height: 640
  })
});

/** 根据画质档位返回地图中心图资源，保持高档与低档的下载边界可测试。 */
export function mapTextureProfile(quality = 'high') {
  return quality === 'low' || quality === 'lite' ? MAP_TEXTURES.lite : MAP_TEXTURES.full;
}

function mapPictureMarkup(texture) {
  return `<picture data-texture-tier="${texture.tier}">
          <source type="image/webp" srcset="${texture.srcset}"
            sizes="(max-width: 720px) 74vw, 560px">
          <img src="${texture.fallback}" width="${texture.width}" height="${texture.height}"
            alt="" aria-hidden="true" decoding="async" fetchpriority="${texture.tier === 'lite' ? 'low' : 'high'}" draggable="false">
        </picture>`;
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** 单环 id → 网格坐标（底边→左边→顶边→右边，对应春/夏/秋/冬） */
export function mainCoord(id, grid = GRID) {
  const n = grid - 1;
  const side = n;
  if (id < side) return { col: n - id, row: n, season: 'spring', edge: '乡试之路' };
  if (id < side * 2) return { col: 0, row: n - (id - side), season: 'summer', edge: '会试之路' };
  if (id < side * 3) return { col: id - side * 2, row: 0, season: 'autumn', edge: '殿试之路' };
  return { col: n, row: id - side * 3, season: 'winter', edge: '归舟之路' };
}

// 平面模式主环：四边对应春/夏/秋/冬，由 mainCoord 统一映射，无支线。

export class BoardView {
  constructor(cfg, root) {
    this.cfg = cfg;
    this.root = root;
    const search = typeof location !== 'undefined' ? location.search : '';
    let storedAngle = '';
    try { storedAngle = localStorage.getItem(VIEW_ANGLE_STORE_KEY) || ''; } catch (_) { /* ignore */ }
    this.viewAngle = resolveBoardViewAngle(search, storedAngle);
    this.requestedViewMode = resolveBoardViewMode(search);
    applyBoardViewMode(root, this.requestedViewMode, undefined, this.viewAngle);
    this.viewMode = this._refreshEffectiveViewMode();
    this.coords = new Map();      // cellId → {x,y}
    this.cellEls = new Map();
    this.cellRings = new Map();   // cellId → outer/middle/inner；用于分阶段显现
    this.visibleRing = cfg.board.layout === 'concentric_spiral' ? 'outer' : null;
    this._pieceCellId = 0;
    this.bscale = 0.62;           // 当前基准缩放（fit 计算；移动端放大以求清晰）
    this.view = { panX: 0, panY: 0, zoom: 1 }; // 平移/手势缩放
    this._fitOffset = { x: 0, y: 0 }; // 透视近端放大造成的包围盒偏心校正（不占用玩家平移）
    this._pointers = new Map();
    this._responsiveBound = false;
    this.onViewChange = null;
    this.build();
    this._initPan();
  }

  px(col, row) {
    return { x: (col + PAD) * UNIT, y: (row + PAD) * UNIT };
  }

  build() {
    ensureDefs();   // 注入共享体积渐变/柔影（格子图标/名胜/徽记引用）
    const cfg = this.cfg;
    const isSpiral = cfg.board.layout === 'concentric_spiral';
    const maxGrid = isSpiral ? Math.max(...(cfg.board.rings || []).map(r => Number(r.grid) || 0), GRID) : GRID;
    const span = (maxGrid + PAD * 2) * UNIT;

    this.root.innerHTML = `
      <div class="far-hills">${FAR_HILLS}</div>
      <div class="board-stage-shadow" aria-hidden="true"></div>
      <div id="boardCamera"><div id="boardZoom"><div id="boardProjection"><div id="boardWrap"><div id="board"></div></div></div></div></div>
      <div id="diceLayer"></div>
      <div class="float-layer" id="floatLayer"></div>`;

    const board = this.root.querySelector('#board');
    board.style.width = span + 'px';
    board.style.height = span + 'px';
    const wrap = this.root.querySelector('#boardWrap');
    wrap.style.width = span + 'px';
    wrap.style.height = span + 'px';

    // 浮岛底座：三圈以最大 19×19 网格为视觉基准；旧版这里误用 21×21，
    // 会把中心底图向右下偏移约一个格位，视觉上吞掉内圈的辨识度。
    const baseGrid = maxGrid;
    const isl = document.createElement('div');
    isl.className = 'island';
    Object.assign(isl.style, {
      left: (PAD - 0.7) * UNIT + 'px', top: (PAD - 0.7) * UNIT + 'px',
      width: (baseGrid + 1.4) * UNIT + 'px', height: (baseGrid + 1.4) * UNIT + 'px'
    });
    isl.innerHTML = `<i class="season-canopy canopy-spring" aria-hidden="true"></i>
      <i class="season-canopy canopy-summer" aria-hidden="true"></i>
      <i class="season-canopy canopy-autumn" aria-hidden="true"></i>
      <i class="season-canopy canopy-winter" aria-hidden="true"></i>`;
    board.appendChild(isl);

    const inner = document.createElement('div');
    inner.className = 'island-inner';
    Object.assign(inner.style, {
      left: (PAD + 1.4) * UNIT + 'px', top: (PAD + 1.4) * UNIT + 'px',
      width: (baseGrid - 2.8) * UNIT + 'px', height: (baseGrid - 2.8) * UNIT + 'px'
    });
    board.appendChild(inner);

    // 中央园景：让棋盘本身成为可读的桃花岛世界，而非一块留白操作台。
    // 仅承担美术叙事，不接收事件；格子与棋子保持更高层级，不影响玩法命中区。
    const world = document.createElement('div');
    const mapTexture = mapTextureProfile(getBudget().mapTexture);
    world.className = 'world-scene';
    Object.assign(world.style, {
      left: (PAD + 1.4) * UNIT + 'px', top: (PAD + 1.4) * UNIT + 'px',
      width: (baseGrid - 2.8) * UNIT + 'px', height: (baseGrid - 2.8) * UNIT + 'px'
    });
    world.innerHTML = `<div class="world-halo"></div>
      <div class="world-art world-ground" data-art-version="peach-academy-island-v1" data-texture-tier="${mapTexture.tier}">
        ${mapPictureMarkup(mapTexture)}
      </div>
      <div class="world-billboards" aria-hidden="true"></div>`;
    board.appendChild(world);

    // 主环或三圈同心方环格子
    if (isSpiral) {
      for (const ring of cfg.board.rings || []) {
        const grid = Number(ring.grid) || GRID;
        const offset = Math.floor((maxGrid - grid) / 2);
        for (const cell of ring.cells || []) {
          const c = mainCoord(cell.ringIndex ?? cell.id, grid);
          this.addCell(board, cell, c.col + offset, c.row + offset, c.season, false, ring.id);
        }
      }
      const hidden = cfg.board.hiddenFinalRing;
      if (hidden && Array.isArray(hidden.cells)) {
        const grid = Number(hidden.grid) || 3;
        const offset = Math.floor((maxGrid - grid) / 2);
        for (const cell of hidden.cells) {
          const c = mainCoord(cell.ringIndex ?? cell.id, grid);
          this.addCell(board, cell, c.col + offset, c.row + offset, c.season, false, hidden.id || 'secret');
        }
      }
    } else {
      for (const cell of cfg.board.mainRing) {
        const c = mainCoord(cell.id);
        this.addCell(board, cell, c.col, c.row, c.season);
      }
    }

    // 棋子
    const shadow = document.createElement('div');
    shadow.id = 'pieceShadow';
    board.appendChild(shadow);
    const piece = document.createElement('div');
    piece.id = 'piece';
    piece.innerHTML = `<div class="piece-body"><div class="piece-sprite">${PIECE_SVG}</div></div>`;
    board.appendChild(piece);
    this.piece = piece; this.shadow = shadow; this.board = board;
    // 三圈不是同时展开：开局只显示外圈，阶段门弹窗确认后由 setVisibleRing 切换。
    this.setVisibleRing(this.visibleRing);

    this.fit();
    this._buildResponsive();
    this.spawnPetals();
    this.setPiecePos(this.routeCellId(0));
  }

  /**
   * 当前路线索引对应的“物理格子” id。
   * 引擎使用 routeIndex 表示进度，而棋盘坐标以 rings[].cells[].id 为键；二者不必天然相同。
   * 所有棋子定位、落点高亮与预览统一走这里，避免云端编辑后的格子 id 顺序导致棋子消失。
   */
  routeCellId(routeIndex = 0) {
    if (this.cfg.board.layout !== 'concentric_spiral') return Number(routeIndex) || 0;
    const index = Math.max(0, Math.floor(Number(routeIndex) || 0));
    const step = (this.cfg.board.route || [])[index];
    const id = Number(step && (step.cellId ?? step.id));
    return Number.isFinite(id) ? id : index;
  }

  /** 根据路线进度读取当前实际圈层；配置缺失时安全回退外圈。 */
  routeRingOf(stateOrIndex = 0) {
    if (this.cfg.board.layout !== 'concentric_spiral') return null;
    if (typeof stateOrIndex === 'object' && stateOrIndex && stateOrIndex.ringId === 'secret') return 'secret';
    const index = typeof stateOrIndex === 'object'
      ? Number(stateOrIndex.routeIndex ?? stateOrIndex.pos)
      : Number(stateOrIndex);
    const safeIndex = Math.max(0, Math.floor(index || 0));
    const ring = (this.cfg.board.route || [])[safeIndex]?.ring
      || this.cellRings.get(this.routeCellId(safeIndex));
    return ['outer', 'middle', 'inner', 'secret'].includes(ring) ? ring : 'outer';
  }

  /**
   * 保持事件监听器不变地重建地图。云端/本机工程配置变更后，下一局不能让 Game 和 BoardView 各拿一份地图。
   */
  rebuild(cfg, state = null) {
    this.cfg = cfg;
    this.coords.clear();
    this.cellEls.clear();
    this.cellRings.clear();
    this.visibleRing = cfg.board.layout === 'concentric_spiral' ? 'outer' : null;
    this._pieceCellId = this.routeCellId(0);
    this.build();
    if (state && cfg.board.layout === 'concentric_spiral') {
      this.setVisibleRing(this.routeRingOf(state));
      this.setPiecePos(this.cellIdOf(state));
    }
  }

  addCell(board, cell, col, row, season, isBranch, ringId = '') {
    const p = this.px(col, row);
    const el = document.createElement('div');
    el.className = `cell t-${cell.type} ${season ? 'season-' + season : ''} ${isBranch ? 'branch-cell' : ''} ${ringId ? 'ring-' + ringId : ''}`;
    el.dataset.cellId = String(cell.id);
    el.dataset.cellType = String(cell.type || '');
    if (ringId) el.dataset.ring = ringId;
    if (season) el.dataset.season = season;
    el.style.setProperty('--cell-row', String(row));
    el.style.setProperty('--cell-col', String(col));
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    const big = cell.type === 'start' || cell.type === 'landmark';
    if (big) { el.style.left = (p.x - 4) + 'px'; el.style.top = (p.y - 4) + 'px'; }   // 50px 大格相对 42px 格位居中
    const glyphKey = cellGlyphKey(cell);
    el.dataset.cellIcon = glyphKey;
    el.innerHTML = `<div class="glyph">${glyph(glyphKey) || glyph(cell.type)}</div><div class="cname">${cell.name}</div>`;
    el.title = `${cell.id}｜${cell.name}`;
    board.appendChild(el);
    this.coords.set(cell.id, p);
    this.cellEls.set(cell.id, el);
    if (ringId) this.cellRings.set(cell.id, ringId);
  }

  /** 分阶段显现：童生/秀才只见外圈，举人显现中圈，进士及殿试显现内圈。 */
  setVisibleRing(ringId = 'outer') {
    if (this.cfg.board.layout !== 'concentric_spiral') return;
    const allowed = new Set(['outer', 'middle', 'inner', 'secret']);
    this.visibleRing = allowed.has(ringId) ? ringId : 'outer';
    this.root.classList.toggle('secret-final-on', this.visibleRing === 'secret');
    this.cellEls.forEach((el, id) => {
      const ring = this.cellRings.get(id);
      const visible = ring === this.visibleRing;
      el.style.display = visible ? '' : 'none';
      el.classList.toggle('ring-hidden', !visible);
    });
    // 阶段切换前棋子可能已走到尚未显现的路线，先隐去；切换后立即恢复。
    if (this._pieceCellId != null) this.setPiecePos(this._pieceCellId);
  }

  /**
   * 阶段门切圈的唯一 UI 入口：先切视图，再按引擎当前 routeIndex 重新定位棋子。
   * 即使某次移动骰跨过门格、或云端格子 id 与路线索引不同，也不会留下“外圈+透明棋子”的半状态。
   */
  revealRouteState(state) {
    if (this.cfg.board.layout !== 'concentric_spiral') return;
    const ring = this.routeRingOf(state);
    this.setVisibleRing(ring);
    this.setPiecePos(this.cellIdOf(state));
  }

  _boardSpan() {
    const maxGrid = this.cfg.board.layout === 'concentric_spiral'
      ? Math.max(...(this.cfg.board.rings || []).map(r => Number(r.grid) || 0), GRID)
      : GRID;
    return (maxGrid + PAD * 2) * UNIT;
  }

  _refreshEffectiveViewMode() {
    const doc = typeof document !== 'undefined' ? document : null;
    const win = typeof window !== 'undefined' ? window : null;
    const quality = doc?.documentElement?.getAttribute('data-quality') || 'high';
    const coarse = !!(win?.matchMedia && win.matchMedia('(pointer: coarse)').matches);
    const effective = resolveEffectiveBoardViewMode(this.requestedViewMode, {
      quality, coarse
    });
    return applyEffectiveBoardViewMode(this.root, effective, doc, this.viewAngle);
  }

  /** 当前镜头按钮状态：仅在真正启用 2.5D 时展示，避免移动端/省电档出现无效控件。 */
  getViewAngleState() {
    const angle = normalizeBoardViewAngle(this.viewAngle);
    return {
      visible: this.requestedViewMode === '25d' && this.viewMode === '25d',
      enabled: this.viewMode === '25d',
      angle,
      label: boardViewAngleLabel(angle)
    };
  }

  _notifyViewChange() {
    if (typeof this.onViewChange === 'function') this.onViewChange(this.getViewAngleState());
  }

  /** 应用离散俯角并重新拟合棋盘；保留玩家缩放/平移，刷新后仍记住选择。 */
  setViewAngle(angle) {
    this.viewAngle = normalizeBoardViewAngle(angle);
    try { localStorage.setItem(VIEW_ANGLE_STORE_KEY, String(this.viewAngle)); } catch (_) { /* ignore */ }
    this._fitOffset.x = 0;
    this._fitOffset.y = 0;
    this.rescale();
    return this.getViewAngleState();
  }

  cycleViewAngle() {
    return this.setViewAngle(nextBoardViewAngle(this.viewAngle));
  }

  /** 透视投影不是线性缩放；二分求能放进视口的最大基准缩放。 */
  _fitScale(span, width, height) {
    const safeWidth = Math.max(1, width) / 1.05;
    const safeHeight = Math.max(1, height) / 1.05;
    let lo = 0, hi = 1.1;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      const footprint = projectedBoardFootprint(span, mid, this.viewMode, this.viewAngle);
      if (footprint.width <= safeWidth && footprint.height <= safeHeight) lo = mid;
      else hi = mid;
    }
    // 手机端保留原有 0.4 下限：宁可允许拖动查看边缘，也不把文字缩到不可辨。
    return Math.max(0.4, Math.min(1.1, lo));
  }

  fit() {
    this.viewMode = this._refreshEffectiveViewMode();
    const span = this._boardSpan();
    this.bscale = this._fitScale(span, this.root.clientWidth, this.root.clientHeight);
    this.view.zoom = 1; this.view.panX = 0; this.view.panY = 0;
    this._fitOffset.x = 0; this._fitOffset.y = 0;
    this.applyView();
    this._settleProjectedFit();
  }

  /**
   * 玩家平移在投影外层、统一缩放在投影前一层；两种 transform 不再与相机倾角互相覆盖。
   * CSS 变量也让运行时画质切换可以安全拍平 #boardProjection。
   */
  applyView() {
    if (!this.root?.style) return;
    const sc = (this.bscale * this.view.zoom).toFixed(4);
    const screenX = this.view.panX + (this._fitOffset?.x || 0);
    const screenY = this.view.panY + (this._fitOffset?.y || 0);
    this.root.style.setProperty('--board-pan-x', `${screenX.toFixed(2)}px`);
    this.root.style.setProperty('--board-pan-y', `${screenY.toFixed(2)}px`);
    this.root.style.setProperty('--board-scale', sc);
  }

  /** 使用真实投影包围盒做一次小幅收口，吸收 perspective-origin 与浏览器矩阵舍入。 */
  _settleProjectedFit(pass = 0) {
    if (this.viewMode !== '25d' ||
        !this.board?.getBoundingClientRect || typeof requestAnimationFrame === 'undefined') return;
    if (this._fitRaf) cancelAnimationFrame(this._fitRaf);
    this._fitRaf = requestAnimationFrame(() => {
      this._fitRaf = 0;
      const rect = this.board.getBoundingClientRect();
      const rootRect = this.root.getBoundingClientRect();
      if (!rect.width || !rect.height || !rootRect.width || !rootRect.height) return;
      const safeWidth = rootRect.width / 1.05;
      const safeHeight = rootRect.height / 1.05;
      const ratio = Math.min(
        safeWidth / rect.width,
        safeHeight / rect.height
      );

      // perspective 会令近端放大，包围盒中心因此偏向屏幕下方。先扣除玩家平移与旧校正，
      // 再求“零平移棋盘”需要的独立 framing offset，避免占用用户可拖动范围。
      const safeLeft = rootRect.left + (rootRect.width - safeWidth) / 2;
      const safeRight = safeLeft + safeWidth;
      const safeTop = rootRect.top + (rootRect.height - safeHeight) / 2;
      const safeBottom = safeTop + safeHeight;
      const oldX = this._fitOffset?.x || 0;
      const oldY = this._fitOffset?.y || 0;
      const base = {
        left: rect.left - this.view.panX - oldX,
        right: rect.right - this.view.panX - oldX,
        top: rect.top - this.view.panY - oldY,
        bottom: rect.bottom - this.view.panY - oldY
      };
      const axisOffset = (start, end, safeStart, safeEnd) => {
        if (end - start > safeEnd - safeStart) {
          return (safeStart + safeEnd - start - end) / 2;
        }
        if (start < safeStart) return safeStart - start;
        if (end > safeEnd) return safeEnd - end;
        return 0;
      };
      this._fitOffset.x = axisOffset(base.left, base.right, safeLeft, safeRight);
      this._fitOffset.y = axisOffset(base.top, base.bottom, safeTop, safeBottom);

      if (this.view.zoom === 1 && Number.isFinite(ratio) && Math.abs(1 - ratio) > .012 && pass < 2) {
        const next = Math.max(0.4, Math.min(1.1, this.bscale * ratio));
        if (Math.abs(next - this.bscale) > .001) {
          this.bscale = next;
          this.applyView();
          this._settleProjectedFit(pass + 1);
          return;
        }
      }
      this.clampViewPan();
      this.applyView();
    });
  }

  /** 投影后的平移边界；放大后可拖到近端四角，整盘可见时锁在中心。 */
  panBounds() {
    const footprint = projectedBoardFootprint(
      this._boardSpan(),
      this.bscale * this.view.zoom,
      this.viewMode,
      this.viewAngle
    );
    const margin = 60;
    return {
      maxX: Math.max(0, (footprint.width - this.root.clientWidth) / 2 + margin),
      maxY: Math.max(0, (footprint.height - this.root.clientHeight) / 2 + margin)
    };
  }

  clampViewPan() {
    const { maxX, maxY } = this.panBounds();
    this.view.panX = Math.max(-maxX, Math.min(maxX, this.view.panX));
    this.view.panY = Math.max(-maxY, Math.min(maxY, this.view.panY));
  }

  /** 仅按当前视口重算基准缩放，保留用户平移 / 缩放手势状态（动态适配用） */
  rescale() {
    this.viewMode = this._refreshEffectiveViewMode();
    const span = this._boardSpan();
    this.bscale = this._fitScale(span, this.root.clientWidth, this.root.clientHeight);
    this.clampViewPan();
    this.applyView();
    this._settleProjectedFit();
    this._notifyViewChange();
  }

  /** 视口变化 → 重新适配缩放：覆盖 window.resize / 旋转 / 移动端地址栏显隐
      （visualViewport.resize），并保留手势平移缩放，避免动态变化把视图强行复位。 */
  _buildResponsive() {
    // rebuild() 会复用同一 BoardView；监听器只能绑定一次，避免每次配置更新多绑一层 resize 回调。
    if (this._responsiveBound) return;
    this._responsiveBound = true;
    const onResize = () => this.rescale();
    window.addEventListener('resize', onResize);
    // 旋转后尺寸可能滞后一帧，等下一帧再适配
    window.addEventListener('orientationchange', () => requestAnimationFrame(() => this.rescale()));
    // 移动端地址栏显隐会改变视觉视口高度但不一定触发 window.resize → 监听 visualViewport
    if (window.visualViewport) {
      let raf = 0;
      const onVV = () => {
        if (raf) return;
        raf = requestAnimationFrame(() => { raf = 0; this.rescale(); });
      };
      window.visualViewport.addEventListener('resize', onVV);
    }
  }

  /** 触摸/鼠标拖动平移 + 双指缩放；手势处于投影外层，直接使用屏幕坐标。 */
  _initPan() {
    const root = this.root;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const ZOOM_MIN = 0.4, ZOOM_MAX = 2.8;

    const panBounds = () => this.panBounds();

    root.addEventListener('pointerdown', e => {
      // 仅响应落在棋盘区域内的操作（HUD/弹窗是 #scene 的兄弟层，不会冒泡进来）
      root.setPointerCapture(e.pointerId);
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      root.classList.add('board-gesturing');
      if (this._pointers.size === 1) {
        this._panStart = { x: e.clientX, y: e.clientY, px: this.view.panX, py: this.view.panY };
      } else if (this._pointers.size === 2) {
        const p = [...this._pointers.values()];
        this._pinch = { dist: dist(p[0], p[1]), zoom: this.view.zoom };
        this._panStart = null;
      }
    });

    root.addEventListener('pointermove', e => {
      if (!this._pointers.has(e.pointerId)) return;
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._pointers.size === 1) {
        if (!this._panStart) {
          // 双指缩放松手后剩一指继续拖：重新锚定，避免平移跳变
          this._panStart = { x: e.clientX, y: e.clientY, px: this.view.panX, py: this.view.panY };
        }
        const { maxX, maxY } = panBounds();
        const dx = e.clientX - this._panStart.x;
        const dy = e.clientY - this._panStart.y;
        this.view.panX = clamp(this._panStart.px + dx, -maxX, maxX);
        this.view.panY = clamp(this._panStart.py + dy, -maxY, maxY);
        this.applyView();
      } else if (this._pointers.size === 2 && this._pinch) {
        const p = [...this._pointers.values()];
        const d = dist(p[0], p[1]);
        if (d < 1) return;
        const zoomNew = clamp(this._pinch.zoom * (d / this._pinch.dist), ZOOM_MIN, ZOOM_MAX);
        // 围绕双指捏合中点缩放：保持手指下方棋盘坐标不动
        const rr = root.getBoundingClientRect();
        const cx = (p[0].x + p[1].x) / 2 - (rr.left + rr.width / 2);
        const cy = (p[0].y + p[1].y) / 2 - (rr.top + rr.height / 2);
        const k = zoomNew / this.view.zoom;
        this.view.panX = cx - (cx - this.view.panX) * k;
        this.view.panY = cy - (cy - this.view.panY) * k;
        this.view.zoom = zoomNew;
        // 缩放后收紧平移范围，避免拖出棋盘过远
        const { maxX, maxY } = panBounds();
        this.view.panX = clamp(this.view.panX, -maxX, maxX);
        this.view.panY = clamp(this.view.panY, -maxY, maxY);
        this.applyView();
      }
    });

    const end = e => {
      this._pointers.delete(e.pointerId);
      if (this._pointers.size < 2) this._pinch = null;
      if (this._pointers.size === 1) {
        // 剩一指继续拖动：重新锚定平移起点
        const p = [...this._pointers.values()][0];
        this._panStart = { x: p.x, y: p.y, px: this.view.panX, py: this.view.panY };
      } else if (this._pointers.size === 0) {
        this._panStart = null;
        root.classList.remove('board-gesturing');
        this._settleProjectedFit();
      }
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
    root.addEventListener('lostpointercapture', end);
  }

  spawnPetals() {
    // 数量来自当前档位预算；系统要求减少动态效果时直接不生成（decorative）
    const reduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const n = reduced ? 0 : getBudget().petals;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      p.className = 'petal';
      p.style.left = Math.random() * 100 + '%';
      p.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
      p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      p.style.animationDuration = (9 + Math.random() * 9) + 's';
      p.style.animationDelay = (-Math.random() * 14) + 's';
      p.style.opacity = 0.35 + Math.random() * 0.45;
      const sc = 0.6 + Math.random() * 0.9;
      p.style.width = p.style.height = (10 * sc) + 'px';
      this.root.appendChild(p);
    }
  }

  /** 运行时切换档位：重建花瓣与地图贴图，CSS 覆盖部分由 data-quality 实时生效。 */
  applyQuality() {
    this.root.querySelectorAll('.petal').forEach(p => p.remove());
    this.spawnPetals();
    this.applyMapTexture();
    // 省电档会把请求中的 2.5D 自动拍平；切回高画质时再恢复投影并重新 fit。
    this.rescale();
  }

  /** 运行时替换地图中心图的 source，避免切回高档后仍沿用低清贴图。 */
  applyMapTexture() {
    const ground = this.root.querySelector('.world-ground');
    if (!ground) return false;
    const quality = getBudget().mapTexture === 'lite' ? 'low' : 'high';
    const texture = mapTextureProfile(quality);
    if (ground.dataset.textureTier === texture.tier) return false;
    const current = ground.querySelector('picture');
    if (!current) return false;
    const template = document.createElement('template');
    template.innerHTML = mapPictureMarkup(texture).trim();
    current.replaceWith(template.content.firstElementChild);
    ground.dataset.textureTier = texture.tier;
    return true;
  }

  cellIdOf(state) {
    if (state && state.ringId === 'secret' && state.secretFinal) return Number(state.secretFinal.cellId);
    return this.cfg.board.layout === 'concentric_spiral'
      ? this.routeCellId(state.routeIndex ?? state.pos)
      : state.pos;
  }

  setPiecePos(cellId) {
    const id = Number(cellId);
    this._pieceCellId = Number.isFinite(id) ? id : cellId;
    const p = this.coords.get(this._pieceCellId);
    // 坐标缺失绝不能把上一帧的透明度遗留给棋子；保留当前位置并显式恢复可见，方便继续排查数据问题。
    if (!p) {
      if (this.piece) this.piece.style.opacity = '';
      if (this.shadow) this.shadow.style.opacity = '';
      return false;
    }
    // 尚未显现的圈层仍可作为真实路线位置，但不让棋子提前出现在黑幕上。
    const ring = this.cellRings.get(this._pieceCellId);
    const hidden = this.cfg.board.layout === 'concentric_spiral' && ring && ring !== this.visibleRing;
    this.piece.style.opacity = hidden ? '0' : '';
    this.shadow.style.opacity = hidden ? '0' : '';
    // transform 定位：走合成器、零重排（整盘是缩放层，left/top 会触发整盘重排）
    this.piece.style.transform = `translate(${p.x}px, ${p.y}px)`;
    this.shadow.style.transform = `translate(${p.x}px, ${p.y}px)`;
    return true;
  }

  async movePiece(state) {
    const id = this.cellIdOf(state);
    play('move', { index: Number(state.routeIndex ?? state.pos) || 0 });
    this.setPiecePos(id);
    this.piece.classList.remove('hop');
    void this.piece.offsetWidth;
    this.piece.classList.add('hop');
    await sleep(150);
  }

  /** 隐藏终圈没有掷骰与分支：显现小环后，棋子沿七个叙事路径格走到唯一论战格。 */
  async showHiddenFinalRing() {
    const hidden = this.cfg.board.hiddenFinalRing || {};
    const cells = Array.isArray(hidden.cells) ? hidden.cells : [];
    if (!cells.length) return;
    this.clearHint();
    this.setVisibleRing(hidden.id || 'secret');
    this.setPiecePos(Number(hidden.startCellId) || Number(cells[0].id));
    await sleep(360);
    for (const [index, cell] of cells.slice(1).entries()) {
      play('move', { index, final: index === cells.length - 2 });
      this.setPiecePos(cell.id);
      this.piece.classList.remove('hop');
      void this.piece.offsetWidth;
      this.piece.classList.add('hop');
      await sleep(130);
    }
  }

  highlight(cell) {
    this.cellEls.forEach(e => e.classList.remove('active'));
    const id = this.cfg.board.layout === 'concentric_spiral'
      ? this.routeCellId(cell.routeIndex ?? cell.id)
      : cell.id;
    const el = this.cellEls.get(id);
    if (el) el.classList.add('active');
  }

  /** 掷骰前提示 1–6 落点光圈 */
  hintRange(state) {
    this.cellEls.forEach(e => e.classList.remove('hint'));
    const ring = this.cfg.board.layout === 'concentric_spiral' ? this.cfg.board.routeSize : this.cfg.board.ringSize;
    const current = this.cfg.board.layout === 'concentric_spiral'
      ? (Number(state.routeIndex) || 0)
      : (Number(state.pos) || 0);
    for (let i = 1; i <= 6; i++) {
      const routeIndex = Math.min(current + i, Math.max(0, ring - 1));
      const id = this.cfg.board.layout === 'concentric_spiral'
        ? this.routeCellId(routeIndex)
        : routeIndex % ring;
      const el = this.cellEls.get(id);
      if (el) el.classList.add('hint');
    }
  }
  clearHint() { this.cellEls.forEach(e => e.classList.remove('hint')); }

  async showDice(n) {
    const layer = this.root.querySelector('#diceLayer');
    play('dice', { value: n });
    const pips = DICE_PIPS[n] || [];
    layer.innerHTML = `<div class="die">${Array.from({ length: 9 }, (_, i) =>
      pips.includes(i) ? '<i></i>' : '<span></span>').join('')}</div>`;
    await sleep(760);
    layer.innerHTML = '';
  }

  /** 在棋子上方飘字 */
  float(text, cls) {
    const layer = this.root.querySelector('#floatLayer');
    const r = this.piece.getBoundingClientRect();
    const rr = this.root.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = `float-text ${cls || 'ink'}`;
    el.textContent = text;
    el.style.left = (r.left - rr.left + r.width / 2) + 'px';
    el.style.top = (r.top - rr.top - 6) + 'px';
    layer.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }
}

const DICE_PIPS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
};

/* Q 版书生棋子（英雄资产：渐变体积 + 左缘高光 + 烘焙软影） */
const PIECE_SVG = `<svg viewBox="0 0 40 56" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="pcRobe" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5b93b4"/><stop offset=".55" stop-color="#3f6f8f"/><stop offset="1" stop-color="#2c4f6c"/>
    </linearGradient>
    <linearGradient id="pcRobe2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#73abc9"/><stop offset="1" stop-color="#4a7e9e"/>
    </linearGradient>
    <radialGradient id="pcFace" cx="42%" cy="34%" r="72%">
      <stop offset="0" stop-color="#fff0db"/><stop offset="1" stop-color="#f0c6a4"/>
    </radialGradient>
    <linearGradient id="pcHat" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a332b"/><stop offset="1" stop-color="#191512"/>
    </linearGradient>
  </defs>
  <ellipse cx="20" cy="53" rx="13" ry="3.4" fill="rgba(0,0,0,.3)"/>
  <path d="M9 52c0-11 4-17 11-17s11 6 11 17z" fill="url(#pcRobe)"/>
  <path d="M14 52c0-9 2-14 6-14s6 5 6 14z" fill="url(#pcRobe2)"/>
  <ellipse cx="12.6" cy="44" rx="3" ry="9" fill="#ffffff" opacity=".16"/>
  <path d="M20 35l-4 8 4 3 4-3z" fill="#f0f0e6"/>
  <circle cx="20" cy="22" r="12" fill="url(#pcFace)"/>
  <ellipse cx="16" cy="19" rx="3" ry="2" fill="#fff" opacity=".22"/>
  <path d="M8.6 19a11.6 11.6 0 0122.8 0c-2-5-6.2-8-11.4-8S10.6 14 8.6 19z" fill="url(#pcHat)"/>
  <path d="M11 14c3-5 15-5 18 0 1.6-4-3-8-9-8s-10.6 4-9 8z" fill="#2b2622"/>
  <rect x="14" y="3" width="12" height="6" rx="2" fill="url(#pcHat)"/>
  <rect x="12.5" y="7.5" width="15" height="3" rx="1.5" fill="#3a332b"/>
  <circle cx="15.6" cy="23" r="1.7" fill="#2b2622"/>
  <circle cx="24.4" cy="23" r="1.7" fill="#2b2622"/>
  <circle cx="16.1" cy="22.4" r=".55" fill="#fff"/>
  <circle cx="24.9" cy="22.4" r=".55" fill="#fff"/>
  <ellipse cx="12.4" cy="26.6" rx="2.3" ry="1.5" fill="#f7a8ae" opacity=".75"/>
  <ellipse cx="27.6" cy="26.6" rx="2.3" ry="1.5" fill="#f7a8ae" opacity=".75"/>
  <path d="M18 27.4q2 2 4 0" class="ta-brown ta-1" fill="none" stroke-linecap="round"/>
  <rect x="29" y="30" width="2.6" height="17" rx="1.3" fill="#8d6a45" transform="rotate(12 30 38)"/>
  <path d="M32.5 45.5l1.6 5-2.8.6z" fill="#2b2622"/>
</svg>`;
