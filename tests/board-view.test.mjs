import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_VIEW_ANGLE_PRESETS,
  BOARD_VIEW_MODE,
  DEFAULT_BOARD_VIEW_ANGLE,
  boardViewAngleLabel,
  normalizeBoardViewMode,
  normalizeBoardViewAngle,
  nextBoardViewAngle,
  resolveBoardViewAngle,
  resolveBoardViewMode,
  boardViewProfile,
  applyBoardViewMode,
  applyEffectiveBoardViewMode,
  projectedBoardFootprint,
  resolveEffectiveBoardViewMode,
  projectScreenDelta
} from '../js/ui/boardView.js';

test('2.5D 镜头模式仅由明确查询参数开启', () => {
  assert.equal(resolveBoardViewMode(''), BOARD_VIEW_MODE.FLAT);
  assert.equal(resolveBoardViewMode('?boardView=25d'), BOARD_VIEW_MODE.PERSPECTIVE);
  assert.equal(resolveBoardViewMode('?boardView=2.5d'), BOARD_VIEW_MODE.PERSPECTIVE);
  assert.equal(normalizeBoardViewMode('unknown'), BOARD_VIEW_MODE.FLAT);
});

test('2.5D profile 提供倾角、厚度与人物抬升', () => {
  const p = boardViewProfile('25d');
  assert.ok(p.pitch > 0 && p.pitch < 45);
  assert.ok(p.islandZ < 0);
  assert.ok(p.tileZ > 0);
  assert.ok(p.pieceZ > p.tileZ);
});

test('便捷视角按钮使用三档离散俯角并支持 URL / 记忆值', () => {
  assert.deepEqual(BOARD_VIEW_ANGLE_PRESETS.map(x => x.angle), [20, 28, 36]);
  assert.equal(DEFAULT_BOARD_VIEW_ANGLE, 28);
  assert.equal(resolveBoardViewAngle('?boardAngle=36', '20'), 36);
  assert.equal(resolveBoardViewAngle('', '20'), 20);
  assert.equal(normalizeBoardViewAngle(34), 36);
  assert.equal(boardViewAngleLabel(20), '舒展');
  assert.equal(nextBoardViewAngle(20), 28);
  assert.equal(nextBoardViewAngle(36), 20);
});

test('模式应用只写 scene/HTML 属性和 CSS 变量', () => {
  const vars = new Map();
  const root = { dataset: {}, style: { setProperty: (k, v) => vars.set(k, v) } };
  const attrs = new Map();
  const doc = { documentElement: { setAttribute: (k, v) => attrs.set(k, v) } };
  assert.equal(applyBoardViewMode(root, '25d', doc), '25d');
  assert.equal(root.dataset.boardView, '25d');
  assert.equal(root.dataset.boardViewEffective, '25d');
  assert.equal(attrs.get('data-board-view'), '25d');
  assert.equal(vars.get('--board-camera-pitch'), '28deg');
  assert.equal(vars.get('--board-billboard-pitch'), '-28deg');

  assert.equal(applyEffectiveBoardViewMode(root, '25d', doc, 36), '25d');
  assert.equal(vars.get('--board-camera-pitch'), '36deg');
  assert.equal(vars.get('--board-billboard-pitch'), '-36deg');

  assert.equal(applyEffectiveBoardViewMode(root, 'flat', doc), 'flat');
  assert.equal(root.dataset.boardView, '25d');
  assert.equal(root.dataset.boardViewEffective, 'flat');
  assert.equal(vars.get('--board-camera-pitch'), '0deg');
});

test('低画质、小屏或粗指针会把请求的 2.5D 拍平', () => {
  assert.equal(resolveEffectiveBoardViewMode('25d'), '25d');
  assert.equal(resolveEffectiveBoardViewMode('25d', { quality: 'low' }), 'flat');
  assert.equal(resolveEffectiveBoardViewMode('25d', { compact: true }), 'flat');
  assert.equal(resolveEffectiveBoardViewMode('25d', { coarse: true }), 'flat');
  assert.equal(resolveEffectiveBoardViewMode('flat'), 'flat');
});

test('fit 使用透视后四角包围盒', () => {
  assert.deepEqual(projectedBoardFootprint(1000, .5, 'flat'), { width: 500, height: 500 });
  const tilted = projectedBoardFootprint(1000, .7, '25d');
  assert.ok(tilted.width > 700);
  assert.ok(tilted.height < 700);
  assert.ok(Number.isFinite(tilted.width) && Number.isFinite(tilted.height));
  const overhead = projectedBoardFootprint(1000, .7, '25d', 36);
  assert.ok(overhead.height < tilted.height);
});

test('保留的反投影工具同时补偿 pitch 与轻微 yaw', () => {
  assert.deepEqual(projectScreenDelta(30, 40, 'flat'), { x: 30, y: 40 });
  const tilted = projectScreenDelta(30, 40, '25d');
  assert.ok(Math.abs(tilted.x - 30) < 1);
  assert.ok(tilted.y > 40);
});
