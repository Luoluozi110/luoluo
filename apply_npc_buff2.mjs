// 在「当前已是 ×1.08」的 npcs.json 基础上再乘 (1.15/1.08)，得到相对原始基线的 ×1.15。
// 同时把编辑器种子 seed-npcs.js 同步为同一份。
import fs from 'fs';
const f = 'feihuaqi-playable/config/npcs.json';
const src = JSON.parse(fs.readFileSync(f, 'utf8'));
const factor = 1.15 / 1.08; // 复合到 ×1.15
const round = n => Math.max(1, Math.round(n * factor));
for (const tier of src) for (const n of (tier.npcs || [])) {
  for (const k of Object.keys(n.attrs || {})) n.attrs[k] = round(n.attrs[k]);
}
fs.writeFileSync(f, JSON.stringify(src, null, 2) + '\n');
console.log('npcs.json 已 ×1.15(相对原始基线)');

// 同步编辑器种子（覆盖写 window.GAME_NPCS）
const header = '/* 飞花棋游戏原始对手数据（config/npcs.json）。作为编辑器默认种子数据。请勿手工改动 —— 在编辑器内管理后导出即可覆盖。 */\n';
fs.writeFileSync('feihua-editors/assets/js/seed-npcs.js', header + 'window.GAME_NPCS = ' + JSON.stringify(src, null, 2) + ';\n');
console.log('seed-npcs.js 已同步');

// 打印各档主属性峰值供核对
for (const t of src) {
  const peak = Math.max(...t.npcs.flatMap(x => Object.values(x.attrs)));
  console.log(t.id, '主属性峰值', peak);
}
