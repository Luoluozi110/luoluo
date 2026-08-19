// 当前文件 = 原始基线 ×1.15。目标 = 原始基线 ×1.242（扩图后80格路程更长、对局更多，需要更强NPC）。
// 复合因子 = 1.242 / 1.15 = 1.08。写回并同步编辑器种子。
import fs from 'fs';
const f = 'feihuaqi-playable/config/npcs.json';
const src = JSON.parse(fs.readFileSync(f, 'utf8'));
const factor = 1.242 / 1.15;
const round = n => Math.max(1, Math.round(n * factor));
for (const tier of src) for (const n of (tier.npcs || [])) {
  for (const k of Object.keys(n.attrs || {})) n.attrs[k] = round(n.attrs[k]);
}
fs.writeFileSync(f, JSON.stringify(src, null, 2) + '\n');
const header = '/* 飞花棋游戏原始对手数据（config/npcs.json）。作为编辑器默认种子数据。请勿手工改动 —— 在编辑器内管理后导出即可覆盖。 */\n';
fs.writeFileSync('feihua-editors/assets/js/seed-npcs.js', header + 'window.GAME_NPCS = ' + JSON.stringify(src, null, 2) + ';\n');
console.log('npcs.json 已设为 原始基线 ×1.242');
for (const t of src) console.log(t.id, '主属性峰值', Math.max(...t.npcs.flatMap(x => Object.values(x.attrs))));
