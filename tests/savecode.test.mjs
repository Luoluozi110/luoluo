import assert from 'node:assert/strict';

class StorageMock {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
  clear() { this.data.clear(); }
}

globalThis.localStorage = new StorageMock();
globalThis.sessionStorage = new StorageMock();

const Album = await import('../js/engine/album.js');
const Codex = await import('../js/engine/codex.js');
const Save = await import('../js/engine/save.js');

const run = {
  v: Save.RUN_SAVE_VERSION,
  savedAt: 123,
  state: {
    school: { id: 'shi' }, turn: 8, passive: [], active: [],
    attrs: { cai: 10 }, over: false
  }
};

const store = Album.emptyStore();
store.stats.games = 7;
store.unlocked = ['album_01'];
store.loadout = ['album_01'];
Album.saveStore(store);
Codex.saveCodex({
  foes: ['tier|npc'],
  foeStats: { 'tier|npc': { w: 3, d: 1, l: 2 } },
  talents: ['talent_01'],
  synergies: ['syn_01'],
  sky: ['SK01'],
  foeCognition: { npc: { level: 3, meets: 4, weaknessHits: 1 } }
});
localStorage.setItem(Album.REINCARNATE_KEY, JSON.stringify({ talentId: 'talent_01', attrs: { shi: 8 } }));
assert.equal(Save.replaceRun(run, Save.RUN_SAVE_KEY).ok, true);
assert.equal(Save.replaceRun({ ...run, savedAt: 456 }, Save.RUN_SAVE_MANUAL_KEY).ok, true);

const code = Album.exportCode();
assert.match(code, /^FHQS2\.[A-Z0-9]+\./);

localStorage.clear();
const restored = Album.importCode(code);
assert.equal(restored.legacy, false);
assert.equal(restored.hasRun, true);
assert.equal(Album.loadStore().stats.games, 7);
assert.deepEqual(Album.loadStore().loadout, ['album_01']);
assert.equal(Codex.loadCodex().foeCognition.npc.level, 3);
assert.deepEqual(Codex.loadCodex().foeStats['tier|npc'], { w: 3, d: 1, l: 2 });
assert.deepEqual(Codex.loadCodex().talents, ['talent_01']);
assert.deepEqual(Codex.loadCodex().synergies, ['syn_01']);
assert.deepEqual(Codex.loadCodex().sky, ['SK01']);
assert.equal(Save.loadRun(Save.RUN_SAVE_KEY).state.turn, 8);
assert.equal(Save.loadRun(Save.RUN_SAVE_MANUAL_KEY).savedAt, 456);
assert.deepEqual(JSON.parse(localStorage.getItem(Album.REINCARNATE_KEY)), { talentId: 'talent_01', attrs: { shi: 8 } });

// 损坏/截断代码必须在解析阶段失败，且不能污染已恢复的本机存档。
const gamesBeforeBadCode = Album.loadStore().stats.games;
assert.throws(() => Album.importCode(`${code}X`), /校验未通过/);
assert.equal(Album.loadStore().stats.games, gamesBeforeBadCode);

const legacy = Buffer.from(JSON.stringify(store), 'utf8').toString('base64');
localStorage.clear();
const legacyResult = Album.importCode(legacy);
assert.equal(legacyResult.legacy, true);
assert.equal(Album.loadStore().stats.games, 7);
assert.equal(Save.loadRun(Save.RUN_SAVE_KEY), null);

console.log('savecode.test.mjs: all assertions passed');
