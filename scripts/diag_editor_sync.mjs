// 诊断：编辑器种子(seed-*.js) 与 游戏 config/*.json 的一致性
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/';
const CFG = ROOT + 'feihuaqi-playable/config/';
const SEED = ROOT + 'feihua-editors/assets/js/';

function loadSeedGlobals(file) {
  const code = readFileSync(file, 'utf8');
  const w = {};
  new Function('window', code)(w);
  return w;
}
const readJson = (n) => JSON.parse(readFileSync(CFG + n + '.json', 'utf8'));

// 比对：只报告「内容是否等价」，并给出条目数差异
const canon = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map((kk) => [kk, v[kk]])) : v));

const cases = [
  { seed: 'seed-affinity.js', key: 'GAME_AFFINITY', cfg: 'affinity' },
  { seed: 'seed-album.js', key: 'GAME_ALBUM', cfg: 'album' },
  { seed: 'seed-board.js', key: 'GAME_BOARD', cfg: 'board' },
  { seed: 'seed-events.js', key: 'GAME_EVENTS', cfg: 'events' },
  { seed: 'seed-npcs.js', key: 'GAME_NPCS', cfg: 'npcs' },
  { seed: 'seed-questions.js', key: 'GAME_QUESTIONS', cfg: 'questions' },
  { seed: 'seed-sky.js', key: 'GAME_SKY', cfg: 'sky' },
  { seed: 'seed-synergies.js', key: 'GAME_SYNERGIES', cfg: 'synergies' },
  { seed: 'seed-talents.js', key: 'GAME_TALENTS', cfg: 'talents' },
  { seed: 'seed-talent-upgrade.js', key: 'GAME_TALENT_UPGRADE', cfg: 'talent-upgrade' },
];

const cnt = (v) => (Array.isArray(v) ? v.length + '项' : (v && typeof v === 'object' ? Object.keys(v).length + '键' : String(v)));

console.log('===== 编辑器种子 vs 游戏 config =====');
for (const c of cases) {
  if (!existsSync(SEED + c.seed)) { console.log(`  [缺种子] ${c.seed}`); continue; }
  const g = loadSeedGlobals(SEED + c.seed)[c.key];
  const cfg = readJson(c.cfg);
  const same = canon(g) === canon(cfg);
  const seedN = cnt(g), cfgN = cnt(cfg);
  console.log(`  ${same ? '✓' : '✗'} ${c.cfg.padEnd(16)} 种子:${String(seedN).padEnd(7)} config:${String(cfgN).padEnd(7)}${same ? '' : '   <<< 不一致'}`);
}

// seed-copy.js 多全局
console.log('\n===== seed-copy.js（ schools / grades / narrative ） =====');
{
  const w = loadSeedGlobals(SEED + 'seed-copy.js');
  for (const [k, name] of [['GAME_SCHOOLS', 'schools'], ['GAME_GRADES', 'grades'], ['GAME_NARRATIVE', 'narrative']]) {
    const g = w[k], cfg = readJson(name);
    const same = canon(g) === canon(cfg);
    console.log(`  ${same ? '✓' : '✗'} ${name.padEnd(16)} 种子:${String(cnt(g)).padEnd(7)} config:${String(cnt(cfg)).padEnd(7)}${same ? '' : '   <<< 不一致'}`);
  }
}

// seed-sidequests.js
console.log('\n===== seed-sidequests.js（支线） =====');
{
  const w = loadSeedGlobals(SEED + 'seed-sidequests.js');
  const pairs = [
    ['GAME_SIDEQUESTS', 'sidequests'],
    ['GAME_SIDEQUEST_TALENTS', 'sidequest-talents', 'talents'],
    ['GAME_SIDEQUEST_TALENT_UPGRADE', 'sidequest-talents', 'upgrades'],
    ['GAME_SIDEQUEST_NPCS', 'sidequest-npcs', null],
  ];
  for (const [k, file, sub] of pairs) {
    if (!existsSync(CFG + file + '.json')) { console.log(`  [config 缺失] ${file}.json`); continue; }
    const cfgFull = readJson(file);
    const cfg = sub ? cfgFull[sub] : cfgFull;
    const g = w[k];
    const same = canon(g) === canon(cfg);
    console.log(`  ${same ? '✓' : '✗'} ${(file + (sub ? '.' + sub : '')).padEnd(28)} 种子:${String(cnt(g)).padEnd(7)} config:${String(cnt(cfg)).padEnd(7)}${same ? '' : '   <<< 不一致'}`);
  }
}

// feihua-content.json（云端基准）与 config 的一致性
console.log('\n===== 根 feihua-content.json（云端基准） vs 游戏 config =====');
{
  const c = JSON.parse(readFileSync(ROOT + 'feihua-content.json', 'utf8'));
  for (const key of ['questions', 'events', 'talents', 'talent-upgrade', 'npcs', 'affinity', 'synergies', 'board', 'album', 'sky', 'schools', 'grades', 'narrative']) {
    if (c[key] === undefined) { console.log(`  ✗ ${key.padEnd(16)} 云端基准缺失`); continue; }
    if (!existsSync(CFG + key + '.json')) { console.log(`  - ${key.padEnd(16)} 无对应 config 文件`); continue; }
    const cfg = readJson(key);
    const same = canon(c[key]) === canon(cfg);
    console.log(`  ${same ? '✓' : '✗'} ${key.padEnd(16)} 云端:${String(cnt(c[key])).padEnd(7)} config:${String(cnt(cfg)).padEnd(7)}${same ? '' : '   <<< 不一致'}`);
  }
}
