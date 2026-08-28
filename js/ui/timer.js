/**
 * timer.js —— 通用 30 秒倒计时条（纯表现层）。
 * 题卡与战斗审题共用：进度条从满走到空，最后 5 秒转红预警。
 * 超时只负责回调，真正的判定由引擎 / 调用方决定。
 */

export function createCountdown(seconds = 30, onTimeout) {
  const total = Math.max(1, Number(seconds) || 30);
  const el = document.createElement('div');
  el.className = 'countdown';
  el.innerHTML = `
    <span class="cd-label">限时</span>
    <div class="cd-track"><div class="cd-fill"></div></div>
    <span class="cd-num">${total}</span>
    <span class="cd-unit">秒</span>`;

  const fill = el.querySelector('.cd-fill');
  const num = el.querySelector('.cd-num');
  let left = total;
  let stopped = false;

  const id = setInterval(() => {
    left -= 1;
    num.textContent = Math.max(0, left);
    fill.style.width = Math.max(0, (100 * left) / total) + '%';
    if (left <= 5) el.classList.add('urgent');
    if (left <= 0) {
      stop();
      el.classList.add('over');
      if (typeof onTimeout === 'function') onTimeout();
    }
  }, 1000);

  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(id);
  }

  return {
    el,
    stop,
    get left() { return left; },
    get expired() { return left <= 0; }
  };
}
