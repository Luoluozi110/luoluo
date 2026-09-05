/** 编辑器的 v2 单位显示层：bp 存储 ↔ 可编辑比例必须无损往返。 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = { window: {}, console, setTimeout, clearTimeout };
context.window.window = context.window;
vm.createContext(context);

const seedFiles = [
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
  'feihua-editors/assets/js/seed-copy.js'
];
for (const file of seedFiles) vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
const seedNames = [
  'GAME_QUESTIONS', 'GAME_EVENTS', 'GAME_TALENTS', 'GAME_TALENT_UPGRADE', 'GAME_NPCS', 'GAME_AFFINITY',
  'GAME_SYNERGIES', 'GAME_BOARD', 'GAME_SKY', 'GAME_ALBUM', 'GAME_SCHOOLS', 'GAME_GRADES', 'GAME_NARRATIVE',
  'GAME_SIDEQUESTS', 'GAME_SIDEQUEST_NPCS', 'GAME_SIDEQUEST_TALENTS', 'GAME_SIDEQUEST_TALENT_UPGRADE', 'GAME_SIDEQUEST_TALENT_OFFERS'
];
const rawSeeds = Object.fromEntries(seedNames.map(name => [name, JSON.parse(JSON.stringify(context.window[name]))]));
vm.runInContext(fs.readFileSync('feihua-editors/assets/js/common.js', 'utf8'), context, { filename: 'feihua-editors/assets/js/common.js' });

const source = JSON.parse(fs.readFileSync('feihua-content.json', 'utf8'));
const display = context.window.Common.numericProjectToEditor(source);
const restored = context.window.Common.numericProjectToStorage(display);

assert.deepEqual(JSON.parse(JSON.stringify(restored)), source, '完整云端工程经过编辑器显示层后必须无损还原');
assert.equal(context.window.GAME_SCHOOLS[1].schoolMechanics.inspirationBonusRate, 0.2, '编辑器应将 2000 bp 显示为 0.2');
assert.equal(display.numericVersion, 2);
for (const [seed, key] of Object.entries({
  GAME_QUESTIONS: 'questions', GAME_EVENTS: 'events', GAME_TALENTS: 'talents', GAME_TALENT_UPGRADE: 'talent-upgrade',
  GAME_NPCS: 'npcs', GAME_AFFINITY: 'affinity', GAME_SYNERGIES: 'synergies', GAME_BOARD: 'board', GAME_SKY: 'sky',
  GAME_ALBUM: 'album', GAME_SCHOOLS: 'schools', GAME_GRADES: 'grades', GAME_NARRATIVE: 'narrative',
  GAME_SIDEQUESTS: 'sidequests', GAME_SIDEQUEST_NPCS: 'sidequest-npcs'
})) assert.deepEqual(rawSeeds[seed], source[key], `${seed} 必须与云端工程的 ${key} 同步`);
assert.deepEqual(rawSeeds.GAME_SIDEQUEST_TALENTS, source['sidequest-talents'].talents);
assert.deepEqual(rawSeeds.GAME_SIDEQUEST_TALENT_UPGRADE, source['sidequest-talents'].upgrades);
assert.deepEqual(rawSeeds.GAME_SIDEQUEST_TALENT_OFFERS, source['sidequest-talents'].offers);
assert.ok(source.narrative.endScroll && rawSeeds.GAME_NARRATIVE.endScroll, '终局成卷文案必须进入编辑器种子');
assert.equal(source.affinity.matrix['qingya.jieling'], 1200, '保留云端发布的清雅·节令调整');
assert.equal(source.sky.find(card => card.id === 'SK07').icon, '🌈', '保留彩彻区明图标');
assert.equal(source['sidequest-npcs'].routes.jianghu.guides[0].name, '柳解眠', '保留支线引路人更名');
console.log('editor-numeric-v2.test.mjs: 编辑器 v2 数值单位往返 ✓');
