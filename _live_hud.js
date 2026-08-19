/** hud.js —— 六维雷达面板、毛笔灵感条、文心栏、天象角标、战报、toast */
import { ATTR_KEYS, ATTR_NAMES, CREATIVE_KEYS } from '../engine/rules.js';
import { PASSIVE_MAX, ACTIVE_MAX } from '../engine/game.js';

/** 生成六维雷达 SVG（创作力金 / 基本功青） */
export function radarSVG(attrs, opts = {}) {
  const size = opts.size || 132, cx = size / 2, cy = size / 2 + 2;
  const R = opts.r || (size / 2 - 16);
  const order = ['shi', 'ci', 'lian', 'bi', 'xue', 'si'];
  const maxV = Math.max(opts.max || 0, 10, ...order.map(k => attrs[k] || 0));
  const ang = i => (-90 + i * 60) * Math.PI / 180;
  const pt = (i, r) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];

  let grid = '';
  for (const f of [0.25, 0.5, 0.75, 1]) {
    grid += `<polygon points="${order.map((_, i) => pt(i, R * f).map(n => n.toFixed(1)).join(',')).join(' ')}"
      fill="none" stroke="rgba(90,74,52,.22)" stroke-width="1"/>`;
  }
  grid += order.map((_, i) => {
    const [x, y] = pt(i, R);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(90,74,52,.2)"/>`;
  }).join('');

  const poly = (keys, color, fill) => {
    const pts = order.map((k, i) => {
      const on = keys.includes(k);
      const r = on ? R * ((attrs[k] || 0) / maxV) : 0;
      return pt(i, Math.max(r, on ? 3 : 0)).map(n => n.toFixed(1)).join(',');
    }).join(' ');
    return `<polygon points="${pts}" fill="${fill}" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
  };

  const dots = order.map((k, i) => {
    const r = R * ((attrs[k] || 0) / maxV);
    const [x, y] = pt(i, r);
    const c = CREATIVE_KEYS.includes(k) ? '#c9971f' : '#2f8b90';
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${c}" stroke="#fff" stroke-width="1"/>`;
  }).join('');

  const labels = order.map((k, i) => {
    const [x, y] = pt(i, R + 11);
    const c = CREATIVE_KEYS.includes(k) ? '#96700d' : '#1f6d71';
    return `<text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}" font-size="10" text-anchor="middle" fill="${c}">${ATTR_NAMES[k][0]}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="font-family:var(--font-kai)">
    ${grid}
    ${poly(['shi', 'ci', 'lian'], '#c9971f', 'rgba(201,151,31,.28)')}
    ${poly(['bi', 'xue', 'si'], '#2f8b90', 'rgba(47,139,144,.26)')}
    ${dots}${labels}
  </svg>`;
}

export class Hud {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div id="attrPanel" class="panel paper">
        <div class="ph"><b>六维才学</b><span id="phaseTag">乡试圈</span></div>
        <div class="radar-box">
          <div id="radar"></div>
          <div class="attr-list" id="attrList"></div>
        </div>
      </div>

      <div id="inspBar" class="panel paper">
        <div class="ih"><span>灵感</span><b id="inspNum">—</b><span>/ <span id="inspMax">—</span></span>
          <span class="insp-warn">墨将尽，慎之！</span></div>
        <div class="brush">
          <div class="handle"></div><div class="ferrule"></div>
          <div class="tuft"><div class="ink" id="inspInk"></div></div>
        </div>
      </div>

      <div id="skyBadges"></div>

      <div id="talentBar" class="panel paper">
        <div class="th"><span>文心</span><i id="talCount">0/${PASSIVE_MAX} · 0/${ACTIVE_MAX}</i></div>
        <div class="slot-grid" id="passiveSlots"></div>
        <div class="th"><span style="font-size:11px;color:var(--mo-3)">主动</span></div>
        <div class="slot-grid" id="activeSlots" style="grid-template-columns:repeat(${ACTIVE_MAX},1fr)"></div>
      </div>

      <div id="logBox" class="panel paper"></div>

      <div id="rollZone">
        <div id="turnInfo">第 <b id="turnNum">0</b> 回合</div>
        <button class="btn btn-primary" id="rollBtn">掷骰</button>
      </div>

      <div id="toastZone"></div>`;

    this.prev = {};
    this.onTalent = null;   // 点击已拥有文心时回调（由 app.js 注入，打开详情）
    this._pas = [];
    this._act = [];
    this.el = {
      radar: root.querySelector('#radar'),
      list: root.querySelector('#attrList'),
      inspNum: root.querySelector('#inspNum'),
      inspMax: root.querySelector('#inspMax'),
      inspInk: root.querySelector('#inspInk'),
      inspBar: root.querySelector('#inspBar'),
      sky: root.querySelector('#skyBadges'),
      pas: root.querySelector('#passiveSlots'),
      act: root.querySelector('#activeSlots'),
      talCount: root.querySelector('#talCount'),
      log: root.querySelector('#logBox'),
      turn: root.querySelector('#turnNum'),
      phase: root.querySelector('#phaseTag'),
      roll: root.querySelector('#rollBtn'),
      toast: root.querySelector('#toastZone')
    };
    this.el.pas.addEventListener('click', e => this._onSlotClick(e, false));
    this.el.act.addEventListener('click', e => this._onSlotClick(e, true));
    this.el.list.innerHTML = ATTR_KEYS.map(k =>
      `<div class="attr-row ${CREATIVE_KEYS.includes(k) ? 'creative' : 'basic'}" data-k="${k}">
        <i class="dot"></i><span class="nm">${ATTR_NAMES[k]}</span><span class="vl">5</span></div>`).join('');
  }

  render(s) {
    // 雷达 + 数值
    this.el.radar.innerHTML = radarSVG(s.attrs);
    for (const k of ATTR_KEYS) {
      const row = this.el.list.querySelector(`[data-k="${k}"]`);
      const v = s.attrs[k] || 0;
      row.querySelector('.vl').textContent = v;
      if (this.prev[k] !== undefined && this.prev[k] !== v) {
        row.classList.remove('bump'); void row.offsetWidth; row.classList.add('bump');
      }
      this.prev[k] = v;
    }

    // 灵感
    this.el.inspNum.textContent = s.inspiration;
    this.el.inspMax.textContent = s.inspirationMax;
    this.el.inspInk.style.width = Math.round(100 * s.inspiration / s.inspirationMax) + '%';
    this.el.inspBar.classList.toggle('low', s.inspiration < (this.lowWarning ?? 5));

    // 天象
    const skyBadges = s.sky.map(sk => `
      <div class="sky-badge"><svg class="st" viewBox="0 0 24 24"><path d="M12 3l2.4 5.4 5.8.6-4.3 4 1.2 5.7L12 15.8 6.9 18.7l1.2-5.7-4.3-4 5.8-.6z" fill="#ffe08a"/></svg>
      <span>${sk.card.name}</span><span class="left">剩 ${sk.left} 回合</span></div>`).join('');
    const nbBadge = s.nextBattlePct
      ? `<div class="sky-badge nb"><svg class="st" viewBox="0 0 24 24"><path d="M12 3l2.4 5.4 5.8.6-4.3 4 1.2 5.7L12 15.8 6.9 18.7l1.2-5.7-4.3-4 5.8-.6z" fill="#ffd24a"/></svg>
      <span>金榜题名时</span><span class="left">下一场论战 +${Math.round(s.nextBattlePct * 100)}%</span></div>`
      : '';
    this.el.sky.innerHTML = skyBadges + nbBadge;

    // 文心
    const slot = (t, act, i) => t
      ? `<div class="slot filled ${act ? 'act' : ''}" data-idx="${i}" title="点击查看文心效果"
           style="cursor:pointer">${t.name}</div>`
      : `<div class="slot">空</div>`;
    this._pas = s.passive;
    this._act = s.active;
    this.el.pas.innerHTML = Array.from({ length: PASSIVE_MAX }, (_, i) => slot(s.passive[i], false, i)).join('');
    this.el.act.innerHTML = Array.from({ length: ACTIVE_MAX }, (_, i) => slot(s.active[i], true, i)).join('');
    this.el.talCount.textContent = `${s.passive.length}/${PASSIVE_MAX} · ${s.active.length}/${ACTIVE_MAX}`;

    // 战报
    this.el.log.innerHTML = s.log.slice(-30).map(l => `<div>[${l.turn}] ${l.text}</div>`).join('');
    this.el.log.scrollTop = this.el.log.scrollHeight;

    this.el.turn.textContent = s.turn;
    this.el.phase.textContent = s.phase === 'palace' ? '殿试' : s.phase === 'lap2' ? '会试圈' : '乡试圈';
  }

  /** 点击已拥有的文心格 → 打开详情（只读） */
  _onSlotClick(e, act) {
    if (this.onTalent == null) return;
    const slot = e.target.closest('.slot.filled');
    if (!slot) return;
    const list = act ? this._act : this._pas;
    const t = list[Number(slot.dataset.idx)];
    if (t) this.onTalent(t);
  }

  toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    this.el.toast.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; }, 2000);
    setTimeout(() => el.remove(), 2450);
  }

  setRollEnabled(on, label) {
    this.el.roll.disabled = !on;
    if (label) this.el.roll.textContent = label;
  }
  onRoll(fn) { this.el.roll.addEventListener('click', fn); }
}

function escapeAttr(s) { return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
