/** board.js —— 平面俯视棋盘渲染、棋子移动、掷骰、飘字 */
import { glyph, LANDMARK_ART, FAR_HILLS, ensureDefs } from './svg.js';
import { getBudget } from './quality.js';
import { play } from './audio.js';
import { sting } from './music.js';

const UNIT = 46;        // 单元格间距
const GRID = 21;        // 主环 21×21 外圈 = 4×(21-1) = 80 格（扩图：原 16×16=60 格，周长 +33%）
const PAD = 3;          // 外扩单位（仅作浮岛边框留白；支线改为向内延伸）
const CELL = 42;

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** 主环 id → 网格坐标（底边→左边→顶边→右边，对应春/夏/秋/冬） */
export function mainCoord(id) {
  const n = GRID - 1;                       // 20
  if (id < 20) return { col: n - id, row: n, season: 'spring', edge: '乡试之路' };
  if (id < 40) return { col: 0, row: n - (id - 20), season: 'summer', edge: '会试之路' };
  if (id < 60) return { col: id - 40, row: 0, season: 'autumn', edge: '殿试之路' };
  return { col: n, row: id - 60, season: 'winter', edge: '归舟之路' };
}

// 平面模式：支线从主环「向内」朝桃花岛中心延伸（方向指向棋盘几何中心）
const BRANCH_DIR = {
  shanshui: { dc: 0, dr: -1 },   // 12 在底边 → 向中心（上）延伸
  shuyuan: { dc: 1, dr: 0 },     // 27 在左边 → 向中心（右）延伸
  yuyuan: { dc: 0, dr: 1 },      // 42 在顶边 → 向中心（下）延伸
  biansai: { dc: -1, dr: 0 }     // 57 在右边 → 向中心（左）延伸
};

export class BoardView {
  constructor(cfg, root) {
    this.cfg = cfg;
    this.root = root;
    this.coords = new Map();      // cellId → {x,y}
    this.cellEls = new Map();
    this.bscale = 0.62;           // 当前基准缩放（fit 计算；移动端放大以求清晰）
    this.view = { panX: 0, panY: 0, zoom: 1 }; // 平移/手势缩放
    this._pointers = new Map();
    this.build();
    this._initPan();
  }

  px(col, row) {
    return { x: (col + PAD) * UNIT, y: (row + PAD) * UNIT };
  }

  build() {
    ensureDefs();   // 注入共享体积渐变/柔影（格子图标/名胜/徽记引用）
    const cfg = this.cfg;
    const span = (GRID + PAD * 2) * UNIT;

    this.root.innerHTML = `
      <div class="far-hills">${FAR_HILLS}</div>
      <div id="boardWrap"><div id="board"></div></div>
      <div id="diceLayer"></div>
      <div class="float-layer" id="floatLayer"></div>`;

    const board = this.root.querySelector('#board');
    board.style.width = span + 'px';
    board.style.height = span + 'px';

    // 浮岛底座
    const isl = document.createElement('div');
    isl.className = 'island';
    Object.assign(isl.style, {
      left: (PAD - 0.7) * UNIT + 'px', top: (PAD - 0.7) * UNIT + 'px',
      width: (GRID + 1.4) * UNIT + 'px', height: (GRID + 1.4) * UNIT + 'px'
    });
    board.appendChild(isl);

    const inner = document.createElement('div');
    inner.className = 'island-inner';
    Object.assign(inner.style, {
      left: (PAD + 1.4) * UNIT + 'px', top: (PAD + 1.4) * UNIT + 'px',
      width: (GRID - 2.8) * UNIT + 'px', height: (GRID - 2.8) * UNIT + 'px'
    });
    board.appendChild(inner);

    const ttl = document.createElement('div');
    ttl.className = 'island-title';
    Object.assign(ttl.style, {
      left: (PAD + 1.4) * UNIT + 'px', top: (PAD + 1.4) * UNIT + 'px',
      width: (GRID - 2.8) * UNIT + 'px', height: (GRID - 2.8) * UNIT + 'px'
    });
    ttl.innerHTML = `<div class="big">桃花島</div><div class="sm">詩詞楹聯飛花棋</div>`;
    board.appendChild(ttl);

    // 支线连线
    for (const [bid, br] of Object.entries(cfg.board.branches)) {
      const gate = cfg.board.gateOf[bid];
      const g = mainCoord(gate);
      const d = BRANCH_DIR[bid] || { dc: 0, dr: 1 };
      const a = this.px(g.col, g.row), b = this.px(g.col + d.dc * 5, g.row + d.dr * 5);
      const link = document.createElement('div');
      link.className = 'branch-link' + (d.dc === 0 ? ' vert' : '');
      const x1 = Math.min(a.x, b.x), y1 = Math.min(a.y, b.y);
      Object.assign(link.style, {
        left: x1 + CELL / 2 - (d.dc === 0 ? 2 : 0) + 'px',
        top: y1 + CELL / 2 - (d.dr === 0 ? 2 : 0) + 'px',
        width: (d.dc === 0 ? 4 : Math.abs(b.x - a.x)) + 'px',
        height: (d.dr === 0 ? 4 : Math.abs(b.y - a.y)) + 'px'
      });
      board.appendChild(link);
    }

    // 主环格子
    for (const cell of cfg.board.mainRing) {
      const c = mainCoord(cell.id);
      this.addCell(board, cell, c.col, c.row, c.season);
    }
    // 支线格子
    for (const [bid, br] of Object.entries(cfg.board.branches)) {
      const gate = cfg.board.gateOf[bid];
      const g = mainCoord(gate);
      const d = BRANCH_DIR[bid] || { dc: 0, dr: 1 };
      br.cells.forEach((cid, i) => {
        const cell = cfg.board.cellById.get(cid);
        this.addCell(board, cell, g.col + d.dc * (i + 1), g.row + d.dr * (i + 1), null, true);
        if (cell.type === 'landmark') {
          const p = this.px(g.col + d.dc * (i + 1), g.row + d.dr * (i + 1));
          const lm = document.createElement('div');
          lm.className = 'landmark-3d';
          lm.style.left = (p.x - 11) + 'px';
          lm.style.top = (p.y - 10) + 'px';
          lm.style.transform = 'translateZ(2px)';
          lm.innerHTML = LANDMARK_ART[bid] || '';
          board.appendChild(lm);
        }
      });
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

    this.fit();
    this._buildResponsive();
    this.spawnPetals();
    this.setPiecePos(0);
  }

  addCell(board, cell, col, row, season, isBranch) {
    const p = this.px(col, row);
    const el = document.createElement('div');
    el.className = `cell t-${cell.type} ${season ? 'season-' + season : ''} ${isBranch ? 'branch-cell' : ''}`;
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    const big = cell.type === 'start' || cell.type === 'landmark';
    if (big) { el.style.left = (p.x - 4) + 'px'; el.style.top = (p.y - 4) + 'px'; }
    el.innerHTML = `<div class="glyph">${glyph(cell.type)}</div><div class="cname">${cell.name}</div>`;
    el.title = `${cell.id}｜${cell.name}`;
    board.appendChild(el);
    this.coords.set(cell.id, p);
    this.cellEls.set(cell.id, el);
  }

  fit() {
    const span = (GRID + PAD * 2) * UNIT;
    const w = this.root.clientWidth, h = this.root.clientHeight;
    // 平面模式：整盘铺满可视区（留 ~5% 边距），不再做俯视纵向压缩
    const s = Math.min(w / (span * 1.05), h / (span * 1.05));
    this.bscale = Math.max(0.3, Math.min(1.1, s));
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
    const span = (GRID + PAD * 2) * UNIT;
    const w = this.root.clientWidth, h = this.root.clientHeight;
    const s = Math.min(w / (span * 1.05), h / (span * 1.05));
    this.bscale = Math.max(0.3, Math.min(1.1, s));
    this.applyView();
  }

  /** 视口变化 → 重新适配缩放：覆盖 window.resize / 旋转 / 移动端地址栏显隐
      （visualViewport.resize），并保留手势平移缩放，避免动态变化把视图强行复位。 */
  _buildResponsive() {
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

  /** 触摸/鼠标拖动平移 + 双指缩放（手机看大棋盘的关键） */
  _initPan() {
    const root = this.root;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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
      }
    });

    root.addEventListener('pointermove', e => {
      if (!this._pointers.has(e.pointerId)) return;
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._pointers.size === 1 && this._panStart) {
        const maxX = root.clientWidth * 0.65 + 240;
        const maxY = root.clientHeight * 0.65 + 240;
        this.view.panX = clamp(this._panStart.px + (e.clientX - this._panStart.x), -maxX, maxX);
        this.view.panY = clamp(this._panStart.py + (e.clientY - this._panStart.y), -maxY, maxY);
        this.applyView();
      } else if (this._pointers.size === 2 && this._pinch) {
        const p = [...this._pointers.values()];
        const z = this._pinch.zoom * (dist(p[0], p[1]) / this._pinch.dist);
        this.view.zoom = clamp(z, 0.4, 1.8);
        this.applyView();
      }
    });

    const end = e => {
      this._pointers.delete(e.pointerId);
      if (this._pointers.size < 2) this._pinch = null;
      if (this._pointers.size === 0) {
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
    if (state.track === 'branch') {
      const br = this.cfg.board.branches[state.branchId];
      return br.cells[Math.max(0, state.branchIndex)];
    }
    return state.pos;
  }

  setPiecePos(cellId) {
    const p = this.coords.get(cellId);
    if (!p) return;
    // transform 定位：走合成器、零重排（整盘是缩放层，left/top 会触发整盘重排）
    this.piece.style.transform = `translate(${p.x}px, ${p.y}px)`;
    this.shadow.style.transform = `translate(${p.x}px, ${p.y}px)`;
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
    const el = this.cellEls.get(cell.id);
    if (el) el.classList.add('active');
  }

  /** 掷骰前提示 1–6 落点光圈 */
  hintRange(state) {
    this.cellEls.forEach(e => e.classList.remove('hint'));
    const ring = this.cfg.board.ringSize;
    for (let i = 1; i <= 6; i++) {
      let id;
      if (state.track === 'branch') {
        const br = this.cfg.board.branches[state.branchId];
        id = br.cells[Math.min(br.cells.length - 1, state.branchIndex + i)];
      } else {
        id = (state.pos + i) % ring;
      }
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
