import assert from 'node:assert/strict';
import * as Album from '../js/engine/album.js';
import * as Codex from '../js/engine/codex.js';
import { applyFullContentUnlock, getContentTestSummary } from '../js/engine/content-test.js';

const cfg = {
  album: [
    { id: 'A1', unlock: { type: 'wins', min: 8 }, branches: [] },
    { id: 'A2', unlock: { type: 'styleWins', style: 'shi', min: 5 }, branches: [] }
  ],
  schools: [{ id: 'bowen', name: '博闻' }],
  npcs: [{ id: 'tier1', npcs: [{ id: 'npc1', name: '甲', mech: {} }, { name: '乙' }] }],
  talents: [{ id: 'T1' }],
  synergies: [{ id: 'S1' }],
  sky: [{ id: 'SKY1' }],
  talentUpgradeById: new Map([['T1', { maxLevel: 4 }]])
};

Album.saveStore(Album.emptyStore());
Codex.saveCodex(Codex.emptyCodex());
const out = applyFullContentUnlock(cfg);
assert.equal(out.summary.album.got, 2);
assert.equal(out.summary.mastery.got, 1);
assert.equal(out.summary.foes.got, 2);
assert.equal(out.summary.talents.got, 1);
assert.equal(out.summary.synergies.got, 1);
assert.equal(out.summary.sky.got, 1);
assert.equal(Album.loadStore().stats.wins, 8);
assert.equal(Album.loadStore().stats.styleWins.shi, 5);
assert.equal(Album.loadStore().mastery.bowen.level, Album.MASTERY_LEVELS);
assert.equal(Codex.loadCodex().talentLevels.T1, 4);
console.log('content-test.test.mjs: 全内容解锁与测试态统计补齐通过');
