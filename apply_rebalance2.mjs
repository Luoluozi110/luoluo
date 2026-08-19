// 删支线后重新平衡：NPC ×0.92（相对当前×1.242 配置），分数线 ×0.94（相对当前×1.164 配置）。
import fs from 'fs';
const r = n => Math.max(1, Math.round(n));
const D = 'feihuaqi-playable/config/';

// --- NPC ---
const npcs = JSON.parse(fs.readFileSync(D + 'npcs.json', 'utf8'));
const NPC_M = 0.92;
for (const tier of npcs) {
  for (const n of (tier.npcs || [])) {
    for (const k of Object.keys(n.attrs || {})) n.attrs[k] = r((Number(n.attrs[k]) || 0) * NPC_M);
  }
}
fs.writeFileSync(D + 'npcs.json', JSON.stringify(npcs, null, 2) + '\n');

// --- 编辑器种子同步 ---
fs.writeFileSync('feihua-editors/assets/js/seed-npcs.js',
  '/* 飞花棋游戏原始对手数据（config/npcs.json）。作为编辑器默认种子数据。请勿手工改动 —— 在编辑器内管理后导出即可覆盖。 */\n' +
  'window.GAME_NPCS = ' + JSON.stringify(npcs, null, 2) + ';\n');

// --- 分数线 ---
const grades = JSON.parse(fs.readFileSync(D + 'grades.json', 'utf8'));
const GS = 0.94;
const fix = v => (v == null ? null : r(v * GS));
for (const g of grades.grades) { g.min = fix(g.min); g.max = fix(g.max); }
// 确保单调且相邻衔接
for (let i = 1; i < grades.grades.length; i++) {
  const prev = grades.grades[i - 1], cur = grades.grades[i];
  if (cur.min <= prev.max) cur.min = prev.max + 1;
}
fs.writeFileSync(D + 'grades.json', JSON.stringify(grades, null, 2) + '\n');

// 报告
console.log('=== NPC（×' + NPC_M + '，相对当前配置） ===');
for (const t of npcs) console.log(t.id, t.npcs.map(x => x.name + '[' + x.attrs.shi + ',' + x.attrs.ci + ',' + x.attrs.lian + ',' + x.attrs.bi + ',' + x.attrs.xue + ',' + x.attrs.si + ']').join(' '));
console.log('=== 分数线（×' + GS + '） ===');
console.log(grades.grades.map(g => g.name + ':' + g.min + '-' + g.max).join('  '));
