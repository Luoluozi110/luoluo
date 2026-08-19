/**
 * album.js（UI 层）—— 装配界面 / 图鉴界面 / 本局新解锁 / 成绩图。
 * 只做表现，所有数据读写一律走 engine/album.js，不碰引擎规则。
 */
import * as Album from '../engine/album.js';
import { play } from './audio.js';
import { sting } from './music.js';
import { precisionScale } from './quality.js';

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 取典故第一句，卡面上只放一句 */
function firstSentence(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  const i = t.indexOf('。');
  return i >= 0 ? t.slice(0, i + 1) : t;
}

/** 六维评语：按最高维给一句 */
const TOP_COMMENT = {
  wencai: '文采斐然，落笔生花',
  gongli: '根基深厚，厚积薄发',
  zhanji: '百战文场，杀伐果断',
  qiyu: '奇缘际会，行万里路',
  liupai: '独树一门，自成一家',
  yuanman: '善始善终，功德圆满'
};

export class AlbumUI {
  /**
   * @param {object} opts - { loadoutEl, albumEl, layerEl, cards }
   */
  constructor({ loadoutEl, albumEl, layerEl, topEl, cards }) {
    this.loadoutEl = loadoutEl;
    this.albumEl = albumEl;
    this.layerEl = layerEl;
    // 新解锁/成绩图需要盖住结算页与图鉴页，走独立顶层
    this.topEl = topEl || document.getElementById('topLayer') || layerEl;
    this.cards = cards || [];
    this.selected = [];
  }

  /* ==================================================== 装配界面 */

  /**
   * @param {object} opts - { schoolName, onStart(cards), onBack(), onAlbum() }
   */
  openLoadout(opts) {
    this._loOpts = opts || {};
    const store = Album.loadStore();
    this.selected = store.loadout.filter(id => store.unlocked.includes(id)).slice(0, Album.LOADOUT_MAX);
    this._renderLoadout(store);
    this.loadoutEl.classList.add('on');
  }

  closeLoadout() { this.loadoutEl.classList.remove('on'); }

  _renderLoadout(store) {
    const o = this._loOpts;
    const unlockedCount = this.cards.filter(c => store.unlocked.includes(c.id)).length;
    const grid = this.cards.map(c => this._cardHtml(c, store, { pick: true })).join('');

    // 三段式：固定头（含常驻返回键）+ 内部滚动卡片区 + 固定底部操作条
    this.loadoutEl.innerHTML = `
      <div class="lo-inner scroll-frame paper">
        <div class="lo-head">
          <button class="btn btn-ink btn-sm panel-back" data-back>返回改选流派</button>
          <div class="title-ink" style="font-size:32px;text-align:center">裝 配 名 篇</div>
          <div class="subtitle" style="text-align:center;margin-top:4px">
            流派「${esc(o.schoolName || '—')}」已定　·　最多携带 ${Album.LOADOUT_MAX} 张传世名篇，其效力于开局一次性生效
          </div>
          <div class="lo-tip">已解锁 ${unlockedCount} / ${this.cards.length} 篇；未解锁者仅存剪影，达成条件后自现真容。</div>
        </div>
        <div class="lo-scroll">
          <div class="album-grid">${grid}</div>
        </div>
        <div class="lo-foot">
          <div class="lo-bar">
            <span class="lo-count">已选 <b>${this.selected.length}</b> ／ ${Album.LOADOUT_MAX}</span>
            <button class="btn btn-ink btn-sm" data-album>翻阅图鉴</button>
            <button class="btn btn-primary" data-start>开始游戏</button>
          </div>
        </div>
      </div>`;

    // 重渲染后保持滚动位置，避免选卡时卡片区跳回顶部
    const sc = this.loadoutEl.querySelector('.lo-scroll');
    if (sc && this._loScrollTop) sc.scrollTop = this._loScrollTop;
    if (sc) sc.addEventListener('scroll', () => { this._loScrollTop = sc.scrollTop; });

    this.loadoutEl.querySelectorAll('.album-card:not(.locked)').forEach(b =>
      b.addEventListener('click', () => this._toggle(b.dataset.id, store)));
    this.loadoutEl.querySelector('[data-back]').addEventListener('click', () => {
      this.closeLoadout();
      if (o.onBack) o.onBack();
    });
    this.loadoutEl.querySelector('[data-album]').addEventListener('click', () => {
      if (o.onAlbum) o.onAlbum();
    });
    this.loadoutEl.querySelector('[data-start]').addEventListener('click', () => {
      const picked = this.cards.filter(c => this.selected.includes(c.id));
      const s = Album.loadStore();
      s.loadout = this.selected.slice();
      Album.saveStore(s);
      this.closeLoadout();
      if (o.onStart) o.onStart(picked);
    });
  }

  _toggle(id, store) {
    const i = this.selected.indexOf(id);
    if (i >= 0) this.selected.splice(i, 1);
    else {
      if (this.selected.length >= Album.LOADOUT_MAX) this.selected.shift();
      this.selected.push(id);
    }
    this._renderLoadout(store);
  }

  /* ==================================================== 图鉴界面 */

  /** @param {object} opts - { onBack() } */
  openAlbum(opts) {
    this._abOpts = opts || {};
    this._renderAlbum();
    this.albumEl.classList.add('on');
  }

  closeAlbum() { this.albumEl.classList.remove('on'); }

  _renderAlbum() {
    const store = Album.loadStore();
    const st = store.stats;
    const got = this.cards.filter(c => store.unlocked.includes(c.id)).length;
    const grid = this.cards.map(c => this._cardHtml(c, store, { pick: false })).join('');

    // 三段式：固定头（含常驻返回键）+ 内部滚动卡片区 + 固定底部操作条。
    // 返回键同时出现在头部右上与底部，任何滚动位置都在视口内（Critic V2）。
    this.albumEl.innerHTML = `
      <div class="ab-inner scroll-frame paper">
        <div class="ab-head">
          <button class="btn btn-ink btn-sm panel-back" data-back>返回</button>
          <div class="title-ink" style="font-size:32px;text-align:center">傳 世 名 篇</div>
          <div class="subtitle" style="text-align:center;margin-top:4px">
            已解锁 ${got} ／ ${this.cards.length}　·　累计战绩与图鉴存于本机浏览器
          </div>
          <div class="ab-stats">
            <span>对局 ${st.games}</span><span>论战胜 ${st.wins}</span><span>答对 ${st.quizzes}</span>
            <span>奇遇 ${st.events}</span><span>封笔 ${st.fengbi}</span><span>殿试三连胜 ${st.palaceSweep}</span>
            <span>单局最高总评 ${st.maxTotal}</span>
          </div>
        </div>
        <div class="ab-scroll">
          <div class="album-grid big">${grid}</div>
        </div>
        <div class="ab-foot">
          <div class="ab-bar">
            <button class="btn btn-primary" data-back>返回</button>
          </div>
        </div>
      </div>`;

    this.albumEl.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => {
      this.closeAlbum();
      if (this._abOpts.onBack) this._abOpts.onBack();
    }));
  }

  /**
   * 独立存档码弹窗：可从主菜单或局内菜单调用，不再依附“传世名篇”。
   * @param {object} opts - { beforeExport(), onImported(result) }
   */
  openSaveTransfer(opts = {}) {
    const ov = document.createElement('div');
    ov.className = 'overlay save-transfer';
    ov.innerHTML = `
      <div class="modal paper" style="width:min(680px,calc(100vw - var(--safe-left) - var(--safe-right) - 24px))">
        <div class="mtitle"><h2>存 档 码</h2></div>
        <div style="font-size:13px;color:var(--mo-3);line-height:1.85;margin:6px 0 12px">
          存档码包含累计战绩与传世名篇图鉴、图鉴阁（对手／文心／羁绊／天象）进度、传承火种，以及自动／手动进行中对局。<br/>
          代码仅在设备间复制，不会上传；导入将覆盖本机同类进度。
        </div>
        <div class="save-transfer-actions">
          <button class="btn btn-primary" data-export>导出存档码</button>
          <button class="btn btn-ink" data-import>导入存档码</button>
          <button class="btn btn-ink" data-close>关闭</button>
        </div>
        <div class="ab-io" data-io></div>
      </div>`;
    this.topEl.appendChild(ov);
    const io = ov.querySelector('[data-io]');
    ov.querySelector('[data-export]').addEventListener('click', () => {
      if (opts.beforeExport) opts.beforeExport();
      this._exportPanel(io);
    });
    ov.querySelector('[data-import]').addEventListener('click', () => this._importPanel(io, opts.onImported));
    ov.querySelector('[data-close]').addEventListener('click', () => ov.remove());
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    return ov;
  }

  _exportPanel(io) {
    let code = '';
    try {
      code = Album.exportCode(Album.loadStore());
    } catch (e) {
      io.innerHTML = `<div class="io-msg bad">导出失败：${esc(e.message)}</div>`;
      return;
    }
    io.innerHTML = `
      <div class="io-box">
        <div class="io-title">全量存档码（含传世名篇图鉴、图鉴阁四类进度、累计战绩、传承与进行中对局；全选复制后妥善保存）</div>
        <textarea class="io-text" readonly rows="3">${esc(code)}</textarea>
        <div class="io-row">
          <button class="btn btn-sm btn-ink" data-copy>复制到剪贴板</button>
          <button class="btn btn-sm btn-ink" data-close>收起</button>
          <span class="io-msg" data-msg></span>
        </div>
      </div>`;
    const ta = io.querySelector('.io-text');
    ta.focus(); ta.select();
    io.querySelector('[data-copy]').addEventListener('click', async () => {
      const msg = io.querySelector('[data-msg]');
      try {
        ta.select();
        if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(code);
        else document.execCommand('copy');
        msg.textContent = '已复制';
        msg.className = 'io-msg ok';
      } catch (e) {
        msg.textContent = '复制失败，请手动全选复制';
        msg.className = 'io-msg bad';
      }
    });
    io.querySelector('[data-close]').addEventListener('click', () => { io.innerHTML = ''; });
  }

  _importPanel(io, onImported) {
    io.innerHTML = `
      <div class="io-box">
        <div class="io-title">粘贴全量存档码。导入将覆盖本机传世名篇图鉴、图鉴阁四类进度、累计战绩、传承及进行中对局；请确认已备份当前进度。</div>
        <textarea class="io-text" rows="3" placeholder="在此粘贴存档码"></textarea>
        <div class="io-row">
          <button class="btn btn-sm btn-primary" data-do>确认导入</button>
          <button class="btn btn-sm btn-ink" data-close>取消</button>
          <span class="io-msg" data-msg></span>
        </div>
      </div>`;
    const ta = io.querySelector('.io-text');
    const msg = io.querySelector('[data-msg]');
    io.querySelector('[data-do]').addEventListener('click', () => {
      if (!confirm('导入会覆盖本机现有进度（含进行中对局）。确认继续吗？')) return;
      try {
        const result = Album.importCode(ta.value);
        msg.textContent = result.legacy
          ? '旧版图鉴码导入成功（不含进行中对局），正在刷新……'
          : '完整存档导入成功，正在刷新……';
        msg.className = 'io-msg ok';
        if (onImported) onImported(result);
        setTimeout(() => location.reload(), 700);
      } catch (e) {
        msg.textContent = '导入失败：' + e.message;
        msg.className = 'io-msg bad';
      }
    });
    io.querySelector('[data-close]').addEventListener('click', () => { io.innerHTML = ''; });
    ta.focus();
  }

  /* ==================================================== 卡面 */

  _cardHtml(card, store, opts) {
    const unlocked = store.unlocked.includes(card.id);
    const on = opts.pick && this.selected.includes(card.id);
    const prog = Album.progressOf(card, store.stats);
    const pct = Math.min(100, Math.round(100 * prog.cur / prog.need));

    if (!unlocked) {
      return `<div class="album-card locked" data-id="${card.id}">
        <div class="ac-silhouette">？</div>
        <div class="ac-name">未 解 锁</div>
        <div class="ac-cond">${esc(Album.conditionText(card, store.stats))}</div>
        <div class="ac-prog"><i style="width:${pct}%"></i></div>
      </div>`;
    }
    return `<button class="album-card unlocked ${on ? 'on' : ''}" data-id="${card.id}">
      ${on ? '<span class="ac-flag">已装配</span>' : ''}
      <div class="ac-name">${esc(card.name)}</div>
      <div class="ac-reward">${esc(card.rewardDesc || '（无数值加成）')}</div>
      <div class="ac-text">${esc(firstSentence(card.text))}</div>
      <div class="ac-cond done">${esc(Album.conditionText(card, store.stats))} ✓</div>
    </button>`;
  }

  /* ================================================ 本局新解锁 */

  /** 结算前先播一段「本局新解锁」；无新卡则直接返回 */
  showNewUnlocks(list) {
    const cards = list || [];
    if (!cards.length) return Promise.resolve();
    return new Promise(resolve => {
      const ov = document.createElement('div');
      ov.className = 'overlay unlock-overlay';
      ov.innerHTML = `
        <div class="unlock-box paper scroll-frame">
          <div class="title-ink" style="font-size:30px;text-align:center">本 局 新 解 鎖</div>
          <div class="subtitle" style="text-align:center;margin-top:4px">
            共 ${cards.length} 篇入册，下局可于「装配名篇」中携带
          </div>
          <div class="unlock-list">
            ${cards.map((c, i) => `
              <div class="unlock-item" style="animation-delay:${i * 0.22}s">
                <div class="ui-name">${esc(c.name)}</div>
                <div class="ui-reward">${esc(c.rewardDesc || '')}</div>
                <div class="ui-text">${esc(firstSentence(c.text))}</div>
              </div>`).join('')}
          </div>
          <div style="text-align:center;margin-top:14px">
            <button class="btn btn-primary" data-ok>收入囊中</button>
          </div>
        </div>`;
      this.topEl.appendChild(ov);
      play('unlock');
      sting('unlock');        // 图鉴解锁配乐：金石开卷
      ov.querySelector('[data-ok]').addEventListener('click', () => {
        ov.style.transition = 'opacity .22s';
        ov.style.opacity = '0';
        setTimeout(() => { ov.remove(); resolve(); }, 230);
      });
    });
  }

  /* ==================================================== 成绩图 */

  /** 弹出成绩图预览 + 保存 */
  openScoreCard(summary) {
    const canvas = drawScoreCard(summary);
    const ov = document.createElement('div');
    ov.className = 'overlay score-overlay';
    ov.innerHTML = `
      <div class="score-box paper">
        <div class="sc-title">成绩图</div>
        <div class="sc-canvas"></div>
        <div class="btn-row">
          <button class="btn btn-primary" data-save>保存图片</button>
          <button class="btn btn-ink" data-close>关闭</button>
        </div>
      </div>`;
    ov.querySelector('.sc-canvas').appendChild(canvas);
    this.topEl.appendChild(ov);
    ov.querySelector('[data-save]').addEventListener('click', () => {
      const a = document.createElement('a');
      a.download = `飞花棋成绩_${summary.grade.name}_${summary.total}.png`;
      a.href = canvas.toDataURL('image/png');
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
    ov.querySelector('[data-close]').addEventListener('click', () => ov.remove());
  }
}

/* ============================================ 成绩图绘制 800×450 */

const CANVAS_FONT = '"汇文明朝体", "Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, SimSun, "宋体", serif';

export function drawScoreCard(sum) {
  const W = 800, H = 450;
  // 省电档锁 1x，高分档按 DPR 提像素比（更锐利）；逻辑坐标仍按 W/H 绘制
  const scale = precisionScale();
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
  const g = cv.getContext('2d');
  if (scale !== 1) g.scale(scale, scale);

  /* 底：宣纸渐变（替代平涂） */
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#f7f0dd'); bg.addColorStop(.55, '#efe4c9'); bg.addColorStop(1, '#e5d4b1');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  /* 暖光高光（左上） */
  const hl = g.createRadialGradient(W * 0.22, H * 0.13, 10, W * 0.22, H * 0.13, W * 0.95);
  hl.addColorStop(0, 'rgba(255,255,255,.7)'); hl.addColorStop(1, 'rgba(214,196,160,0)');
  g.fillStyle = hl; g.fillRect(0, 0, W, H);
  /* 纸纤维：极淡斜向细线 */
  g.save(); g.globalAlpha = .05; g.strokeStyle = '#a08c69'; g.lineWidth = 1;
  for (let x = -H; x < W; x += 7) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + H, H); g.stroke(); }
  g.restore();
  /* 四角描金角饰 */
  (function corners() {
    const m = 30, L = 26, t = 3, col = '#c9971f';
    g.strokeStyle = col; g.lineWidth = t; g.lineCap = 'round';
    const seg = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    seg(m, m + L, m, m); seg(m, m, m + L, m);
    seg(W - m - L, m, W - m, m); seg(W - m, m, W - m, m + L);
    seg(m, H - m - L, m, H - m); seg(m, H - m, m + L, H - m);
    seg(W - m - L, H - m, W - m, H - m); seg(W - m, H - m - L, W - m, H - m);
  })();

  /* 外框 */
  g.strokeStyle = '#8d6a45'; g.lineWidth = 6;
  g.strokeRect(10, 10, W - 20, H - 20);
  g.strokeStyle = 'rgba(120,100,70,.45)'; g.lineWidth = 1;
  g.strokeRect(20, 20, W - 40, H - 40);

  /* 顶部游戏名 */
  g.fillStyle = '#483f34';
  g.font = `20px ${CANVAS_FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('桃 花 岛 · 诗 词 楹 联 飞 花 棋', W / 2, 46);
  g.strokeStyle = 'rgba(120,100,70,.35)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(70, 64); g.lineTo(W - 70, 64); g.stroke();

  /* 左：品级大字（加柔光投影） */
  const gname = (sum.grade && sum.grade.name) || '童生';
  g.save();
  g.shadowColor = 'rgba(178,58,46,.35)'; g.shadowBlur = 18; g.shadowOffsetY = 3;
  g.fillStyle = '#b23a2e';
  g.font = `92px ${CANVAS_FONT}`;
  g.fillText(gname, 138, 176);
  g.restore();
  g.fillStyle = '#483f34';
  g.font = `24px ${CANVAS_FONT}`;
  g.fillText(`总评 ${sum.total}`, 138, 244);
  const st = sum.state || {};
  const b = st.battle || {};
  g.fillStyle = '#7a6d5d';
  g.font = `15px ${CANVAS_FONT}`;
  g.fillText(`胜 ${b.win || 0}　平 ${b.draw || 0}　负 ${b.loss || 0}`, 138, 274);
  g.fillText(`奇遇 ${st.events ? st.events.total : 0} 次　${st.turn || 0} 回合`, 138, 298);

  /* 中：六维雷达（六边形） */
  const dims = sum.dims || [];
  const cx = 400, cy = 210, R = 96;
  const maxV = Math.max(1, ...dims.map(d => d.score));
  const ang = i => (-90 + i * 60) * Math.PI / 180;
  const pt = (i, r) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];

  for (const f of [0.25, 0.5, 0.75, 1]) {
    g.beginPath();
    dims.forEach((_, i) => {
      const [x, y] = pt(i, R * f);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.closePath();
    g.strokeStyle = 'rgba(90,74,52,.28)'; g.lineWidth = 1;
    g.stroke();
  }
  dims.forEach((_, i) => {
    const [x, y] = pt(i, R);
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y);
    g.strokeStyle = 'rgba(90,74,52,.22)'; g.stroke();
  });

  g.save();
  g.shadowColor = 'rgba(201,151,31,.45)'; g.shadowBlur = 16;
  g.beginPath();
  dims.forEach((d, i) => {
    const [x, y] = pt(i, Math.max(4, R * (d.score / maxV)));
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  });
  g.closePath();
  g.fillStyle = 'rgba(201,151,31,.34)';
  g.fill();
  g.restore();
  g.beginPath();
  dims.forEach((d, i) => {
    const [x, y] = pt(i, Math.max(4, R * (d.score / maxV)));
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  });
  g.closePath();
  g.strokeStyle = '#c9971f'; g.lineWidth = 2.5;
  g.stroke();

  g.fillStyle = '#5a4a34';
  g.font = `13px ${CANVAS_FONT}`;
  dims.forEach((d, i) => {
    const [x, y] = pt(i, R + 20);
    g.fillText(String(d.name || '').replace('分', ''), x, y);
  });

  /* 右：六个数值条 */
  const bx = 552, bw = 200;
  let by = 108;
  g.textAlign = 'left';
  for (const d of dims) {
    g.fillStyle = '#483f34';
    g.font = `14px ${CANVAS_FONT}`;
    g.fillText(d.name, bx, by);
    g.textAlign = 'right';
    g.fillStyle = '#b23a2e';
    g.font = `15px ${CANVAS_FONT}`;
    g.fillText(String(d.score), bx + bw, by);
    g.textAlign = 'left';
    g.fillStyle = 'rgba(120,100,70,.22)';
    g.fillRect(bx, by + 10, bw, 8);
    g.fillStyle = '#c9971f';
    g.fillRect(bx, by + 10, Math.max(2, bw * (d.score / maxV)), 8);
    by += 38;
  }

  /* 底：评语 */
  const key = sum.topDim || 'wencai';
  const comment = TOP_COMMENT[key] || '文心一片，长路未央';
  g.textAlign = 'center';
  g.fillStyle = '#262019';
  g.font = `26px ${CANVAS_FONT}`;
  g.fillText(`「${comment}」`, W / 2, 396);
  g.fillStyle = '#7a6d5d';
  g.font = `13px ${CANVAS_FONT}`;
  g.fillText(sum.reasonText || '', W / 2, 422);

  /* 朱印 */
  g.save();
  g.translate(714, 372);
  g.rotate(-6 * Math.PI / 180);
  g.fillStyle = '#b23a2e';
  g.fillRect(-26, -26, 52, 52);
  g.fillStyle = '#fff2ee';
  g.font = `17px ${CANVAS_FONT}`;
  g.textBaseline = 'middle';
  g.fillText('桃花', 0, -11);
  g.fillText('文印', 0, 11);
  g.restore();

  /* 画面暗角 */
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, W * 0.62);
  vg.addColorStop(0, 'rgba(40,28,16,0)');
  vg.addColorStop(1, 'rgba(40,28,16,.20)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);

  return cv;
}
