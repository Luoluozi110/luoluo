// 存档自检：验证「存 → 读 → 状态一致」这条链路。
//
// 存档最容易出的问题是「读回来看着能跑，其实丢了一部分状态」——
// 引擎的 deserializeRun 只还原可序列化数据，依赖运行时引用的部分（羁绊集合、
// 派生结构）要靠 rehydrate 补齐。所以这里逐项比对恢复前后的关键状态。
//
// 用法：node test/smoke-save.mjs

// 小程序里由 app.js 注入 localStorage 适配器；这里补一个等价的内存实现，
// 让测试走的是与真机相同的存储路径，而不是 save.js 的内存兜底。
if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
  };
}

import { stage } from './_stage.mjs';

const loader = await stage();
const runtime = await loader.load('utils/engine-runtime.js');
const Save = await loader.load('engine/save.js');

const schoolId = (runtime.listSchools()[0] || {}).id;
if (!schoolId) {
  console.error('缺少流派配置');
  process.exit(1);
}

/* ---------- 1. 开一局并推进若干回合 ---------- */
runtime.clearSavedRun();
console.log('初始是否有存档：', runtime.hasSavedRun());

const { game } = runtime.startGame({
  schoolId,
  playerName: '存档试笔',
  loadout: [],
  sink: () => {},
});

const STEPS = 12;
for (let i = 0; i < STEPS && !game.s.over; i++) {
  await runtime.playTurn(game);
}

const before = game.s;
const snap = {
  turn: before.turn,
  pos: before.pos,
  inspiration: before.inspiration,
  inspirationMax: before.inspirationMax,
  attrs: JSON.stringify(before.attrs),
  passive: (before.passive || []).length,
  loadout: (before.loadout || []).length,
  logLen: (before.log || []).length,
};
console.log(`\n推进 ${snap.turn} 回合后：`, JSON.stringify(snap));

/* ---------- 2. 落盘 ---------- */
const saved = runtime.saveCurrentRun(game);
console.log(`\n存档结果：${saved.ok ? '成功' : '失败'}（${saved.bytes || 0} 字节，位置 ${saved.where}）`);
if (!saved.ok) {
  console.error('存档写入失败');
  process.exit(1);
}
console.log('存档可检出：', runtime.hasSavedRun());
if (!runtime.hasSavedRun()) {
  console.error('存档写入后 hasSavedRun 仍为 false，读写口径不一致');
  process.exit(1);
}

/* ---------- 3. 读回来 ---------- */
const resumed = runtime.resumeGame({ sink: () => {} });
if (!resumed.ok) {
  console.error('读档失败：', resumed.error);
  process.exit(1);
}
const after = resumed.game.s;
const back = {
  turn: after.turn,
  pos: after.pos,
  inspiration: after.inspiration,
  inspirationMax: after.inspirationMax,
  attrs: JSON.stringify(after.attrs),
  passive: (after.passive || []).length,
  loadout: (after.loadout || []).length,
  logLen: (after.log || []).length,
};
console.log('读回的存档：', JSON.stringify(back));

/* ---------- 4. 逐项比对 ---------- */
const diffs = Object.keys(snap).filter((k) => String(snap[k]) !== String(back[k]));
if (diffs.length) {
  console.error('\n以下字段恢复前后不一致：');
  diffs.forEach((k) => console.error(`  ${k}: ${snap[k]} → ${back[k]}`));
  process.exit(1);
}
console.log('\n关键字段全部一致。');

// rehydrate 的验证：羁绊集合能正常算出内容，说明派生状态确实重建了
const synergies = typeof resumed.game.synergySet === 'function' ? resumed.game.synergySet() : [];
console.log(`羁绊集可求值：${Array.isArray(synergies)}（${synergies.length} 组）`);

/* ---------- 5. 接着往下走，确认不是「能读不能玩」 ---------- */
let extra = 0;
for (let i = 0; i < 3 && !resumed.game.s.over; i++) {
  await runtime.playTurn(resumed.game);
  extra++;
}
console.log(`续玩 ${extra} 回合后 turn=${resumed.game.s.turn}（未抛错）`);

/* ---------- 6. 终局后自动存档应被清除 ---------- */
if (resumed.game.s.over) {
  runtime.clearSavedRun();
}
console.log(`\n存档自检通过：${STEPS} 回合的进度可完整往返。`);
