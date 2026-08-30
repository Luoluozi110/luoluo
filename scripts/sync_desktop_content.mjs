#!/usr/bin/env node
/**
 * 同步桌面工程文件（C:/Users/77522/Desktop/feihua-content (1).json）到本地三处：
 *   1) feihuaqi-playable/config/{events,talents,questions,npcs,affinity,sky}.json （2-空格美化 JSON）
 *      —— board.json 与桌面完全一致，跳过；synergies/album 无内容差异，跳过。
 *   2) feihua-editors/assets/js/seed-{events,talents,questions,npcs,affinity,sky}.js
 *      —— 各保留原文件格式约定：seed-events 单行压缩；其余 2-空格美化。
 *   3) 工作区根 feihua-content.json —— 编辑器 buildProject 10 数据键格式（+ _type / _version:1）。
 *
 * 运行： node scripts/sync_desktop_content.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25';
const DESKTOP = 'C:/Users/77522/Desktop/feihua-content (1).json';
const CFG_DIR = path.join(ROOT, 'feihuaqi-playable/config');
const SEED_DIR = path.join(ROOT, 'feihua-editors/assets/js');

/* ---------------------------------------------------------------------------
 * ⚠️ 安全护栏（2026-08-29 加入）
 * 本脚本是**反向**同步：用桌面那份工程文件覆盖本地 config / 种子 / 云端基准。
 * 桌面文件一旦比 config 旧，误跑会把所有内容整体回退 —— 2026-08-29 排查时发现
 * 该桌面文件停留在 8/16，而 config 已含 87 题、grades v2.3、schoolMechanics 等新内容，
 * 一旦执行将造成大面积内容丢失。
 * 因此默认拒绝执行；确需从桌面回灌时必须显式 --force，并自行确认桌面文件更新。
 * ------------------------------------------------------------------------- */
const FORCE = process.argv.includes('--force');

if (!fs.existsSync(DESKTOP)) {
  console.error('✗ 已中止：桌面工程文件不存在 -> ' + DESKTOP);
  console.error('  本脚本会用桌面文件覆盖本地 config，源缺失时不执行。');
  process.exit(1);
}

// 取 config 目录中最新修改时间，判断桌面文件是否更旧
const CFG_KEYS_GUARD = ['events', 'talents', 'questions', 'npcs', 'affinity', 'sky', 'board', 'album', 'schools', 'grades', 'narrative'];
let latestCfg = 0, latestCfgName = '';
for (const k of CFG_KEYS_GUARD) {
  const p = path.join(CFG_DIR, k + '.json');
  if (!fs.existsSync(p)) continue;
  const m = fs.statSync(p).mtimeMs;
  if (m > latestCfg) { latestCfg = m; latestCfgName = k + '.json'; }
}
const desktopMtime = fs.statSync(DESKTOP).mtimeMs;
const fmt = (ms) => new Date(ms).toLocaleString('zh-CN', { hour12: false });

if (desktopMtime < latestCfg) {
  console.error('✗ 已中止：桌面工程文件比本地 config 更旧，执行会造成内容回退。');
  console.error('    桌面文件  : ' + fmt(desktopMtime) + '  (' + DESKTOP + ')');
  console.error('    最新 config: ' + fmt(latestCfg) + '  (config/' + latestCfgName + ')');
  console.error('  若确认要用这份桌面文件回灌，请显式执行：node scripts/sync_desktop_content.mjs --force');
  if (!FORCE) process.exit(1);
  console.warn('⚠️  --force 已指定，继续执行；后果自负。');
} else {
  console.log('· 桌面文件(' + fmt(desktopMtime) + ') 不早于最新 config(' + fmt(latestCfg) + ')，放行。');
}

const raw = fs.readFileSync(DESKTOP, 'utf-8');
const data = JSON.parse(raw);

// 工具
const w = (p, content) => { fs.writeFileSync(p, content, 'utf-8'); };
const pretty = (obj) => JSON.stringify(obj, null, 2);
const compact = (obj) => JSON.stringify(obj);

// ---------- 1) config/*.json（2-空格美化，board/synergies/album 跳过） ----------
const CFG_KEYS = ['events', 'talents', 'questions', 'npcs', 'affinity', 'sky'];
for (const k of CFG_KEYS) {
  const out = pretty(data[k]) + '\n';
  w(path.join(CFG_DIR, k + '.json'), out);
  console.log('[config] ' + k + '.json => ' + (Array.isArray(data[k]) ? data[k].length + ' items' : Object.keys(data[k]).length + ' keys'));
}

// ---------- 2) seed-*.js（保留各文件格式） ----------
// seed-events.js：单行压缩
w(path.join(SEED_DIR, 'seed-events.js'),
  '/* 飞花棋游戏原始奇遇（config/events.json）。作为编辑器默认种子数据。请勿手工改动 —— 在编辑器内管理后导出即可覆盖。 */\n' +
  'window.GAME_EVENTS = ' + compact(data.events) + ';\n');
console.log('[seed] seed-events.js (compact) => ' + data.events.length + ' events');

// 其余 seed：2-空格美化，各自保留原头注释
const SEED_HEADERS = {
  talents: '/* 飞花棋游戏原始文心（config/talents.json）。作为编辑器默认种子数据。由游戏配置同步生成，请勿手工改动 —— 在编辑器内管理后导出即可覆盖。 */\n',
  questions: '/* 飞花棋游戏原始题库（config/questions.json）。作为编辑器默认种子数据。请勿手工改动 —— 在编辑器内管理后导出即可覆盖。 */\n',
  npcs: '/* 飞花棋游戏原始 NPC（config/npcs.json）。作为编辑器默认种子数据。由游戏配置同步生成，请勿手工改动 —— 在编辑器内管理后导出即可覆盖。 */\n',
  affinity: '/* 飞花棋相性系统原始配置（config/affinity.json）。作为编辑器默认种子；请勿手工改动，在编辑器内管理后导出即可覆盖。 */\n',
  sky: '/* 天象种子数据（与游戏 config/sky.json 一致，作为编辑器默认）。\n * 游戏内天象格触发时从 cfg.sky 随机抽取一张；id 形如 SKxx。\n * icon 为可选展示字形（emoji 或短文本），游戏 showSky 弹窗显示；留空则回退为星纹。\n * 数据结构见 feihuaqi-playable/config/sky.json。 */\n',
};
const SEED_GVAR = { talents: 'GAME_TALENTS', questions: 'GAME_QUESTIONS', npcs: 'GAME_NPCS', affinity: 'GAME_AFFINITY', sky: 'GAME_SKY' };
for (const k of Object.keys(SEED_HEADERS)) {
  const body = pretty(data[k]);
  const out = SEED_HEADERS[k] + 'window.' + SEED_GVAR[k] + ' = ' + body + ';\n';
  w(path.join(SEED_DIR, 'seed-' + k + '.js'), out);
  console.log('[seed] seed-' + k + '.js (pretty) => ' + (Array.isArray(data[k]) ? data[k].length + ' items' : Object.keys(data[k]).length + ' keys'));
}

// ---------- 3) 根 feihua-content.json（编辑器 buildProject 10 数据键格式） ----------
const root = {
  _type: 'feihua-content',
  _version: 1,
  questions: data.questions,
  events: data.events,
  talents: data.talents,
  npcs: data.npcs,
  affinity: data.affinity,
  synergies: data.synergies,
  board: data.board,
  sky: data.sky,
  album: data.album,
};
w(path.join(ROOT, 'feihua-content.json'), pretty(root) + '\n');
console.log('[root] feihua-content.json => ' + Object.keys(root).length + ' keys (rebuild full)');

console.log('\nSync complete.');
