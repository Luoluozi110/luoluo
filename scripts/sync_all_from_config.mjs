#!/usr/bin/env node
/**
 * 以 feihuaqi-playable/config/*.json 为唯一权威源，统一生成：
 *   1) feihua-editors/assets/js/seed-*.js  —— 编辑器默认种子（保留各文件原有头注释与格式约定）
 *   2) 工作区根 feihua-content.json        —— 云端工程基准（含 sidequests / sidequest-npcs）
 *
 * 用途：消除 config / 编辑器种子 / 云端基准 三处的数据漂移。
 * 运行： node scripts/sync_all_from_config.mjs
 * 体检： node scripts/diag_editor_sync.mjs
 *
 * 约定：
 *   - seed-events.js 采用单行压缩格式（历史约定），其余为 2 空格美化。
 *   - 各 seed 的头注释从现有文件自动提取并保留，不硬编码。
 *   - 根 feihua-content.json 的 _version 自动 +1，确保云端合并时新内容胜出。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25';
const CFG = path.join(ROOT, 'feihuaqi-playable/config');
const SEED = path.join(ROOT, 'feihua-editors/assets/js');
const CONTENT = path.join(ROOT, 'feihua-content.json');

const read = (n) => JSON.parse(fs.readFileSync(path.join(CFG, n + '.json'), 'utf8'));
const pretty = (o) => JSON.stringify(o, null, 2);
const compact = (o) => JSON.stringify(o);

/** 提取现有 seed 文件中 `window.XXX` 之前的头注释；没有则返回兜底注释。 */
function headerOf(file, fallback) {
  const p = path.join(SEED, file);
  if (!fs.existsSync(p)) return fallback;
  const s = fs.readFileSync(p, 'utf8');
  const i = s.search(/^\s*window\.[A-Z_]+\s*=/m);
  if (i <= 0) return fallback;
  return s.slice(0, i);
}

/**
 * seed 输出规格
 * gvars: 按顺序写入的全局变量（[变量名, 数据来源]）
 */
const SPECS = [
  { file: 'seed-questions.js', compact: false, gvars: [['GAME_QUESTIONS', () => read('questions')]] },
  { file: 'seed-events.js', compact: true, gvars: [['GAME_EVENTS', () => read('events')]] },
  { file: 'seed-talents.js', compact: false, gvars: [['GAME_TALENTS', () => read('talents')]] },
  { file: 'seed-talent-upgrade.js', compact: false, gvars: [['GAME_TALENT_UPGRADE', () => read('talent-upgrade')]] },
  { file: 'seed-npcs.js', compact: false, gvars: [['GAME_NPCS', () => read('npcs')]] },
  { file: 'seed-affinity.js', compact: false, gvars: [['GAME_AFFINITY', () => read('affinity')]] },
  { file: 'seed-synergies.js', compact: false, gvars: [['GAME_SYNERGIES', () => read('synergies')]] },
  { file: 'seed-board.js', compact: false, gvars: [['GAME_BOARD', () => read('board')]] },
  { file: 'seed-sky.js', compact: false, gvars: [['GAME_SKY', () => read('sky')]] },
  { file: 'seed-album.js', compact: false, gvars: [['GAME_ALBUM', () => read('album')]] },
  {
    file: 'seed-copy.js', compact: false, gvars: [
      ['GAME_SCHOOLS', () => read('schools')],
      ['GAME_GRADES', () => read('grades')],
      ['GAME_NARRATIVE', () => read('narrative')],
    ],
  },
  {
    file: 'seed-sidequests.js', compact: false, gvars: [
      ['GAME_SIDEQUEST_NPCS', () => read('sidequest-npcs')],
      ['GAME_SIDEQUESTS', () => read('sidequests')],
      ['GAME_SIDEQUEST_TALENTS', () => read('sidequest-talents').talents],
      ['GAME_SIDEQUEST_TALENT_UPGRADE', () => read('sidequest-talents').upgrades],
      ['GAME_SIDEQUEST_TALENT_OFFERS', () => read('sidequest-talents').offers],
    ],
  },
];

console.log('===== 1) 重建编辑器种子（源自 config） =====');
for (const spec of SPECS) {
  const header = headerOf(spec.file, '/* 由 scripts/sync_all_from_config.mjs 从 config 同步生成，请勿手工改动。 */\n');
  let out = header;
  for (const [gvar, get] of spec.gvars) {
    const data = get();
    const body = spec.compact ? compact(data) : pretty(data);
    out += `window.${gvar} = ${body};\n`;
    const n = Array.isArray(data) ? data.length + ' 项' : Object.keys(data).length + ' 键';
    console.log(`  [seed] ${spec.file.padEnd(24)} ${gvar.padEnd(30)} ${n}`);
  }
  fs.writeFileSync(path.join(SEED, spec.file), out, 'utf8');
}

console.log('\n===== 2) 重建根 feihua-content.json（云端工程基准） =====');
const prev = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));
const next = {
  _type: 'feihua-content',
  _version: (Number(prev._version) || 1) + 1,
  questions: read('questions'),
  events: read('events'),
  talents: read('talents'),
  'talent-upgrade': read('talent-upgrade'),
  npcs: read('npcs'),
  affinity: read('affinity'),
  synergies: read('synergies'),
  board: read('board'),
  sky: read('sky'),
  album: read('album'),
  schools: read('schools'),
  grades: read('grades'),
  narrative: read('narrative'),
  sidequests: read('sidequests'),
  'sidequest-npcs': read('sidequest-npcs'),
  'sidequest-talents': read('sidequest-talents'),
};
fs.writeFileSync(CONTENT, pretty(next) + '\n', 'utf8');
console.log(`  _version: ${prev._version} -> ${next._version}`);
for (const k of Object.keys(next)) {
  if (k.startsWith('_')) continue;
  const v = next[k];
  console.log(`    ${k.padEnd(16)} ${Array.isArray(v) ? v.length + ' 项' : Object.keys(v).length + ' 键'}`);
}
console.log('\n同步完成。建议接着跑： node scripts/diag_editor_sync.mjs');
