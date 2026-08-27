/**
 * contentTest.js —— 版本测试「全内容解锁」页面。
 * 负责页面表现与交互，数据修改统一委托给 engine/content-test.js。
 */

import * as ContentTest from '../engine/content-test.js';

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const percent = (got, total) => total ? Math.round((got / total) * 100) : 100;

export class ContentTestUI {
  constructor({ el, cfg }) {
    this.el = el;
    this.cfg = cfg;
    this.onBack = null;
    this.onChanged = null;
    this._onKeyDown = e => {
      if (e.key === 'Escape' && this.el.classList.contains('on')) this.close();
    };
  }

  open(opts = {}) {
    this.onBack = opts.onBack || null;
    this.onChanged = opts.onChanged || null;
    this._render();
    this.el.classList.add('on');
    document.addEventListener('keydown', this._onKeyDown);
    requestAnimationFrame(() => this.el.querySelector('[data-apply]')?.focus());
  }

  close() {
    this.el.classList.remove('on');
    document.removeEventListener('keydown', this._onKeyDown);
    if (this.onBack) this.onBack();
  }

  _metric(title, value, desc, tone = 'zhu') {
    const pct = percent(value.got, value.total);
    const complete = value.got >= value.total;
    return `<article class="ct-metric ${complete ? 'complete' : ''}">
      <div class="ct-metric-top"><span class="ct-metric-kicker">${esc(title)}</span><span class="ct-metric-state ${tone}">${complete ? '已齐备' : `${pct}%`}</span></div>
      <div class="ct-metric-value">${value.got}<small> / ${value.total}</small></div>
      <div class="ct-meter" aria-label="${esc(title)}完成度"><i style="width:${pct}%"></i></div>
      <div class="ct-metric-desc">${esc(desc)}</div>
    </article>`;
  }

  _render(message = '') {
    const summary = ContentTest.getContentTestSummary(this.cfg);
    const allDone = summary.album.got === summary.album.total
      && summary.mastery.got === summary.mastery.total
      && summary.foes.got === summary.foes.total
      && summary.talents.got === summary.talents.total
      && summary.synergies.got === summary.synergies.total
      && summary.sky.got === summary.sky.total;
    const status = allDone ? '全内容已就绪' : '待执行测试解锁';
    const statusClass = allDone ? 'ready' : 'idle';

    this.el.innerHTML = `<div class="ct-inner scroll-frame paper">
      <header class="ct-head">
        <div class="ct-brand"><span class="ct-seal">QA</span><span>VERSION TEST / 本地测试工具</span></div>
        <button type="button" class="btn btn-ink btn-sm ct-close" data-back aria-label="返回主菜单">返回主菜单</button>
        <div class="title-ink ct-title">全 内 容 解 锁</div>
        <div class="ct-subtitle">全图鉴 · 全流派满级 · 全传世名篇</div>
        <div class="ct-status ${statusClass}"><i></i>${status}</div>
      </header>

      <main class="ct-scroll">
        <section class="ct-hero">
          <div>
            <div class="ct-eyebrow">CONTENT UNLOCK SUITE</div>
            <h2>一键准备完整测试环境</h2>
            <p>将当前浏览器中的图鉴阁、传世名篇与流派造诣写入测试状态，返回主菜单后即可直接检验全内容展示与入局装配。</p>
          </div>
          <div class="ct-hero-glyph" aria-hidden="true">全</div>
        </section>

        <section class="ct-section">
          <div class="ct-section-head"><span>01</span><h3>测试覆盖范围</h3><em>跨局存档</em></div>
          <div class="ct-metrics">
            ${this._metric('传世名篇', summary.album, '全部名篇解锁，成长经验升至 Lv4；两条成长路线仍可自由选择。', 'gold')}
            ${this._metric('流派造诣', summary.mastery, '全部流派达到 Lv5「登峰造极」。', 'zhu')}
            ${this._metric('对手图鉴', summary.foes, '全部对手已邂逅，并开放三层认知与详情战绩。', 'qing')}
            ${this._metric('文心图鉴', summary.talents, '全部文心已获得，历史最高等级同步到当前配置上限。', 'purple')}
            ${this._metric('羁绊图鉴', summary.synergies, '全部羁绊标记为已达成，便于验证组合效果展示。', 'green')}
            ${this._metric('天象图鉴', summary.sky, '全部天象标记为已邂逅，便于验证图鉴分页与详情。', 'blue')}
          </div>
        </section>

        <section class="ct-section ct-note-section">
          <div class="ct-section-head"><span>02</span><h3>执行说明</h3><em>可恢复</em></div>
          <div class="ct-notes">
            <div class="ct-note"><b>先备份</b><span>首次执行前会自动保存当前跨局进度；重复执行不会覆盖这份快照。</span></div>
            <div class="ct-note"><b>仅本机</b><span>数据写入浏览器 localStorage，不上传云端，也不会修改进行中的棋局。</span></div>
            <div class="ct-note"><b>可回滚</b><span>测试结束点击“恢复测试前进度”，即可撤销本页写入的图鉴与造诣状态。</span></div>
          </div>
        </section>
        ${message ? `<div class="ct-feedback" role="status">${esc(message)}</div>` : ''}
      </main>

      <footer class="ct-foot">
        <div class="ct-foot-meta"><span class="ct-dot ${summary.hasBackup ? 'on' : ''}"></span>${summary.hasBackup ? '已有可恢复快照' : '尚未创建测试快照'}</div>
        <div class="ct-actions">
          <button type="button" class="btn btn-ink" data-restore ${summary.hasBackup ? '' : 'disabled'}>恢复测试前进度</button>
          <button type="button" class="btn btn-primary" data-apply>写入全量测试数据</button>
        </div>
      </footer>
    </div>`;

    this.el.querySelector('[data-back]')?.addEventListener('click', () => this.close());
    this.el.querySelector('[data-apply]')?.addEventListener('click', () => this._apply());
    this.el.querySelector('[data-restore]')?.addEventListener('click', () => this._restore());
  }

  _apply() {
    if (!confirm('将把本机图鉴与流派造诣设为全解锁测试状态。当前进度会先自动备份，确认继续吗？')) return;
    const result = ContentTest.applyFullContentUnlock(this.cfg);
    this._render(result.backupCreated ? '全量测试数据已写入；原进度已备份，可随时恢复。' : '全量测试数据已刷新；仍可恢复首次执行前的进度。');
    this.onChanged?.();
  }

  _restore() {
    if (!confirm('恢复后将撤销本页首次执行时写入的跨局测试状态，确认恢复吗？')) return;
    const result = ContentTest.restoreContentTestBackup();
    if (!result.ok) { this._render(result.reason); return; }
    this._render('已恢复测试前进度。');
    this.onChanged?.();
  }
}
