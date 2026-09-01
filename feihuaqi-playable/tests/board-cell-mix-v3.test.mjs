import assert from 'node:assert/strict';
import fs from 'node:fs';

const board = JSON.parse(fs.readFileSync(new URL('../config/board.json', import.meta.url), 'utf8'));
const rings = board.rings || [];
const outer = rings.find((ring) => ring.id === 'outer');
const cells = rings.flatMap((ring) => ring.cells || []);

function counts(items) {
  return items.reduce((out, cell) => {
    out[cell.type] = (out[cell.type] || 0) + 1;
    return out;
  }, {});
}

assert.equal(cells.length, 192, '地图总格数保持 192');
assert.deepEqual(
  { ping: counts(cells).ping, ze: counts(cells).ze, event: counts(cells).event, quiz: counts(cells).quiz },
  { ping: 26, ze: 26, event: 45, quiz: 33 },
  '全盘应减少 12 个平/仄韵格，并等量增加奇遇与答题格',
);
assert.deepEqual(
  { ping: counts(outer.cells).ping, ze: counts(outer.cells).ze, event: counts(outer.cells).event, quiz: counts(outer.cells).quiz },
  { ping: 13, ze: 11, event: 19, quiz: 11 },
  '本轮改动集中在外圈，提高首局互动密度',
);

const expected = new Map([
  [3, 'event'], [10, 'quiz'], [12, 'quiz'], [16, 'event'],
  [24, 'event'], [29, 'quiz'], [32, 'quiz'], [35, 'event'],
  [39, 'event'], [48, 'quiz'], [50, 'quiz'], [67, 'event'],
]);
for (const [id, type] of expected) {
  const cell = outer.cells.find((item) => item.id === id);
  assert.equal(cell?.type, type, `外圈格子 ${id} 应改为 ${type}`);
  assert.equal(cell?.effect, undefined, `转换格 ${id} 不应残留平/仄韵专属效果`);
  assert.equal(cell?.phaseGate, undefined, `转换格 ${id} 不应承载阶段门`);
}

let runType = null;
let runLength = 0;
for (const cell of outer.cells || []) {
  if (cell.type === runType && (cell.type === 'event' || cell.type === 'quiz')) runLength += 1;
  else {
    runType = cell.type;
    runLength = 1;
  }
  assert.ok(runLength <= 2, '外圈不应出现连续 3 个同类奇遇或答题格');
}

const phaseGateIds = cells.filter((cell) => cell.phaseGate).map((cell) => cell.id);
assert.deepEqual(phaseGateIds, [36, 72, 136], '三处阶段门位置保持不变');

console.log('board-cell-mix-v3: ok');
