// 第二版：把「劳神/苦思/应酬」类事件的灵感消耗大幅加深（封笔目标 ~15%）。
// 原则：劳神类事件成本 3~6；choice 事件里「劳神」选项成本 4~6，「养神」选项保留小额增益或 0。
import fs from 'fs';
const p = 'feihuaqi-playable/config/events.json';
const evs = JSON.parse(fs.readFileSync(p, 'utf8'));
const byId = new Map(evs.map(e => [e.id, e]));

function setDirect(id, insp) { const e = byId.get(id); if (e && e.kind === 'direct') e.effect.inspiration = insp; }
function setChoice(id, idx, insp) { const e = byId.get(id); if (e && e.kind === 'choice') { const c = e.choices[idx]; if (c) c.effect = { ...(c.effect || {}), inspiration: insp }; } }

// —— direct 劳神事件（固定消耗） ——
setDirect('E009', -5);   // 凿壁偷光
setDirect('E016', -4);   // 借书一观
setDirect('E020', -3);   // 石上题联（原 +1 → 劳神续联）
setDirect('E021', -5);   // 灯下抄书
setDirect('E026', -3);   // 桑下劝学（原 0 → 劳神）
setDirect('E034', -4);   // 古寺残碑
setDirect('E037', -3);   // 秋声入耳
setDirect('E038', -4);   // 试笔新砚

// —— choice 劳神事件（劳神选项 4~6，养神选项 0/+小额） ——
setChoice('E006', 0, -5); setChoice('E006', 1, -7);  // 江郎才尽：还笔 -5 / 强留 -7
setChoice('E007', 0, 1);  setChoice('E007', 1, -3);  // 一字之师：虚心 +1 / 自恃 -3
setChoice('E012', 0, -6); setChoice('E012', 1, 0);   // 焚膏继晷：熬夜 -6 / 就寝 0
setChoice('E014', 0, -5);                              // 推敲之苦：苦思 -5
setChoice('E018', 0, -3); setChoice('E018', 1, -2);  // 老农问字：讲字 -3 / 赶路 -2
setChoice('E019', 0, -4);                              // 驿路逢雨：冒雨 -4
setChoice('E024', 0, -3);                              // 舟中夜话：共话 -3
setChoice('E025', 0, -4);                              // 落第榜下：写诗 -4
setChoice('E032', 0, -6);                              // 病中得句：记句 -6
setChoice('E035', 0, -3);                              // 雪夜访戴：乘兴 -3

fs.writeFileSync(p, JSON.stringify(evs, null, 2) + '\n');
console.log('events.json 已更新（第二版劳神成本）：');
for (const e of evs) {
  if (e.kind === 'direct') console.log(`  ${e.id} ${e.name}: ${e.effect.inspiration}`);
  if (e.kind === 'choice') console.log(`  ${e.id} ${e.name}: [${e.choices.map(c => c.effect?.inspiration ?? 0).join(', ')}]`);
}
