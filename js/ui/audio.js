/**
 * audio.js —— 《文心棋》程序化声音反馈（WebAudio，离线可用）
 *
 * 声音公式：宋代书房近场木/纸/石/金材质 + C 宫五声骨架 + 克制短尾；
 * 只有结果、天象、文心与阶段跃迁使用钟磬长尾。动作先确认，结果再定性，
 * 配乐始终退在反馈之后。浏览器首次交互前不创建 AudioContext。
 */

const LS_KEY = 'fhq.audio.muted';
const MASTER_GAIN = 0.56;
const SFX_GAIN = 0.82;
/** music.js 的场景配乐总线基准；关键 SFX 会暂时压低此总线。 */
export const MUSIC_GAIN = 0.58;

/** C 宫五声音阶，单位 Hz。 */
const P = {
  gong: 523.25,
  shang: 587.33,
  jue: 659.25,
  zhi: 783.99,
  yu: 880,
  gongHi: 1046.5,
  gongLo: 261.63,
  zhiLo: 392,
  yuLo: 220
};
const STEP_SCALE = [P.gong, P.shang, P.jue, P.zhi, P.yu, P.zhi, P.jue, P.shang];

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let muted = readMuted();
let unlocked = false;
let firstUnlocked = false;
let toggleEl = null;
let duckCb = null;
let clicksBound = false;
let lifecycleBound = false;
const unlockCbs = [];
const lastPlayedAt = new Map();

const COOLDOWN_MS = {
  click: 38,
  confirm: 60,
  deny: 80,
  move: 62,
  choice: 70,
  gain: 110,
  spend: 110,
  score: 85
};

function readMuted() {
  try { return localStorage.getItem(LS_KEY) === '1'; } catch (e) { return false; }
}
function writeMuted(v) {
  try { localStorage.setItem(LS_KEY, v ? '1' : '0'); } catch (e) { /* 隐私模式忽略 */ }
}

/* -------------------------------------------------- AudioContext 与总线 */

function ac() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_GAIN;

    // 轻限幅负责拦截钟、噪声和配乐偶然同拍时的尖峰；不以压响度为目的。
    const limiter = typeof ctx.createDynamicsCompressor === 'function'
      ? ctx.createDynamicsCompressor()
      : null;
    if (limiter) {
      limiter.threshold.value = -18;
      limiter.knee.value = 12;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.22;
      limiter.connect(master);
    }
    const mixTarget = limiter || master;

    sfxBus = ctx.createGain();
    sfxBus.gain.value = SFX_GAIN;
    sfxBus.connect(mixTarget);

    musicBus = ctx.createGain();
    musicBus.gain.value = MUSIC_GAIN;
    musicBus.connect(mixTarget);

    master.connect(ctx.destination);
  } catch (e) {
    ctx = null;
    master = null;
    sfxBus = null;
    musicBus = null;
  }
  return ctx;
}

export function unlock() {
  const c = ac();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  unlocked = true;
  if (!firstUnlocked) {
    firstUnlocked = true;
    while (unlockCbs.length) {
      try { unlockCbs.shift()(); } catch (e) { /* 单个回调异常不阻断声音解锁 */ }
    }
  }
}

export function onFirstUnlock(cb) {
  if (firstUnlocked) { try { cb(); } catch (e) {} }
  else unlockCbs.push(cb);
}

export function attachUnlock() {
  const once = () => {
    unlock();
    ['pointerdown', 'keydown', 'touchstart'].forEach(type =>
      document.removeEventListener(type, once, true));
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach(type =>
    document.addEventListener(type, once, true));
}

function attachLifecycle() {
  if (lifecycleBound) return;
  lifecycleBound = true;
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) {
      if (ctx.state === 'running') ctx.suspend().catch(() => {});
    } else if (unlocked && !muted && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  });
}

export function getAudioContext() { return ctx; }
export function getMusicBus() { return musicBus; }
export function setDuckCallback(fn) { duckCb = fn; }

/* ------------------------------------------------------ 合成原语 */

const now = () => (ctx ? ctx.currentTime : 0);

function connectSpatial(node, gain, pan = 0) {
  if (!ctx || !sfxBus) return;
  if (pan && typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(panner);
    panner.connect(gain);
  } else {
    node.connect(gain);
  }
  gain.connect(sfxBus);
}

/** 振荡器单音：{freq,to,type,t,dur,gain,attack,filter,fc,q,pan}。 */
function tone(o) {
  if (!ctx || !sfxBus || muted) return;
  const t0 = now() + (o.t || 0);
  const dur = Math.max(0.025, o.dur ?? 0.28);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(Math.max(20, o.freq), t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);

  const peak = Math.max(0.0001, o.gain ?? 0.24);
  const attack = Math.min(dur * 0.45, o.attack ?? 0.006);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  let node = osc;
  if (o.filter) {
    const filter = ctx.createBiquadFilter();
    filter.type = o.filter;
    filter.frequency.setValueAtTime(o.fc || 1200, t0);
    filter.Q.value = o.q ?? 1;
    osc.connect(filter);
    node = filter;
  }
  connectSpatial(node, g, o.pan || 0);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** 噪声簇：纸、木、风等非音高材质。 */
function noise(o) {
  if (!ctx || !sfxBus || muted) return;
  const t0 = now() + (o.t || 0);
  const dur = Math.max(0.02, o.dur ?? 0.09);
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const decay = Math.pow(1 - i / len, o.decay ?? 1.25);
    data[i] = (Math.random() * 2 - 1) * decay;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = o.filter || 'bandpass';
  filter.frequency.setValueAtTime(o.fc || 900, t0);
  filter.Q.value = o.q ?? 1.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.18, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  source.connect(filter);
  connectSpatial(filter, g, o.pan || 0);
  source.start(t0);
  source.stop(t0 + dur + 0.02);
}

function pluck(freq, t = 0, gain = 0.22, dur = 0.36, pan = 0) {
  tone({ freq, type: 'triangle', t, dur, gain, attack: 0.004, pan });
  tone({ freq: freq * 2, type: 'sine', t: t + 0.004, dur: dur * 0.52, gain: gain * 0.28, pan });
}

function bell(freq, t = 0, gain = 0.2, dur = 1.05, pan = 0) {
  tone({ freq, type: 'sine', t, dur, gain, attack: 0.005, pan });
  tone({ freq: freq * 2.76, type: 'sine', t, dur: dur * 0.66, gain: gain * 0.26, pan });
  tone({ freq: freq * 5.4, type: 'sine', t, dur: dur * 0.36, gain: gain * 0.1, pan });
}

/* -------------------------------------------------------- 音效语义表 */

const SFX = {
  click() {
    noise({ dur: 0.035, fc: 2600, q: 3.2, gain: 0.085 });
    tone({ freq: P.gongHi, type: 'sine', dur: 0.045, gain: 0.045 });
  },

  confirm() {
    noise({ dur: 0.07, fc: 720, q: 1.6, gain: 0.14 });
    pluck(P.gong, 0.018, 0.14, 0.18);
  },

  deny() {
    noise({ dur: 0.11, filter: 'lowpass', fc: 310, q: 0.8, gain: 0.13 });
    tone({ freq: 190, to: 125, type: 'triangle', dur: 0.16, gain: 0.13 });
  },

  choice() {
    noise({ dur: 0.055, fc: 1850, q: 2.2, gain: 0.09 });
    pluck(P.shang, 0.015, 0.13, 0.2);
  },

  /** 木骰翻滚后，以点数对应的五声短音收口。 */
  dice({ value = 1, delay = 0 } = {}) {
    const n = Math.max(1, Math.min(6, Number(value) || 1));
    for (let i = 0; i < 5; i++) {
      noise({
        t: delay + i * 0.064,
        dur: 0.052,
        fc: 760 + ((i * 173 + n * 97) % 560),
        q: 2.1,
        gain: 0.16 + i * 0.008,
        pan: i % 2 ? 0.12 : -0.12
      });
    }
    noise({ t: delay + 0.33, dur: 0.12, fc: 410, q: 1.05, gain: 0.27 });
    tone({ freq: 175, to: 92, type: 'sine', t: delay + 0.33, dur: 0.15, gain: 0.14 });
    pluck(STEP_SCALE[n - 1], delay + 0.35, 0.12, 0.22);
  },

  /** 每步在五声音级中行进，末步稍重，长距离移动也不会成为同音连发。 */
  move({ index = 0, final = false } = {}) {
    const step = Math.abs(Number(index) || 0) % STEP_SCALE.length;
    const pan = ((step % 3) - 1) * 0.08;
    noise({ dur: final ? 0.075 : 0.045, fc: final ? 760 : 1420, q: 2.2, gain: final ? 0.14 : 0.075, pan });
    pluck(STEP_SCALE[step], 0.006, final ? 0.14 : 0.085, final ? 0.22 : 0.13, pan);
  },

  right() {
    pluck(P.jue, 0, 0.17, 0.24, -0.08);
    pluck(P.zhi, 0.075, 0.18, 0.26, 0.05);
    bell(P.gongHi, 0.16, 0.17, 0.78, 0.1);
  },

  wrong({ timedOut = false } = {}) {
    noise({ dur: 0.14, filter: 'lowpass', fc: timedOut ? 240 : 330, gain: 0.13 });
    tone({ freq: P.zhiLo, to: timedOut ? 196 : 233, type: 'triangle', dur: 0.3, gain: 0.18 });
    tone({ freq: 174.6, to: 116, type: 'sine', t: 0.12, dur: 0.42, gain: 0.15 });
  },

  gain({ amount = 1 } = {}) {
    const high = Number(amount) >= 5 ? P.zhi : P.jue;
    noise({ dur: 0.08, fc: 2300, q: 1.3, gain: 0.07 });
    pluck(P.shang, 0, 0.1, 0.16);
    pluck(high, 0.065, 0.115, 0.2);
  },

  spend() {
    noise({ dur: 0.12, filter: 'bandpass', fc: 540, q: 0.9, gain: 0.09, decay: 0.65 });
    tone({ freq: P.gongLo, to: P.yuLo, type: 'triangle', dur: 0.19, gain: 0.11 });
  },

  score({ index = 0, lead = 0 } = {}) {
    const i = Math.max(0, Number(index) || 0);
    const pan = lead > 0 ? -0.14 : lead < 0 ? 0.14 : 0;
    noise({ dur: 0.04, fc: 980 + i * 120, q: 2.4, gain: 0.085, pan });
    pluck(STEP_SCALE[i % 5], 0.006, 0.07, 0.11, pan);
  },

  talent() {
    noise({ dur: 0.28, fc: 2900, q: 0.8, gain: 0.075, decay: 0.55 });
    bell(P.zhi, 0.02, 0.19, 1.05, -0.08);
    pluck(P.gongHi, 0.11, 0.16, 0.42, 0.08);
  },

  stage() {
    noise({ dur: 0.34, filter: 'bandpass', fc: 460, q: 0.65, gain: 0.08, decay: 0.45 });
    bell(P.gongLo, 0.02, 0.18, 1.25, -0.12);
    bell(P.zhi, 0.16, 0.2, 1.15, 0.12);
    pluck(P.gongHi, 0.34, 0.12, 0.4);
  },

  sky() {
    noise({ dur: 0.9, filter: 'bandpass', fc: 610, q: 0.65, gain: 0.095, decay: 0.35 });
    tone({ freq: P.shang, to: P.yu, type: 'sine', t: 0.08, dur: 0.78, gain: 0.09 });
    bell(P.yu, 0.06, 0.16, 1.35);
  },

  win() {
    [P.gong, P.shang, P.jue, P.zhi, P.yu].forEach((freq, i) =>
      pluck(freq, i * 0.07, 0.16, 0.31, (i - 2) * 0.05));
    bell(P.gongHi, 0.36, 0.22, 1.35, -0.08);
    bell(P.zhi, 0.4, 0.12, 1.12, 0.1);
  },

  lose() {
    [P.zhi, P.jue, P.shang, P.gongLo].forEach((freq, i) =>
      tone({ freq, type: 'triangle', t: i * 0.09, dur: 0.3, gain: 0.13 }));
    noise({ t: 0.27, dur: 0.18, filter: 'lowpass', fc: 250, gain: 0.08 });
    tone({ freq: 130.8, type: 'sine', t: 0.31, dur: 0.7, gain: 0.16 });
  }
};

SFX.unlock = details => SFX.talent(details);

/**
 * 播放语义音效；details 用来让同一声音跟随实际点数、步数、得失量变化。
 * 未解锁或系统不支持 WebAudio 时静默失败，绝不影响玩法。
 */
export function play(name, details = {}) {
  if (muted) return false;
  const c = ac();
  if (!c) return false;
  if (c.state === 'suspended') {
    if (!unlocked) return false;
    c.resume().catch(() => {});
  }
  const fn = SFX[name];
  if (!fn) return false;

  const stamp = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  const cooldown = COOLDOWN_MS[name] || 0;
  if (cooldown && stamp - (lastPlayedAt.get(name) || -Infinity) < cooldown) return false;
  lastPlayedAt.set(name, stamp);

  try { fn(details || {}); } catch (e) { return false; }
  if (duckCb && DUCK_SET.has(name)) {
    try { duckCb(name); } catch (e) {}
  }
  return true;
}

const DUCK_SET = new Set(['dice', 'right', 'wrong', 'win', 'lose', 'sky', 'talent', 'unlock', 'stage']);

/* -------------------------------------------------------- 静音与 UI */

export function isMuted() { return muted; }

export function setMuted(v) {
  muted = !!v;
  writeMuted(muted);
  if (master && ctx) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(muted ? 0 : MASTER_GAIN, ctx.currentTime);
    if (!muted && ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
  }
  paintToggle();
}

export function toggleMuted() { setMuted(!muted); return muted; }

const ICON_ON = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4z" fill="currentColor"/>
  <path d="M15.4 9.1a4.2 4.2 0 010 5.8M17.8 6.6a7.6 7.6 0 010 10.8"
    stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>
</svg>`;

const ICON_OFF = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4z" fill="currentColor"/>
  <path d="M15.6 9.6l5 4.8M20.6 9.6l-5 4.8"
    stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>
</svg>`;

function paintToggle() {
  if (!toggleEl) return;
  toggleEl.classList.toggle('muted', muted);
  toggleEl.innerHTML = muted ? ICON_OFF : ICON_ON;
  toggleEl.title = muted ? '音效已关（点按开启）' : '音效已开（点按静音）';
  toggleEl.setAttribute('aria-label', toggleEl.title);
  toggleEl.setAttribute('aria-pressed', muted ? 'true' : 'false');
}

export function mountToggle(el) {
  if (!el) return;
  toggleEl = el;
  toggleEl.classList.add('sound-toggle');
  paintToggle();
  toggleEl.addEventListener('click', e => {
    e.stopPropagation();
    unlock();
    const nowMuted = toggleMuted();
    if (!nowMuted) play('confirm');
  });
}

/** 由控件语义选择声音；data-sfx 可显式覆盖，data-sfx="none" 可避免重复反馈。 */
export function bindGlobalClicks() {
  if (clicksBound) return;
  clicksBound = true;
  document.addEventListener('click', e => {
    const target = e.target;
    if (!target || !target.closest) return;
    const el = target.closest('button, .school-card, .opt, .pick, .album-card, .replace-item, .at-btn');
    if (!el || el.closest('.sound-toggle')) return;
    const explicit = el.dataset ? el.dataset.sfx : '';
    if (explicit === 'none') return;
    if (explicit) { play(explicit); return; }
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') { play('deny'); return; }
    if (el.matches('#rollBtn, .battle-roll, .at-btn')) return;
    if (el.matches('.btn-primary, [data-ok], [data-enter], #btConfirm')) play('confirm');
    else if (el.matches('.school-card, .opt, .pick, .album-card, .replace-item')) play('choice');
    else play('click');
  });
}

export function initAudio(toggleHost) {
  attachUnlock();
  attachLifecycle();
  bindGlobalClicks();
  mountToggle(toggleHost);
}
