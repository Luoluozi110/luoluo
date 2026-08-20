/**
 * audio.js —— 程序化音效（WebAudio API 合成，零外部音频文件，完全离线可用）
 *
 * 设计基准：全案第 6 章「水墨 / 宋代美学」——
 *   取五声音阶（宫商角徵羽 = C D E G A）为音高骨架，
 *   木质骰声、古琴拨弦、编钟叩击、埙管低吟，均以振荡器 + 噪声 + 包络合成。
 *
 * 浏览器 autoplay 策略：AudioContext 只在「首次用户交互」时创建/resume。
 * 静音状态存 localStorage('fhq.audio.muted')，跨局记忆。
 *
 * 只被 js/ui/* 调用，不触碰 js/engine/*。
 */

const LS_KEY = 'fhq.audio.muted';
const MASTER_GAIN = 0.42;
/** 音乐总线基准增益；music.js 的配乐层挂在它之下（与 SFX 共用 Master） */
export const MUSIC_GAIN = 0.7;

/** 五声音阶（C 宫），单位 Hz */
const P = {
  gong: 523.25,   // C5 宫
  shang: 587.33,  // D5 商
  jue: 659.25,    // E5 角
  zhi: 783.99,    // G5 徵
  yu: 880.00,     // A5 羽
  gongHi: 1046.5, // C6
  gongLo: 261.63, // C4
  zhiLo: 392.00,  // G4
  yuLo: 220.00    // A3
};

let ctx = null;
let master = null;
let musicBus = null;          // 音乐输出总线（music.js 的配乐层挂在此下）
let muted = readMuted();
let unlocked = false;
let toggleEl = null;
let firstUnlocked = false;    // 首次用户交互后变 true
const unlockCbs = [];         // 首次解锁后统一触发的回调（音乐在此真正起播）
let duckCb = null;            // SFX 触发的音乐闪避（ducking）回调

/* ------------------------------------------------------------ 存储 */

function readMuted() {
  try { return localStorage.getItem(LS_KEY) === '1'; } catch (e) { return false; }
}
function writeMuted(v) {
  try { localStorage.setItem(LS_KEY, v ? '1' : '0'); } catch (e) { /* 隐私模式忽略 */ }
}

/* -------------------------------------------------- AudioContext */

/** 惰性创建；未经用户交互时浏览器可能给出 suspended 状态，交互后自动 resume */
function ac() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_GAIN;
    master.connect(ctx.destination);
    if (!musicBus) {
      musicBus = ctx.createGain();
      musicBus.gain.value = MUSIC_GAIN;
      musicBus.connect(master);   // Master = SFX 直连 + Music 总线
    }
  } catch (e) {
    ctx = null;
  }
  return ctx;
}

/** 首次用户交互后解锁音频；重复调用无副作用 */
export function unlock() {
  const c = ac();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  unlocked = true;
  if (!firstUnlocked) {
    firstUnlocked = true;
    while (unlockCbs.length) { try { unlockCbs.shift()(); } catch (e) { /* 忽略单个回调异常 */ } }
  }
}

/** 注册「首次用户交互后」回调（音乐系统借此真正起播 AudioContext） */
export function onFirstUnlock(cb) {
  if (firstUnlocked) { try { cb(); } catch (e) {} }
  else unlockCbs.push(cb);
}

/** 在 document 上挂一次性解锁钩子（pointerdown / keydown / touchstart） */
export function attachUnlock() {
  const once = () => {
    unlock();
    ['pointerdown', 'keydown', 'touchstart'].forEach(t =>
      document.removeEventListener(t, once, true));
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach(t =>
    document.addEventListener(t, once, true));
}

/* ------------------------------------------------- 音乐系统共享接口 */

/** 返回共享 AudioContext（可能尚未创建，返回 null 即尚未解锁） */
export function getAudioContext() { return ctx; }

/** 返回音乐输出总线（music.js 的配乐层挂在此节点下） */
export function getMusicBus() { return musicBus; }

/** 注册 SFX → 音乐闪避（ducking）回调：强 SFX 播放时短暂压低配乐 */
export function setDuckCallback(fn) { duckCb = fn; }

/* ------------------------------------------------------ 合成原语 */

const now = () => (ctx ? ctx.currentTime : 0);

/**
 * 单音：振荡器 + ADSR 包络（+ 可选滑音、可选带通）
 * @param {object} o - {freq,to,type,t,dur,gain,attack,q,filter}
 */
function tone(o) {
  if (!ctx || muted) return;
  const t0 = now() + (o.t || 0);
  const dur = o.dur ?? 0.28;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);

  const peak = o.gain ?? 0.3;
  const atk = o.attack ?? 0.006;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  let node = osc;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = o.filter;
    f.frequency.setValueAtTime(o.fc || 1200, t0);
    f.Q.value = o.q ?? 1;
    osc.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** 噪声簇：木质/纸质质感（骰子、落子、翻页） */
function noise(o) {
  if (!ctx || muted) return;
  const t0 = now() + (o.t || 0);
  const dur = o.dur ?? 0.09;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);

  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = o.filter || 'bandpass';
  f.frequency.setValueAtTime(o.fc || 900, t0);
  f.Q.value = o.q ?? 1.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.22, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/** 拨弦：基频 + 二次泛音，短促衰减（古琴/古筝质感） */
function pluck(freq, t, gain = 0.26, dur = 0.42) {
  tone({ freq, type: 'triangle', t, dur, gain, attack: 0.004 });
  tone({ freq: freq * 2, type: 'sine', t: t + 0.004, dur: dur * 0.55, gain: gain * 0.34 });
}

/** 叩钟：基频 + 非整数倍泛音，长尾（编钟/磬） */
function bell(freq, t, gain = 0.24, dur = 1.1) {
  tone({ freq, type: 'sine', t, dur, gain, attack: 0.005 });
  tone({ freq: freq * 2.76, type: 'sine', t, dur: dur * 0.7, gain: gain * 0.3 });
  tone({ freq: freq * 5.4, type: 'sine', t, dur: dur * 0.4, gain: gain * 0.14 });
}

/* -------------------------------------------------------- 音效表 */

const SFX = {
  /** ① 掷骰：木骰翻滚三下 + 落桌 */
  dice() {
    for (let i = 0; i < 4; i++) {
      noise({ t: i * 0.075, dur: 0.055, fc: 780 + Math.random() * 520, q: 2.2, gain: 0.2 });
    }
    noise({ t: 0.33, dur: 0.13, fc: 420, q: 1.1, gain: 0.3 });
    tone({ freq: 180, to: 96, type: 'sine', t: 0.33, dur: 0.16, gain: 0.16 });
  },

  /** ② 棋子移动：一记轻拨弦，落子如落墨 */
  move() {
    pluck(P.zhi, 0, 0.17, 0.26);
    noise({ t: 0.01, dur: 0.045, fc: 1700, q: 2.6, gain: 0.09 });
  },

  /** ③ 答对：清脆上行三音（角—徵—宫），带钟尾 */
  right() {
    pluck(P.jue, 0, 0.22, 0.3);
    pluck(P.zhi, 0.085, 0.24, 0.32);
    bell(P.gongHi, 0.175, 0.2, 0.95);
  },

  /** ④ 答错：低沉下行二音 + 闷响 */
  wrong() {
    tone({ freq: P.zhiLo, to: 233, type: 'triangle', dur: 0.34, gain: 0.24 });
    tone({ freq: 174.6, to: 116, type: 'sine', t: 0.14, dur: 0.5, gain: 0.22 });
    noise({ t: 0.02, dur: 0.15, filter: 'lowpass', fc: 300, gain: 0.14 });
  },

  /** ⑤ 战斗胜利：五声上行琶音 + 双钟齐鸣 */
  win() {
    [P.gong, P.shang, P.jue, P.zhi, P.yu].forEach((f, i) => pluck(f, i * 0.075, 0.2, 0.38));
    bell(P.gongHi, 0.38, 0.26, 1.5);
    bell(P.zhi, 0.42, 0.16, 1.3);
  },

  /** ⑥ 战斗失败：下行叹息 */
  lose() {
    [P.zhi, P.jue, P.shang, P.gongLo].forEach((f, i) =>
      tone({ freq: f, type: 'triangle', t: i * 0.1, dur: 0.34, gain: 0.17 }));
    tone({ freq: 130.8, type: 'sine', t: 0.34, dur: 0.8, gain: 0.2 });
  },

  /** ⑦ 天象切换：风吟 + 磬音长尾 */
  sky() {
    noise({ dur: 0.9, filter: 'bandpass', fc: 620, q: 0.7, gain: 0.11 });
    bell(P.yu, 0.05, 0.2, 1.7);
    tone({ freq: P.shang, to: P.yu, type: 'sine', t: 0.1, dur: 0.85, gain: 0.11 });
  },

  /** ⑧ 按钮点击：一记极短的纸墨轻叩 */
  click() {
    noise({ dur: 0.032, fc: 2100, q: 3.4, gain: 0.11 });
    tone({ freq: P.gongHi, type: 'sine', dur: 0.05, gain: 0.06 });
  },

  /** ⑨ 图鉴解锁：金石开卷 */
  unlock() {
    bell(P.zhi, 0, 0.24, 1.4);
    pluck(P.gongHi, 0.12, 0.2, 0.5);
    noise({ t: 0, dur: 0.35, filter: 'bandpass', fc: 3200, q: 0.9, gain: 0.08 });
  }
};

/**
 * 播放音效。
 * @param {'dice'|'move'|'right'|'wrong'|'win'|'lose'|'sky'|'click'|'unlock'} name
 */
export function play(name) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  if (c.state === 'suspended') {
    // 尚未解锁：静默丢弃，避免堆积在恢复瞬间齐鸣
    if (!unlocked) return;
    c.resume().catch(() => {});
  }
  const fn = SFX[name];
  if (fn) { try { fn(); } catch (e) { /* 单次播放失败不影响游戏 */ } }
  // 强 SFX 播放时触发音乐闪避（ducking），让音效更突出
  if (duckCb && DUCK_SET.has(name)) { try { duckCb(); } catch (e) {} }
}

/** 触发音乐闪避的强 SFX（骰子/胜负/天象/解锁） */
const DUCK_SET = new Set(['dice', 'win', 'lose', 'sky', 'unlock']);

/* -------------------------------------------------------- 静音开关 */

export function isMuted() { return muted; }

export function setMuted(v) {
  muted = !!v;
  writeMuted(muted);
  if (master && ctx) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(muted ? 0 : MASTER_GAIN, ctx.currentTime);
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

/** 挂载 HUD 角落的静音小图标 */
export function mountToggle(el) {
  if (!el) return;
  toggleEl = el;
  toggleEl.classList.add('sound-toggle');
  paintToggle();
  toggleEl.addEventListener('click', e => {
    e.stopPropagation();
    unlock();
    const nowMuted = toggleMuted();
    if (!nowMuted) play('click');   // 开启时给一声反馈
  });
}

/** 全局按钮点击音：捕获阶段委托，覆盖所有 UI 层按钮，无需逐文件挂钩 */
export function bindGlobalClicks() {
  document.addEventListener('click', e => {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('.sound-toggle')) return;             // 开关自身另有反馈
    if (t.closest('.btn, .school-card, .opt, .pick, .album-card, .replace-item, .at-btn')) {
      play('click');
    }
  }, true);
}

/** 一次性初始化：解锁钩子 + 全局点击音 + 静音图标 */
export function initAudio(toggleHost) {
  attachUnlock();
  bindGlobalClicks();
  mountToggle(toggleHost);
}
