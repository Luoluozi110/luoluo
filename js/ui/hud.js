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
      <div id="leftHudRail">
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
      </div>

      <div id="rightHudRail">
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
      </div>

      <button id="viewAngleBtn" type="button" hidden aria-label="地图视角" title="切换地图俯角">
        <svg viewBox="0 0 26 22" aria-hidden="true" focusable="false">
          <path d="M3 8.5 13 3l10 5.5L13 14 3 8.5Z"/>
          <path d="m3 13.5 10 5.5 10-5.5"/>
        </svg>
        <span class="view-angle-copy"><span class="view-angle-name">视角</span><b id="viewAngleValue">28°</b></span>
      </button>
      <div id="actionDock">
      <div id="logBox" class="panel paper"></div>
      <div id="toastZone"></div>
      <div id="rollZone">
        <button class="btn btn-ink" id="abilityBtn">修习</button>
        <button class="btn btn-ink" id="planBtn" style="display:none">布局谋篇</button>
        <button class="btn btn-primary" id="rollBtn"><span class="roll-die" aria-hidden="true"><svg viewBox="0 0 46 46"><rect x="3" y="3" width="40" height="40" rx="9"/><circle cx="14" cy="14" r="3"/><circle cx="32" cy="14" r="3"/><circle cx="23" cy="23" r="3"/><circle cx="14" cy="32" r="3"/><circle cx="32" cy="32" r="3"/></svg></span><span class="roll-label">掷骰</span></button>
      </div>
      <div id="turnInfo">第 <b id="turnNum">0</b> 回合</div>
      </div>`;

    this.prev = {};
    this._log = [];
    this._feedback = [];
    this._feedbackSeq = 0;
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
      viewAngle: root.querySelector('#viewAngleBtn'),
      viewAngleValue: root.querySelector('#viewAngleValue'),
      roll: root.querySelector('#rollBtn'),
      plan: root.querySelector('#planBtn'),
      ability: root.querySelector('#abilityBtn'),
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
    this._rollOn = true;        // 当前是否处于「可掷骰」的空闲回合
    this._planAvailable = false; // 是否拥有布局谋篇且尚未定策
    this._shortLandscapeApplied = false;
    window.addEventListener('resize', () => this._onViewportChange());
    window.addEventListener('orientationchange', () => this._onViewportChange());
    this._applyCollapse();
    this._onViewportChange();
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

    // 方案 B 三功资源：核心循环必须随时可见；流派身份在修习面板展开。
    const mech = (s.school && s.school.schoolMechanics) || {};
    const ss = s.schoolState || {};
    if (this.el.schoolProgress) {
      if (s.abilityState) {
        const ab = s.abilityState;
        const planName = { steady: '徐行拾句', guard: '留白养气', switch: '换韵生新' }[(ab.strategy || {}).plan] || '未定章法';
        this.el.schoolProgress.innerHTML = `<span class="school-progress-name">三功修习</span><span>心得 ${Number(ab.insight) || 0}　构思 ${Number((ab.strategy || {}).charges) || 0} · ${planName}　稿页 ${Number((ab.manuscript || {}).pages) || 0}</span>`;
      } else if (mech.type === 'bowen') {
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

    // 布局谋篇按钮：仅拥有该文心（planned_dice）时显示；已定策则禁用并提示已定策值
    if (this.el.plan) {
      const hasPlan = s.active.some(t => (t.effect || {}).type === 'planned_dice');
      const planned = s.plannedMoveDice != null;
      this._planAvailable = hasPlan && !planned;
      this.el.plan.style.display = hasPlan ? '' : 'none';
      this.el.plan.disabled = !this._planAvailable || !this._rollOn;
      this.el.plan.textContent = planned ? `布局谋篇·已定策${s.plannedMoveDice}格` : '布局谋篇';
    }
    if (this.el.ability) {
      const ab = s.abilityState || {};
      this.el.ability.textContent = `修习·心${Number(ab.insight) || 0} 策${Number((ab.strategy || {}).charges) || 0} 稿${Number((ab.manuscript || {}).pages) || 0}`;
      this.el.ability.disabled = !this._rollOn;
    }

    // 文心羁绊：当前已激活的组合
    const syn = (s.synergies || []);
    this.el.synList.innerHTML = syn.length
      ? `<div class="syn-h">文心羁绊</div>` + syn.map(sy =>
          `<span class="syn-chip" title="${sy.desc || ''}">✦ ${sy.name}</span>`).join('')
      : '';

    // 战报与即时数值反馈：数值事件由引擎主动推送，不轮询游戏状态。
    this._log = Array.isArray(s.log) ? s.log : [];
    this._renderLog();

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

  /** 引擎写入常规日志时立即刷新，避免等到下一次状态同步。 */
  recordLog(entry) {
    if (!entry) return;
    if (!this._log.includes(entry)) this._log = [...this._log, entry];
    this._renderLog();
  }

  /** 属性、灵感与上限变化的短时反馈流；最多保留三条，避免遮住操作区。 */
  recordChange(change = {}) {
    const kind = change.kind || 'note';
    const values = change.values || {};
    const value = Number(change.value) || 0;
    let detail = '';
    if (kind === 'attr') {
      detail = Object.entries(values).map(([key, amount]) => {
        const n = Number(amount) || 0;
        return `${ATTR_NAMES[key] || key} ${n > 0 ? '+' : ''}${n}`;
      }).join('、');
    } else if (kind === 'inspiration') {
      detail = `灵感 ${value > 0 ? '+' : ''}${value}`;
    } else if (kind === 'inspiration-max') {
      detail = `灵感上限 +${value}`;
    } else detail = String(change.detail || '状态已变化');
    if (!detail) return;
    const tone = kind === 'inspiration' && value < 0
      ? 'loss'
      : (kind === 'attr' && Object.values(values).every(v => Number(v) < 0) ? 'loss' : 'gain');
    const entry = {
      id: ++this._feedbackSeq,
      kind,
      tone,
      reason: String(change.reason || '即时结算'),
      detail
    };
    this._feedback = [...this._feedback, entry].slice(-3);
    this._renderLog();
    const cleanupTimer = setTimeout(() => {
      this._feedback = this._feedback.filter(item => item.id !== entry.id);
      this._renderLog();
    }, 4300);
    if (cleanupTimer && typeof cleanupTimer.unref === 'function') cleanupTimer.unref();
  }

  _renderLog() {
    if (!this.el || !this.el.log) return;
    const feedback = this._feedback.map(item => `
      <div class="log-delta ${escapeAttr(item.tone)}">
        <span class="log-delta-kind">${item.kind === 'attr' ? '才学' : item.kind === 'inspiration-max' ? '心源' : '灵感'}</span>
        <b>${escapeAttr(item.detail)}</b><span class="log-delta-reason">${escapeAttr(item.reason)}</span>
      </div>`).join('');
    const history = this._log.slice(-30).map(item =>
      `<div class="log-entry"><span class="log-turn">${Number(item.turn) || 0}</span><span>${escapeAttr(item.text)}</span></div>`
    ).join('');
    this.el.log.innerHTML = `
      <div class="log-head"><b>进程记录</b><span>即时反馈</span></div>
      <div class="log-feedback" aria-live="polite" aria-label="本次资源变化">${feedback}</div>
      <div class="log-history">${history}</div>`;
    this.el.log.scrollTop = this.el.log.scrollHeight;
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

  choiceEcho({ choiceText, resultText, leadText = '已选择' }) {
    const el = document.createElement('div');
    el.className = 'toast choice-echo';
    const picked = document.createElement('div');
    picked.className = 'choice-echo-picked';
    picked.textContent = `${leadText}：${choiceText}`;
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
    this._rollOn = on;
    if (this.el.plan) this.el.plan.disabled = !on || !this._planAvailable;
    if (this.el.ability) this.el.ability.disabled = !on;
  }
  onRoll(fn) { this.el.roll.addEventListener('click', fn); }
  onPlan(fn) { this.el.plan.addEventListener('click', fn); }
  onAbility(fn) { this.el.ability.addEventListener('click', fn); }
  onViewAngle(fn) { this.el.viewAngle.addEventListener('click', fn); }

  setViewAngleState(state = {}) {
    const button = this.el.viewAngle;
    if (!button) return;
    const visible = !!state.visible;
    const angle = Number(state.angle) || 28;
    const label = state.label || '标准';
    button.hidden = !visible;
    button.disabled = !state.enabled;
    this.el.viewAngleValue.textContent = `${angle}°`;
    button.setAttribute('aria-label', `地图视角：${label} ${angle} 度，点击切换`);
    button.title = `地图视角：${label} ${angle}°（点击切换）`;
  }
}

function escapeAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
