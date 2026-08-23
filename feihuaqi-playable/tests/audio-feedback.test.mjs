/* audio-feedback.test.mjs —— 程序化音效总线、语义声纹与静音回归 */
import { JSDOM } from 'file:///C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom/lib/api.js';

const dom = new JSDOM('<!doctype html><body><button id="sound"></button></body>', {
  url: 'http://localhost/',
  pretendToBeVisual: true
});
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;

class Param {
  constructor(value = 0) { this.value = value; }
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  cancelScheduledValues() {}
}

class Node {
  constructor() { this.connections = []; }
  connect(target) { this.connections.push(target); return target; }
}

class FakeAudioContext {
  static instances = [];
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 8000;
    this.state = 'suspended';
    this.destination = new Node();
    this.created = { gain: 0, compressor: 0, oscillator: 0, buffer: 0, source: 0, filter: 0, panner: 0 };
    FakeAudioContext.instances.push(this);
  }
  createGain() {
    this.created.gain++;
    const node = new Node();
    node.gain = new Param(1);
    return node;
  }
  createDynamicsCompressor() {
    this.created.compressor++;
    const node = new Node();
    for (const key of ['threshold', 'knee', 'ratio', 'attack', 'release']) node[key] = new Param();
    return node;
  }
  createOscillator() {
    this.created.oscillator++;
    const node = new Node();
    node.frequency = new Param();
    node.detune = new Param();
    node.start = () => {};
    node.stop = () => {};
    return node;
  }
  createBuffer(channels, length) {
    this.created.buffer++;
    return { getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    this.created.source++;
    const node = new Node();
    node.start = () => {};
    node.stop = () => {};
    return node;
  }
  createBiquadFilter() {
    this.created.filter++;
    const node = new Node();
    node.frequency = new Param();
    node.Q = new Param();
    return node;
  }
  createStereoPanner() {
    this.created.panner++;
    const node = new Node();
    node.pan = new Param();
    return node;
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
}

window.AudioContext = FakeAudioContext;
window.webkitAudioContext = undefined;

let pass = 0;
let fail = 0;
const ok = (condition, name, detail = '') => {
  if (condition) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` [${detail}]` : ''}`); }
};

const audio = await import('../js/ui/audio.js');
audio.initAudio(document.querySelector('#sound'));
audio.unlock();
const context = FakeAudioContext.instances[0];

console.log('[1] 总线与完整语义声纹');
ok(FakeAudioContext.instances.length === 1, '只创建一个共享 AudioContext');
ok(context.created.gain >= 3 && context.created.compressor === 1, 'Master / SFX / Music 总线均建立并接入限幅');

const ducked = [];
audio.setDuckCallback(name => ducked.push(name));
const cues = [
  ['click'], ['confirm'], ['deny'], ['choice'], ['dice', { value: 6 }],
  ['move', { index: 5, final: true }], ['right'], ['wrong', { timedOut: true }],
  ['gain', { amount: 8 }], ['spend', { amount: 3 }], ['score', { index: 2, lead: 1 }],
  ['talent'], ['stage'], ['sky'], ['win'], ['lose'], ['unlock']
];
for (const [name, details] of cues) ok(audio.play(name, details) === true, `可播放语义音效：${name}`);
ok(context.created.oscillator > 20 && context.created.buffer > 8, '音高层与材质噪声层均实际生成');
ok(['dice', 'right', 'wrong', 'talent', 'stage', 'sky', 'win', 'lose', 'unlock'].every(x => ducked.includes(x)), '关键反馈会触发配乐闪避');
ok(audio.play('missing-cue') === false, '未知声纹静默失败，不影响游戏');

console.log('[2] 静音与按钮语义');
audio.setMuted(true);
ok(audio.isMuted() && audio.play('right') === false, '静音后不再创建声音事件');
audio.setMuted(false);
ok(!audio.isMuted(), '取消静音后恢复声音系统');

await new Promise(resolve => setTimeout(resolve, 70));
const beforeConfirm = context.created.oscillator;
const confirm = document.createElement('button');
confirm.className = 'btn btn-primary';
document.body.appendChild(confirm);
confirm.click();
ok(context.created.oscillator > beforeConfirm, '主按钮自动获得确认声');

const beforeRoll = context.created.oscillator;
const roll = document.createElement('button');
roll.id = 'rollBtn';
document.body.appendChild(roll);
roll.click();
ok(context.created.oscillator === beforeRoll, '掷骰按钮不叠加通用点击声');

console.log('[3] 自适应配乐复用同一总线');
const music = await import('../js/ui/music.js');
music.setScene('battle');
music.setTension(0.8);
music.setStage(3);
music.stopMusic();
ok(FakeAudioContext.instances.length === 1, '配乐与音效复用同一个 AudioContext');

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
if (fail) process.exit(1);
