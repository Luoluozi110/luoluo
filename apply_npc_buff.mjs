// 一次性脚本：将 npcs.json 各档对手六维属性整体 ×1.08（四舍五入），仅改 attrs，保留其余字段。
import fs from 'fs';
const p = 'feihuaqi-playable/config/npcs.json';
const npcs = JSON.parse(fs.readFileSync(p, 'utf8'));
const M = 1.08;
let changed = 0;
for (const tier of npcs) {
  for (const n of (tier.npcs || [])) {
    const a = n.attrs || {};
    const na = {};
    for (const [k, v] of Object.entries(a)) {
      const nv = Math.round((Number(v) || 0) * M);
      if (nv !== v) changed++;
      na[k] = nv;
    }
    n.attrs = na;
  }
}
fs.writeFileSync(p, JSON.stringify(npcs, null, 2) + '\n');
console.log('npcs.json 已按 ×' + M + ' 缩放，变更属性值 ' + changed + ' 处。');
