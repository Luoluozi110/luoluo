/** board.js —— 平面俯视棋盘渲染、棋子移动、掷骰、飘字 */
import { glyph, FAR_HILLS, CENTER_GARDEN_ART, ensureDefs } from './svg.js';
import { getBudget } from './quality.js';
import { play } from './audio.js';
import { sting } from './music.js';

const UNIT = 46;        // 原版单环格距：42px 格面 + 4px 间距
const GRID = 21;        // 兼容旧单环；三圈布局按各 ring.grid 计算
const PAD = 3;          // 外扩单位（浮岛边框留白）
const CELL = 42;        // 格子边长

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
    this.coords = new Map();      // cellId → {x,y}
    this.cellEls = new Map();
    this.cellRings = new Map();   // cellId → outer/middle/inner；用于分阶段显现
    this.visibleRing = cfg.board.layout === 'concentric_spiral' ? 'outer' : null;
    this._pieceCellId = 0;
    this.bscale = 0.62;           // 当前基准缩放（fit 计算；移动端放大以求清晰）
    this.view = { panX: 0, panY: 0, zoom: 1 }; // 平移/手势缩放
    this._pointers = new Map();
    this._responsiveBound = false;
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
      <div id="boardWrap"><div id="board"></div></div>
      <div id="diceLayer"></div>
      <div class="float-layer" id="floatLayer"></div>`;

    const board = this.root.querySelector('#board');
    board.style.width = span + 'px';
    board.style.height = span + 'px';

    // 浮岛底座：三圈以最大 19×19 网格为视觉基准；旧版这里误用 21×21，
    // 会把中心底图向右下偏移约一个格位，视觉上吞掉内圈的辨识度。
    const baseGrid = maxGrid;
    const isl = document.createElement('div');
    isl.className = 'island';
    Object.assign(isl.style, {
      left: (PAD - 0.7) * UNIT + 'px', top: (PAD - 0.7) * UNIT + 'px',
      width: (baseGrid + 1.4) * UNIT + 'px', height: (baseGrid + 1.4) * UNIT + 'px'
    });
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
    world.className = 'world-scene';
    Object.assign(world.style, {
      left: (PAD + 1.4) * UNIT + 'px', top: (PAD + 1.4) * UNIT + 'px',
      width: (baseGrid - 2.8) * UNIT + 'px', height: (baseGrid - 2.8) * UNIT + 'px'
    });
    world.innerHTML = `<div class="world-halo"></div><div class="world-art">${CENTER_GARDEN_ART}</div>`;
    board.appendChild(world);

    const ttl = document.createElement('div');
    ttl.className = 'island-title';
    Object.assign(ttl.style, {
      left: (PAD + 1.4) * UNIT + 'px', top: (PAD + 1.4) * UNIT + 'px',
      width: (baseGrid - 2.8) * UNIT + 'px', height: (baseGrid - 2.8) * UNIT + 'px'
    });
    ttl.innerHTML = `<div class="big">桃花島</div><div class="sm">詩詞楹聯飛花棋</div>`;
    board.appendChild(ttl);

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
    piece.innerHTML = `<div class="piece-body">${PIECE_SVG}</div>`;
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
    const index = typeof stateOrIndex === 'object'
      ? Number(stateOrIndex.routeIndex ?? stateOrIndex.pos)
      : Number(stateOrIndex);
    const safeIndex = Math.max(0, Math.floor(index || 0));
    const ring = (this.cfg.board.route || [])[safeIndex]?.ring
      || this.cellRings.get(this.routeCellId(safeIndex));
    return ['outer', 'middle', 'inner'].includes(ring) ? ring : 'outer';
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
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    const big = cell.type === 'start' || cell.type === 'landmark';
    if (big) { el.style.left = (p.x - 4) + 'px'; el.style.top = (p.y - 4) + 'px'; }   // 50px 大格相对 42px 格位居中
    el.innerHTML = `<div class="glyph">${glyph(cell.icon || cell.type)}</div><div class="cname">${cell.name}</div>`;
    el.title = `${cell.id}｜${cell.name}`;
    board.appendChild(el);
    this.coords.set(cell.id, p);
    this.cellEls.set(cell.id, el);
    if (ringId) this.cellRings.set(cell.id, ringId);
  }

  /** 分阶段显现：童生/秀才只见外圈，举人显现中圈，进士及殿试显现内圈。 */
  setVisibleRing(ringId = 'outer') {
    if (this.cfg.board.layout !== 'concentric_spiral') return;
    const allowed = new Set(['outer', 'middle', 'inner']);
    this.visibleRing = allowed.has(ringId) ? ringId : 'outer';
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

  fit() {
    const maxGrid = this.cfg.board.layout === 'concentric_spiral'
      ? Math.max(...(this.cfg.board.rings || []).map(r => Number(r.grid) || 0), GRID) : GRID;
    const span = (maxGrid + PAD * 2) * UNIT;
    const w = this.root.clientWidth, h = this.root.clientHeight;
    // 平面模式：整盘铺满可视区（留 ~5% 边距），不再做俯视纵向压缩
    const s = Math.min(w / (span * 1.05), h / (span * 1.05));
    this.bscale = Math.max(0.4, Math.min(1.1, s));   // 下限 0.4：手机端默认适度放大（不过大），字体可辨，可拖动/双指缩放看全盘
    this.view.zoom = 1; this.view.panX = 0; this.view.panY = 0;
    this.applyView();
  }

  /** 应用 平移 + 缩放 到棋盘容器（平面俯视，无 3D 倾斜） */
  applyView() {
    const wrap = this.root.querySelector('#boardWrap');
    if (!wrap) return;
    const sc = (this.bscale * this.view.zoom).toFixed(4);
    wrap.style.transform =
      `translate(-50%,-50%) translate(${this.view.panX}px, ${this.view.panY}px) scale(${sc})`;
  }

  /** 仅按当前视口重算基准缩放，保留用户平移 / 缩放手势状态（动态适配用） */
  rescale() {
    const maxGrid = this.cfg.board.layout === 'concentric_spiral'
      ? Math.max(...(this.cfg.board.rings || []).map(r => Number(r.grid) || 0), GRID) : GRID;
    const span = (maxGrid + PAD * 2) * UNIT;
    const w = this.root.clientWidth, h = this.root.clientHeight;
    const s = Math.min(w / (span * 1.05), h / (span * 1.05));
    this.bscale = Math.max(0.4, Math.min(1.1, s));   // 下限 0.4：手机端默认适度放大（不过大），字体可辨，可拖动/双指缩放看全盘
    this.applyView();
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

  /** 触摸/鼠标拖动平移 + 双指缩放（围绕捏合中心缩放 + 平移范围随缩放扩大） */
  _initPan() {
    const root = this.root;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const ZOOM_MIN = 0.4, ZOOM_MAX = 2.8;

    /** 平移范围随当前缩放扩大：放大后可拖到棋盘边角，全盘可见时锁在中心 */
    const panBounds = () => {
      const maxGrid = this.cfg.board.layout === 'concentric_spiral'
        ? Math.max(...(this.cfg.board.rings || []).map(r => Number(r.grid) || 0), GRID) : GRID;
      const span = (maxGrid + PAD * 2) * UNIT;
      const sc = this.bscale * this.view.zoom;
      const margin = 60;
      return {
        maxX: Math.max(0, (span * sc - root.clientWidth) / 2 + margin),
        maxY: Math.max(0, (span * sc - root.clientHeight) / 2 + margin)
      };
    };

    root.addEventListener('pointerdown', e => {
      // 仅响应落在棋盘区域内的操作（HUD/弹窗是 #scene 的兄弟层，不会冒泡进来）
      root.setPointerCapture(e.pointerId);
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const wrap = root.querySelector('#boardWrap');
      if (wrap) wrap.style.transition = 'none';
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
        this.view.panX = clamp(this._panStart.px + (e.clientX - this._panStart.x), -maxX, maxX);
        this.view.panY = clamp(this._panStart.py + (e.clientY - this._panStart.y), -maxY, maxY);
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
        const wrap = root.querySelector('#boardWrap');
        if (wrap) wrap.style.transition = '';
      }
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
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

  /** 运行时切换档位：移除现有花瓣，按当前预算重新生成（CSS 覆盖部分由 data-quality 实时生效） */
  applyQuality() {
    this.root.querySelectorAll('.petal').forEach(p => p.remove());
    this.spawnPetals();
  }

  cellIdOf(state) {
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
    play('move');
    this.setPiecePos(id);
    this.piece.classList.remove('hop');
    void this.piece.offsetWidth;
    this.piece.classList.add('hop');
    await sleep(150);
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
    play('dice');
    sting('dice');           // 掷骰动画配乐：上行三音点缀
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
