import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CELL_GLYPH, cellGlyphKey, glyph } from '../js/ui/svg.js';

const board = JSON.parse(await readFile(new URL('../config/board.json', import.meta.url), 'utf8'));
const ringCells = (board.rings || []).flatMap(ring => ring.cells || []);
const activeTypes = [...new Set(ringCells.map(cell => cell.type))].sort();

test('每种实际棋盘格都有独立且非空的 24px SVG 图标', () => {
  assert.deepEqual(activeTypes, [
    'battle', 'event', 'gate', 'mingjing', 'ping', 'quiz', 'sky', 'start', 'ze'
  ]);

  const assets = activeTypes.map(type => {
    assert.equal(cellGlyphKey({ type }), type);
    const svg = glyph(type);
    assert.ok(svg, `${type} 缺少图标`);
    assert.match(svg, /viewBox="0 0 24 24"/);
    assert.match(svg, /filter="url\(#ta-soft\)"/);
    assert.doesNotMatch(svg, /<text\b|\sstroke="|[\u{1F300}-\u{1FAFF}]/u);
    return svg;
  });

  assert.equal(new Set(assets).size, activeTypes.length, '实际类型不应复用同一个图标资产');
});

test('类型语义优先于旧 icon override，未知键仍安全回退', () => {
  assert.equal(cellGlyphKey({ type: 'gate', icon: 'start' }), 'gate');
  assert.equal(cellGlyphKey({ type: 'quiz', icon: 'missing' }), 'quiz');
  assert.equal(cellGlyphKey({ type: 'future', icon: 'event' }), 'event');
  assert.equal(cellGlyphKey({ type: 'future', icon: 'missing' }), 'future');
  assert.equal(glyph(cellGlyphKey({ type: 'future', icon: 'missing' })), '');
});

test('192 个逻辑格均能解析到与类型一致的图标', () => {
  assert.equal(ringCells.length, 192);
  for (const cell of ringCells) {
    const key = cellGlyphKey(cell);
    assert.equal(key, cell.type, `${cell.id} ${cell.name} 的图标与类型不一致`);
    assert.ok(glyph(key), `${cell.id} ${cell.name} 的图标为空`);
  }
});

test('rings 与 mainRing 的格子类型和兼容 icon 数据保持同步', () => {
  assert.equal(board.mainRing.length, ringCells.length);
  const compact = cells => cells.map(({ id, type, icon = '' }) => ({ id, type, icon }));
  assert.deepEqual(compact(board.mainRing), compact(ringCells));
});

test('兼容资产仍保留，编辑器旧数据不会渲染空白', () => {
  for (const key of ['branch_gate', 'landmark']) assert.ok(CELL_GLYPH[key]);
});
