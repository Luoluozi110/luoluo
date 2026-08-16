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
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${c}" class="ta-white ta-1"/>`;
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
        <div class="ph"><span class="ph-left"><span class="pc-ico">❖</span><b>六维才学</b></span><span class="ph-right">
          <span id="phaseTag">乡试圈</span><span id="pnameTag" class="pname"></span>
          <button class="pc-toggle" id="attrToggle" type="button" aria-label="收起或展开六维面板" aria-expanded="true"><svg class="chev" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 5.75 8 10.25 12.5 5.75"/></svg></button>
        </span></div>
        <div class="pc-body" id="attrBody"><div class="pc-inner">
          <div class="radar-box">
            <div id="radar"></div>
            <div class="attr-list" id="attrList"></div>
          </div>
          <div id="schoolProgress" class="school-progress"></div>
        </div></div>
      </div>

      <div id="inspBar" class="panel paper">
        <div class="ih"><span class="ih-left"><span class="pc-ico">✒</span><span>灵感</span></span><b id="inspNum">—</b><span>/ <span id="inspMax">—</span></span>
          <span class="insp-warn">墨将尽，慎之！</span>
          <button class="pc-toggle" id="inspToggle" type="button" aria-label="收起或展开灵感条" aria-expanded="true"><svg class="chev" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 5.75 8 10.25 12.5 5.75"/></svg></button>
        </div>
        <div class="pc-body" id="inspBody"><div class="pc-inner">
          <div class="brush">
            <div class="handle"></div><div class="ferrule"></div>
            <div class="tuft"><div class="ink" id="inspInk"></div></div>
          </div>
        </div></div>
      </div>

      <div id="skyBadges"></div>

      <div id="talentBar" class="panel paper">
        <div class="th"><span class="th-left"><span class="pc-ico">✶</span><span>文心</span></span><span class="th-right">
          <i id="talCount">0/${PASSIVE_MAX} · 0/${ACTIVE_MAX}</i>
          <button class="pc-toggle" id="talentToggle" type="button" aria-label="收起或展开文心面板" aria-expanded="true"><svg class="chev" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 5.75 8 10.25 12.5 5.75"/></svg></button>
        </span></div>
        <div class="pc-body" id="talentBody"><div class="pc-inner">
          <div class="slot-grid" id="passiveSlots"></div>
          <div class="th"><span style="font-size:11px;color:var(--mo-3)">主动</span></div>
          <div class="slot-grid" id="activeSlots" style="grid-template-columns:repeat(${ACTIVE_MAX},1fr)"></div>
          <div id="synList" class="syn-list"></div>
        </div></div>
      </div>

      <div id="logBox" class="panel paper"></div>

      <div id="turnInfo">第 <b id="turnNum">0</b> 回合</div>
      <div id="rollZone">
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
      schoolProgress: root.querySelector('#schoolProgress'),
      inspNum: root.querySelector('#inspNum'),
      inspMax: root.querySelector('#inspMax'),
      inspInk: root.querySelector('#inspInk'),
      inspBar: root.querySelector('#inspBar'),
      sky: root.querySelector('#skyBadges'),
      pas: root.querySelector('#passiveSlots'),
      act: root.querySelector('#activeSlots'),
      talCount: root.querySelector('#talCount'),
      synList: root.querySelector('#synList'),
      log: root.querySelector('#logBox'),
      turn: root.querySelector('#turnNum'),
      phase: root.querySelector('#phaseTag'),
      pname: root.querySelector('#pnameTag'),
      roll: root.querySelector('#rollBtn'),
      toast: root.querySelector('#toastZone'),
      attrPanel: root.querySelector('#attrPanel'),
      talentPanel: root.querySelector('#talentBar'),
      attrToggle: root.querySelector('#attrToggle'),
      talentToggle: root.querySelector('#talentToggle'),
      attrBody: root.querySelector('#attrBody'),
      talentBody: root.querySelector('#talentBody'),
      inspPanel: root.querySelector('#inspBar'),
      inspToggle: root.querySelector('#inspToggle'),
      inspBody: root.querySelector('#inspBody')
    };
    this.el.pas.addEventListener('click', e => this._onSlotClick(e, false));
    this.el.act.addEventListener('click', e => this._onSlotClick(e, true));
    this.el.attrToggle.addEventListener('click', () => this.togglePanel('attr'));
    this.el.talentToggle.addEventListener('click', () => this.togglePanel('talent'));
    this.el.inspToggle.addEventListener('click', () => this.togglePanel('insp'));
    this._collapse = this._loadCollapse();
    this._bp = !!(window.matchMedia && window.matchMedia('(max-width: 600px)').matches);
    this._shortLandscapeApplied = false;
    window.addEventListener('resize', () => this._onViewportChange());
    window.addEventListener('orientationchange', () => this._onViewportChange());
    this._applyCollapse();
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

    // 三派成长进度：把核心循环做成 HUD 可见反馈。
    const mech = (s.school && s.school.schoolMechanics) || {};
    const ss = s.schoolState || {};
    if (this.el.schoolProgress) {
      if (mech.type === 'bowen') {
        const need = Number(mech.knowledgeThreshold) || 2;
        this.el.schoolProgress.innerHTML = `<span class="school-progress-name">博闻·开卷</span><span>知识 ${Math.min(need, Number(ss.knowledge) || 0)}/${need}</span>`;
      } else if (mech.type === 'qishi') {
        const acc = Math.round((Number(ss.inspirationAccumulator) || 0) * 100) / 100;
        this.el.schoolProgress.innerHTML = `<span class="school-progress-name">奇士·灵机</span><span>额外灵感累积 ${acc}</span>`;
      } else if (mech.type === 'cizong_bi') {
        const bp = ss.basicProgress || {};
        const key = ['bi', 'xue', 'si'].slice().sort((a, b) => (s.attrs[a] || 0) - (s.attrs[b] || 0))[0];
        const need = Number(mech.basicMinThreshold) || 4;
        this.el.schoolProgress.innerHTML = `<span class="school-progress-name">辞宗·一战一得</span><span>${ATTR_NAMES[key]}成长 ${Number(bp[key]) || 0}/${need}</span>`;
      } else this.el.schoolProgress.textContent = '';
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

    // 文心羁绊：当前已激活的组合
    const syn = (s.synergies || []);
    this.el.synList.innerHTML = syn.length
      ? `<div class="syn-h">文心羁绊</div>` + syn.map(sy =>
          `<span class="syn-chip" title="${sy.desc || ''}">✦ ${sy.name}</span>`).join('')
      : '';

    // 战报
    this.el.log.innerHTML = s.log.slice(-30).map(l => `<div>[${l.turn}] ${l.text}</div>`).join('');
    this.el.log.scrollTop = this.el.log.scrollHeight;

    this.el.turn.textContent = s.turn;
    const phaseNames = { child: '童生', xiucai: '秀才', juren: '举人', jinshi: '进士', palace: '殿试', lap1: '乡试圈', lap2: '会试圈' };
    this.el.phase.textContent = phaseNames[s.phase] || '童生';
    if (this.el.pname) this.el.pname.textContent = s.playerName ? `　「${s.playerName}」` : '';
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

  /** 面板收起/展开：移动端默认收起以露出棋盘；状态轻量持久化到 localStorage */
  _loadCollapse() {
    const mobile = !!(window.matchMedia && window.matchMedia('(max-width: 600px)').matches);
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('feihua_panel_collapsed') || 'null'); } catch (_) {}
    return {
      attr: saved ? !!saved.attr : mobile,
      talent: saved ? !!saved.talent : mobile,
      insp: saved ? !!saved.insp : mobile
    };
  }
  _saveCollapse() {
    try { localStorage.setItem('feihua_panel_collapsed', JSON.stringify(this._collapse)); } catch (_) {}
  }
  _applyCollapse() {
    const a = !!this._collapse.attr, t = !!this._collapse.talent, i = !!this._collapse.insp;
    this.el.attrPanel.classList.toggle('collapsed', a);
    this.el.talentPanel.classList.toggle('collapsed', t);
    this.el.inspPanel.classList.toggle('collapsed', i);
    if (this.el.attrToggle) this.el.attrToggle.setAttribute('aria-expanded', String(!a));
    if (this.el.talentToggle) this.el.talentToggle.setAttribute('aria-expanded', String(!t));
    if (this.el.inspToggle) this.el.inspToggle.setAttribute('aria-expanded', String(!i));
    // 箭头方向由 CSS 驱动：.collapsed .pc-toggle .chev { rotate(180deg) }
  }
  togglePanel(key) {
    if (key !== 'attr' && key !== 'talent' && key !== 'insp') return;
    this._collapse[key] = !this._collapse[key];
    this._saveCollapse();
    this._applyCollapse();
    const map = { attr: this.el.attrToggle, talent: this.el.talentToggle, insp: this.el.inspToggle };
    this._bounce(map[key]);
  }
  /** 切换瞬间让箭头轻轻弹一下，强化「点到了」的反馈 */
  _bounce(toggle) {
    if (!toggle) return;
    toggle.classList.remove('bounce');
    void toggle.offsetWidth;   // 强制回流以重启动画
    toggle.classList.add('bounce');
  }
  /** 视口跨越 600px 阈值（横竖屏切换 / 缩放）时，恢复该模式的默认收起态 */
  _onViewportChange() {
    if (this._vpTimer) clearTimeout(this._vpTimer);
    this._vpTimer = setTimeout(() => {
      const mobile = !!(window.matchMedia && window.matchMedia('(max-width: 600px)').matches);
      const shortLandscape = !!(window.matchMedia && window.matchMedia('(orientation: landscape) and (max-height: 500px)').matches);
      if (mobile === this._bp) {
        // 横屏短视口不改变玩家已保存偏好，但在初次进入时默认收起高密度 HUD。
        if (shortLandscape && !this._shortLandscapeApplied) {
          this._shortLandscapeApplied = true;
          this._collapse = { attr: true, talent: true, insp: true };
          this._applyCollapse();
        } else if (!shortLandscape) this._shortLandscapeApplied = false;
        return;
      }
      this._bp = mobile;
      this._collapse = { attr: mobile || shortLandscape, talent: mobile || shortLandscape, insp: mobile || shortLandscape };
      this._saveCollapse();
      this._applyCollapse();
    }, 180);
  }

  toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    this.el.toast.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; }, 2000);
    setTimeout(() => el.remove(), 2450);
  }

  choiceEcho({ choiceText, resultText }) {
    const el = document.createElement('div');
    el.className = 'toast choice-echo';
    const picked = document.createElement('div');
    picked.className = 'choice-echo-picked';
    picked.textContent = `已选择：${choiceText}`;
    const result = document.createElement('div');
    result.className = 'choice-echo-result';
    result.textContent = resultText;
    el.append(picked, result);
    this.el.toast.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; }, 3800);
    setTimeout(() => el.remove(), 4250);
  }

  setRollEnabled(on, label) {
    this.el.roll.disabled = !on;
    if (label) this.el.roll.textContent = label;
  }
  onRoll(fn) { this.el.roll.addEventListener('click', fn); }
}

function escapeAttr(s) { return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
