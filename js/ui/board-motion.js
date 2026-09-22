/** 棋盘动效只消费表现事件；不修改路线状态，不延长引擎移动等待。 */
export class BoardMotion {
  constructor(root) {
    this.root = root;
    this.effects = new Set();
    this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.reduced?.addEventListener?.('change', () => {
      if (this.reduced.matches) this.clear();
    });
    const onVisibility = () => {
      root.dataset.motionPaused = String(root.ownerDocument.hidden);
      if (root.ownerDocument.hidden) this.clear();
    };
    root.ownerDocument.addEventListener('visibilitychange', onVisibility);
    onVisibility();
  }

  get enabled() {
    return !this.reduced?.matches && !this.root.ownerDocument.hidden &&
      this.root.ownerDocument.documentElement.dataset.quality !== 'low';
  }

  clear() {
    for (const effect of [...this.effects]) effect.cancel();
  }

  animate(el, frames, options, remove = false) {
    if (!el || !this.enabled || typeof el.animate !== 'function') {
      if (remove) el?.remove();
      return;
    }
    const animation = el.animate(frames, { easing: 'ease-out', ...options });
    // 同步取消清理，避免重建、切圈或连续触发时遗留 DOM 与动画引用。
    const effect = { cancel: () => { animation.cancel(); cleanup(); } };
    const cleanup = () => {
      this.effects.delete(effect);
      if (remove) el.remove();
    };
    animation.onfinish = cleanup;
    animation.oncancel = cleanup;
    this.effects.add(effect);
  }

  step(fromCell, pieceBody) {
    if (!this.enabled) return;
    this.animate(pieceBody, [
      { transform: 'translateY(0) scale(1)' },
      { transform: 'translateY(-9px) scale(.98, 1.04)', offset: .42 },
      { transform: 'translateY(0) scale(1)' }
    ], { duration: 150 });
    if (!fromCell || fromCell.style.display === 'none') return;
    const trace = this.root.ownerDocument.createElement('i');
    trace.className = 'board-ink-trace';
    trace.setAttribute('aria-hidden', 'true');
    fromCell.appendChild(trace);
    this.animate(trace, [{ opacity: .45, transform: 'scale(.75)' },
      { opacity: 0, transform: 'scale(1.12)' }], { duration: 420 }, true);
  }

  land(cell) {
    if (!cell || cell.style.display === 'none' || !this.enabled) return;
    const ripple = this.root.ownerDocument.createElement('i');
    ripple.className = 'board-landing-ripple';
    ripple.setAttribute('aria-hidden', 'true');
    cell.appendChild(ripple);
    this.animate(ripple, [{ opacity: .8, transform: 'scale(.8)' },
      { opacity: 0, transform: 'scale(1.55)' }], { duration: 480 }, true);
  }

  reveal(cells, gate) {
    if (!this.enabled) return;
    const visible = cells.filter(el => el.style.display !== 'none');
    visible.forEach((el, i) => this.animate(el,
      [{ opacity: .28 }, { opacity: 1 }],
      { duration: 260, fill: 'backwards', delay: i * Math.min(12, 520 / Math.max(1, visible.length - 1)) }));
    this.animate(gate?.querySelector('.waypoint-art'), [
      { transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: .4 }, { transform: 'scale(1)' }
    ], { duration: 650 });
    this.land(gate);
  }
}
