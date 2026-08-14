/**
 * music.js —— 自适应程序化配乐（WebAudio 合成，零外部音频文件，完全离线可用）
 *
 * 与 audio.js（音效 SFX）共用同一 AudioContext 与 Master 总线：
 *
 *        Master ── SFX 总线（audio.js 直连）
 *              └─ Music 总线（musicBus，本模块持有，基准增益 MUSIC_GAIN=0.7）
 *                    ├─ pad    长音和弦垫（所有场景常驻，连续无疲劳）
 *                    ├─ arp    古琴拨弦琶音（对局/论战）
 *                    ├─ pulse  木质节拍（对局轻点 / 论战加密）
 *                    ├─ bell   编钟清音（待机/菜单/结算点缀）
 *                    └─ drone  低音长鸣（论战张力推动）
 *
 * 设计基准（同 audio.js 第 6 章「水墨 / 宋代美学」）：五声音阶（宫商角徵羽 = C D E G A）
 * 为音高骨架，古琴拨弦、编钟叩击、木质节拍均以振荡器 + 噪声 + 包络合成。
 *
 * 振幅规划（最终到扬声器 ≈ 音符峰值 × 层增益 × MUSIC_GAIN × MASTER_GAIN）：
 *   配乐床峰值约 0.05–0.10，可闻但低于强 SFX（≈0.1–0.13），互不掩盖；强 SFX 触发时再 duck 到 35%。
 *
 * 自适应维度：
 *   scene  —— 界面/场景（idle 待机标题 / menu 装配 / board 对局 / battle 论战 / result 结算）
 *   tension—— 论战紧张度 0..1（提高琶音密度、开启低音 drone、轻微加速）
 * 所有场景切换走 1.2s 线性淡入淡出，绝不硬切；采用前瞻调度器（lookahead scheduler）
 * 逐拍合成，避免 GC 抖动与爆音。浏览器 autoplay 策略：首次用户交互后才真正起播。
 */

import { getAudioContext, getMusicBus, onFirstUnlock, setDuckCallback, isMuted, MUSIC_GAIN } from './audio.js';

/* ------------------------------------------------------------ 配置 */

/** 音乐层同时发声节点上限（远低于 Web Audio 数百上限，为 SFX 留足余量） */
const MUSIC_BUDGET_VOICES = 16;

/** 五声音阶（C 宫），与 audio.js 同基准（单位 Hz） */
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

/**
 * 场景 → 各层目标增益（0 即该层静默）。
 * arp / pulse / drone 还会被 tension 在运行时再缩放。
 */
const SCENE = {
  idle:   { bpm: 56, pad: 0.45, arp: 0.00, pulse: 0.00, bell: 0.40, drone: 0.00 }, // 待机标题
  menu:   { bpm: 60, pad: 0.40, arp: 0.18, pulse: 0.00, bell: 0.30, drone: 0.00 }, // 装配名篇
  board:  { bpm: 66, pad: 0.40, arp: 0.28, pulse: 0.22, bell: 0.00, drone: 0.00 }, // 对局行进
  battle: { bpm: 92, pad: 0.36, arp: 0.36, pulse: 0.34, bell: 0.00, drone: 0.30 }, // 挥毫论战
  result: { bpm: 60, pad: 0.42, arp: 0.00, pulse: 0.00, bell: 0.32, drone: 0.00 }  // 科场结算
};

/** 四小节和声进行（宫 → 徵 → 商 → 羽），每小节一个根音 */
const ROOTS = [P.gong, P.zhi, P.shang, P.yu];

/* ------------------------------------------------------------ 状态 */

let bus = null;            // musicBus 节点
let layers = null;         // {pad,arp,pulse,bell,drone} 各层增益节点
let started = false;
let scene = 'idle';
let tension = 0;
let timer = null;
let nextTime = 0;
let step = 0;
const LOOK = 0.12;         // 前瞻窗口（秒）
const TICK = 25;           // 调度器轮询间隔（毫秒）
const STEPS_PER_BAR = 8;   // 每小节八分音符数
const BARS = 4;            // 进行长度（小节）

/* ------------------------------------------------------------ 创建/起播 */

/** 惰性建链：拿到共享 AudioContext 与各层增益节点 */
function ensure() {
  const ctx = getAudioContext();
  if (!ctx || !ctx.createGain) return false;
  if (bus) return true;
  bus = getMusicBus();
  if (!bus) return false;
  layers = {};
  for (const k of ['pad', 'arp', 'pulse', 'bell', 'drone']) {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(bus);
    layers[k] = g;
  }
  applyScene(true);
  return true;
}

/** 启动调度器；若 AudioContext 尚未解锁，则等待首次交互后自动起播 */
function start() {
  if (started) return;
  if (!ensure()) { onFirstUnlock(start); return; }
  started = true;
  const ctx = getAudioContext();
  nextTime = ctx.currentTime + 0.08;
  timer = setInterval(tick, TICK);
  setDuckCallback(duck);   // 注册：强 SFX 时压低配乐
}

export function initMusic() { /* 占位：调度器由 start() 在首次解锁后真正建链 */ }

/** 切换场景配乐床（首次调用会触发起播） */
export function setScene(name) {
  if (SCENE[name]) scene = name;
  if (!started) { start(); return; }
  applyScene(false);
}

/** 设置论战紧张度 0..1（影响琶音密度 / 低音 drone / 速度） */
export function setTension(v) { tension = Math.max(0, Math.min(1, v)); }

/** 停止配乐（保留场景状态，可随时 setScene 重启） */
export function stopMusic() {
  if (timer) { clearInterval(timer); timer = null; }
  started = false;
}

/* ------------------------------------------------- 场景切换（淡变） */

/** 将各层增益拉到当前场景的目标值；immediate=true 时用于首次建链（瞬时） */
function applyScene(immediate) {
  if (!layers) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const s = SCENE[scene];
  const t = ctx.currentTime;
  const ramp = (node, val) => {
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(Math.max(0.0001, node.gain.value), t);
    node.gain.linearRampToValueAtTime(val, t + (immediate ? 0.02 : 1.2));
  };
  ramp(layers.pad, s.pad);
  ramp(layers.arp, s.arp * (0.6 + 0.4 * tension));
  ramp(layers.pulse, s.pulse * (0.5 + 0.5 * tension));
  ramp(layers.bell, s.bell);
  ramp(layers.drone, s.drone * tension);
}

/* ------------------------------------------------- 调度器 */

function tick() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (isMuted()) return;                 // 静音时跳过发声，省 CPU；解除静音后自动续上
  while (nextTime < ctx.currentTime + LOOK) {
    scheduleStep(step, nextTime);
    const bpm = SCENE[scene].bpm * (scene === 'battle' ? (1 + 0.12 * tension) : 1);
    nextTime += 60 / bpm / 2;            // 八分音符时长
    step = (step + 1) % (STEPS_PER_BAR * BARS);
  }
}

function scheduleStep(step, time) {
  const ctx = getAudioContext();
  if (!ctx || !layers) return;
  const bar = Math.floor(step / STEPS_PER_BAR) % BARS;
  const bib = step % STEPS_PER_BAR;      // 小节内拍点（0..7）
  // 各层当前实际增益，用于决定是否发声（静默层不调度节点，守住语音预算）
  const g = {};
  for (const k in layers) g[k] = layers[k].gain.value;

  const bpm = SCENE[scene].bpm * (scene === 'battle' ? (1 + 0.12 * tension) : 1);
  const spb = 60 / bpm / 2;             // 八分音符秒数
  const barLen = spb * STEPS_PER_BAR;

  const root = ROOTS[bar];
  const chord = [root, root * 1.5, root * 2]; // 纯五度叠置，避讳不协和的二度

  if (g.pad > 0.002) padChord(chord, time, barLen * 0.98, 0.09, layers.pad);
  if (g.drone > 0.002) droneNote(P.gongLo, time, barLen * 0.98, 0.22, layers.drone);
  // 待机/菜单：每两小节一次清钟
  if (g.bell > 0.002 && bib === 0 && bar % 2 === 0) bellNote(P.yuLo * 2, time, 0.5, layers.bell);
  // 对局/论战：八分音符偶数拍古琴拨弦
  if (g.arp > 0.002 && bib % 2 === 0) {
    const seq = [P.gong, P.shang, P.zhi, P.yu, P.zhi, P.shang];
    pluckNote(seq[(step >> 1) % seq.length], time, 0.5, layers.arp);
  }
  // 木质节拍：四分音符（0、4 拍）；论战紧张时 2、6 拍加密
  if (g.pulse > 0.002 && (bib === 0 || bib === 4 || (tension > 0.5 && (bib === 2 || bib === 6)))) {
    woodTick(time, 0.5, layers.pulse);
  }
}

/* ------------------------------------------------- 合成原语 */

/** 单音包络：dest 之下 osc → gain（指数 AD），peak 为该音标称峰值 */
function env(dest, time, dur, peak, attack) {
  const ctx = getAudioContext();
  const o = ctx.createOscillator();
  const gn = ctx.createGain();
  o.connect(gn);
  gn.connect(dest);
  gn.gain.setValueAtTime(0.0001, time);
  gn.gain.exponentialRampToValueAtTime(peak, time + (attack ?? 0.01));
  gn.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  return o;
}

/** 长音和弦垫（pad）：基音(peak) + 微失谐三角泛音(peak×0.3)，缓入缓出 */
function padChord(freqs, time, dur, peak, dest) {
  freqs.forEach(f => {
    const o = env(dest, time, dur, peak, 0.25);
    o.type = 'sine'; o.frequency.value = f; o.start(time); o.stop(time + dur + 0.05);
    const o2 = env(dest, time, dur, peak * 0.3, 0.3);
    o2.type = 'triangle'; o2.frequency.value = f * 2; o2.detune.value = 4;
    o2.start(time); o2.stop(time + dur + 0.05);
  });
}

/** 低音长鸣（drone）：论战张力推动 */
function droneNote(f, time, dur, peak, dest) {
  const o = env(dest, time, dur, peak, 0.3);
  o.type = 'sine'; o.frequency.value = f; o.start(time); o.stop(time + dur + 0.05);
}

/** 编钟清音（bell）：基频(peak) + 非整数倍泛音(peak×0.35)，长尾 */
function bellNote(f, time, peak, dest) {
  const o = env(dest, time, 1.6, peak, 0.005);
  o.type = 'sine'; o.frequency.value = f; o.start(time); o.stop(time + 1.7);
  const o2 = env(dest, time, 1.0, peak * 0.35, 0.005);
  o2.type = 'sine'; o2.frequency.value = f * 2.76; o2.start(time); o2.stop(time + 1.1);
}

/** 古琴拨弦（pluck）：基频(peak) + 二次泛音(peak×0.35)，短促衰减 */
function pluckNote(f, time, peak, dest) {
  const o = env(dest, time, 0.45, peak, 0.004);
  o.type = 'triangle'; o.frequency.value = f; o.start(time); o.stop(time + 0.5);
  const o2 = env(dest, time + 0.004, 0.25, peak * 0.35, 0.004);
  o2.type = 'sine'; o2.frequency.value = f * 2; o2.start(time + 0.004); o2.stop(time + 0.3);
}

/** 木质节拍（woodTick）：短噪声簇，带通，峰值 peak */
function woodTick(time, peak, dest) {
  const ctx = getAudioContext();
  const len = Math.max(1, Math.floor(ctx.sampleRate * 0.06));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 820; f.Q.value = 2.0;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(time); src.stop(time + 0.08);
}

/* ------------------------------------------ 动画短旋律（sting） */

/**
 * 为关键动画节拍点缀的短旋律，直连 Music 总线（不受场景淡变影响，即时响应）。
 * @param {'dice'|'reveal'|'win'|'lose'|'unlock'|'sky'} name
 */
export function sting(name) {
  const ctx = getAudioContext();
  if (!ctx || !bus) return;
  if (isMuted()) return;
  const t = ctx.currentTime + 0.01;
  const B = bus;
  if (name === 'dice') {
    [P.gong, P.shang, P.zhi].forEach((f, i) => pluckNote(f, t + i * 0.06, 0.4, B));
  } else if (name === 'reveal') {
    bellNote(P.zhi, t, 0.4, B);
    pluckNote(P.gong, t + 0.08, 0.35, B);
  } else if (name === 'win') {
    [P.gong, P.shang, P.jue, P.zhi, P.yu].forEach((f, i) => pluckNote(f, t + i * 0.07, 0.4, B));
    bellNote(P.gongHi, t + 0.4, 0.4, B);
  } else if (name === 'lose') {
    [P.zhi, P.jue, P.shang, P.gongLo].forEach((f, i) => pluckNote(f, t + i * 0.09, 0.38, B));
  } else if (name === 'unlock') {
    bellNote(P.zhi, t, 0.45, B);
    pluckNote(P.gongHi, t + 0.12, 0.4, B);
  } else if (name === 'sky') {
    bellNote(P.yu, t, 0.4, B);
    pluckNote(P.shang, t + 0.06, 0.32, B);
  }
}

/* ------------------------------------------------- 闪避（ducking） */

/** 强 SFX 播放时把 Music 总线短暂压到 35%，0.4s 内恢复，避免掩盖音效 */
function duck() {
  const ctx = getAudioContext();
  if (!ctx || !bus) return;
  const t = ctx.currentTime;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), t);
  bus.gain.linearRampToValueAtTime(MUSIC_GAIN * 0.35, t + 0.02);
  bus.gain.linearRampToValueAtTime(MUSIC_GAIN, t + 0.4);
}
