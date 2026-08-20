import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Album from '../js/engine/album.js';
import { deserializeRun, RUN_SAVE_VERSION } from '../js/engine/save.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cards = JSON.parse(fs.readFileSync(path.join(root, 'config', 'album.json'), 'utf8'));
assert.equal(cards.length, 12);
assert.ok(cards.every(c => c.growth && c.branches.length === 2));
assert.deepEqual(Album.albumLevelFromXp(0), 1);
assert.deepEqual(Album.albumLevelFromXp(3), 2);
assert.deepEqual(Album.albumLevelFromXp(8), 3);
assert.deepEqual(Album.albumLevelFromXp(16), 4);

const card = cards[0];
const store = Album.emptyStore();
store.unlocked = [card.id];
let choice = Album.chooseAlbumBranch(store, card, 'bold');
assert.equal(choice.ok, true);
assert.equal(choice.store.progress[card.id].branchLocked, true);
choice = Album.chooseAlbumBranch(choice.store, card, 'swift');
assert.equal(choice.ok, false);
assert.match(choice.reason, /定型/);

const map = {};
const first = Album.addAlbumProgress(map, card, { result: 'win', style: 'shi', branch: 'bold' });
assert.equal(first.gained, 3);
assert.equal(map[card.id].branch, 'bold');
assert.equal(map[card.id].branchLocked, true);
assert.equal(map[card.id].wins, 1);
assert.equal(map[card.id].styleUses.shi, 1);
assert.equal(map[card.id].level, 2);

const cfg = {
  board: { layout: 'single_ring', routeSize: 10, phaseGates: [] },
  schools: [{ id: 'bowen', name: '博闻', attr: 'xue' }],
  attrs: { initial: { shi: 1, ci: 1, lian: 1, bi: 1, xue: 1, si: 1 }, abilitySystem: { strategy: { plans: { guard: {}, steady: {}, switch: {} }, defaultPlan: 'guard' } } },
  inspiration: { initial: 10, max: 20 },
  talentById: new Map(), talentUpgradeById: new Map(), album: cards
};
const old = { v: 5, savedAt: 1, state: {
  school: { id: 'bowen' }, turn: 1, passive: [], active: [], attrs: cfg.attrs.initial,
  pos: 0, routeIndex: 0, abilityState: {},
  albumState: { progress: { A001: { xp: 8, level: 99, branch: 'bold', branchLocked: true, flags: { x: true } } }, branches: { A001: 'bold' }, flags: { studySlotPlus: 1 } }
} };
const migrated = deserializeRun(old, cfg);
assert.equal(migrated.ok, true);
assert.equal(migrated.state.albumState.progress.A001.level, 3);
assert.equal(migrated.state.albumState.branches.A001, 'bold');
assert.equal(migrated.state.albumState.flags.studySlotPlus, 1);
assert.equal(RUN_SAVE_VERSION, 7);
console.log('album-growth.test.mjs: 成长、路线锁定、旧档迁移全部通过');
