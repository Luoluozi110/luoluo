// 按目标总预算保持相对比例 renormalize 举人/进士/主考三档，写回 config/npcs.json
import fs from 'fs';
const P = 'feihuaqi-playable/config/npcs.json';
const targets = { juren:100, jinshi:138, zhukaoguan:174 }; // E3 档
const n = JSON.parse(fs.readFileSync(P,'utf8'));
const byTier = {};
for (const t of n) byTier[t.id] = t;
for (const [tid, target] of Object.entries(targets)) {
  const t = byTier[tid]; if (!t) continue;
  for (const npc of (t.npcs||[])) {
    const keys = Object.keys(npc.attrs);
    const cur = keys.reduce((s,k)=>s+Number(npc.attrs[k]||0),0);
    let sum = 0; const scaled = {};
    for (const k of keys){ scaled[k] = Math.round((Number(npc.attrs[k])||0) * target / cur); sum += scaled[k]; }
    // 差额补到主属性
    let diff = target - sum;
    const mainKey = keys.reduce((a,b)=> scaled[a]>=scaled[b]? a:b);
    if (diff!==0){ scaled[mainKey]+=diff; }
    // 确保非负
    for (const k of keys) if (scaled[k]<0) scaled[k]=0;
    npc.attrs = scaled;
  }
  t.desc = t.desc.replace(/六维总预算(提升至|为)? ?\d+/, `六维总预算提升至 ${target}`) || t.desc;
}
fs.writeFileSync(P, JSON.stringify(n, null, 2) + '\n');
console.log('renormalized ->', JSON.stringify(targets));
// 校验
for (const t of n) if (['举人级','进士级','主考官'].includes(t.tier)) {
  const sums = (t.npcs||[]).map(x=>Object.values(x.attrs).reduce((a,b)=>a+Number(b||0),0));
  console.log(t.tier, 'id', t.id, 'desc:', t.desc, 'sums:', sums.join(','));
}
