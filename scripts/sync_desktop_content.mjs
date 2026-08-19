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
