#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const boardPath = path.join(root, 'feihuaqi-playable', 'config', 'board.json');
const board = JSON.parse(fs.readFileSync(boardPath, 'utf8'));

const replacements = new Map([
  [3, ['ping', 'event']],
  [10, ['ze', 'quiz']],
  [12, ['ping', 'quiz']],
  [16, ['ze', 'event']],
  [24, ['ping', 'event']],
  [29, ['ping', 'quiz']],
  [32, ['ze', 'quiz']],
  [35, ['ze', 'event']],
  [39, ['ping', 'event']],
  [48, ['ze', 'quiz']],
  [50, ['ping', 'quiz']],
  [67, ['ze', 'event']],
]);

const outer = (board.rings || []).find((ring) => ring.id === 'outer');
if (!outer) throw new Error('找不到 outer 外圈');

for (const [id, [from, to]] of replacements) {
  const cell = (outer.cells || []).find((item) => item.id === id);
  if (!cell) throw new Error(`找不到外圈格子 ${id}`);
  if (cell.type === to) continue;
  if (cell.type !== from) {
    throw new Error(`外圈格子 ${id} 预期为 ${from}，实际为 ${cell.type}`);
  }
  if (cell.effect || cell.phaseGate) {
    throw new Error(`外圈格子 ${id} 带有特殊效果或阶段门，不应转换`);
  }
  cell.type = to;
}

fs.writeFileSync(boardPath, JSON.stringify(board), 'utf8');
console.log(`已更新 ${replacements.size} 个外圈格子：平/仄韵 -12，奇遇/答题 +12。`);
