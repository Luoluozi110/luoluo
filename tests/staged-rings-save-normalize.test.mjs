import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { deserializeRun, RUN_SAVE_VERSION } = await import('../js/engine/save.js');
const board = JSON.parse(readFileSync(new URL('../config/board.json', import.meta.url), 'utf8'));
const cellsById = new Map(board.mainRing.map(cell => [cell.id, cell]));
const routeCells = board.route.map((step, index) => {
  const cell = cellsById.get(step.cellId) || board.mainRing[index];
  return { ...cell, id: index, routeIndex: index, ring: step.ring || cell.ring || 'outer' };
});
const cfg = {
  attrs: { initial: {} }, inspiration: { initial: 20, max: 40 },
  board: {
    ...board,
    routeCells,
    routeSize: routeCells.length,
    ringOfRouteIndex: new Map(routeCells.map(cell => [cell.routeIndex, cell.ring]))
  },
  talentById: new Map(), talentUpgradeById: new Map(),
  schools: [{ id: 'shi', name: '试派' }], sky: [], album: []
};

const raw = {
  v: RUN_SAVE_VERSION,
  savedAt: 1,
  state: {
    school: { id: 'shi' }, turn: 12, passive: [], active: [], attrs: {},
    inspiration: 20, inspirationMax: 40,
    routeIndex: 74, pos: 74, ringId: 'outer', phaseGateSeen: { xiucai: true },
    sky: [], battle: {}, events: {}, quiz: {}, talentLevels: {}, talentState: {},
    schoolState: {}, npcMech: {}, loadout: [], titles: [], log: [], over: false
  }
};
const result = deserializeRun(raw, cfg);
assert.equal(result.ok, true, result.error);
assert.equal(result.state.ringId, 'middle', '读档必须由 routeIndex 归一圈层，不能信任旧 outer');
assert.equal(result.state.phaseGateSeen.juren, true, '已超过举人门的旧档必须补齐 juren 已见标记');
assert.ok(result.warnings.some(x => x.includes('圈层')), '应给出圈层归一提示，保留可诊断性');
console.log('staged-rings-save-normalize.test.mjs: 旧存档圈层按 routeIndex 归一 ✓');
