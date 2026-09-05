/** 编辑器的 v2 单位显示层：bp 存储 ↔ 可编辑比例必须无损往返。 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = { window: {}, console, setTimeout, clearTimeout };
context.window.window = context.window;
vm.createContext(context);

for (const file of [
  'feihua-editors/assets/js/seed-questions.js',
  'feihua-editors/assets/js/seed-events.js',
  'feihua-editors/assets/js/seed-talents.js',
  'feihua-editors/assets/js/seed-talent-upgrade.js',
  'feihua-editors/assets/js/seed-sidequests.js',
  'feihua-editors/assets/js/seed-npcs.js',
  'feihua-editors/assets/js/seed-affinity.js',
  'feihua-editors/assets/js/seed-synergies.js',
  'feihua-editors/assets/js/seed-board.js',
  'feihua-editors/assets/js/seed-sky.js',
  'feihua-editors/assets/js/seed-album.js',
  'feihua-editors/assets/js/seed-copy.js',
  'feihua-editors/assets/js/common.js'
]) vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });

const source = JSON.parse(fs.readFileSync('feihua-content.json', 'utf8'));
const display = context.window.Common.numericProjectToEditor(source);
const restored = context.window.Common.numericProjectToStorage(display);

assert.deepEqual(JSON.parse(JSON.stringify(restored)), source, '完整云端工程经过编辑器显示层后必须无损还原');
assert.equal(context.window.GAME_SCHOOLS[1].schoolMechanics.inspirationBonusRate, 0.2, '编辑器应将 2000 bp 显示为 0.2');
assert.equal(display.numericVersion, 2);
console.log('editor-numeric-v2.test.mjs: 编辑器 v2 数值单位往返 ✓');
