// 把 grades.json 的九档分数线相对「扩图前原始基线」整体上提 factor 倍（扩图80格后恢复手感）。
// 从原始基线阈值生成，保证档位连续无重叠；其余字段(维度/加成/文案)不动。
import fs from 'fs';
const f = 'feihuaqi-playable/config/grades.json';
const g = JSON.parse(fs.readFileSync(f, 'utf8'));
const factor = 1.164;
const base = [
  { id:'tongsheng', name:'童生', min:0, max:1949, reward:'' },
  { id:'xiucai', name:'秀才', min:1950, max:2199, reward:'「书生」头像框' },
  { id:'juren', name:'举人', min:2200, max:2599, reward:'名篇残卷系统' },
  { id:'jinshi', name:'进士', min:2600, max:2749, reward:'困难模式' },
  { id:'tanhua', name:'探花', min:2750, max:2799, reward:'「探花」主题皮肤' },
  { id:'bangyan', name:'榜眼', min:2800, max:2899, reward:'自定义开局' },
  { id:'zhuangyuan', name:'状元', min:2900, max:2999, reward:'「状元」入场动画' },
  { id:'hanlin', name:'翰林', min:3000, max:3099, reward:'全部天赋预览' },
  { id:'wenzong', name:'文宗', min:3100, max:null, reward:'「文宗」称号与特效' },
];
const out = [];
let prevMax = -1;
for (const t of base) {
  let min = t.min === 0 ? 0 : Math.round(t.min * factor);
  let max = t.max == null ? null : Math.round(t.max * factor);
  if (prevMax >= 0 && min <= prevMax) min = prevMax + 1; // 连续无重叠
  out.push({ id:t.id, name:t.name, min, max, reward:t.reward });
  prevMax = max == null ? Infinity : max;
}
g.grades = out;
fs.writeFileSync(f, JSON.stringify(g, null, 2) + '\n');
console.log('grades.json 分数线已 ×'+factor+'（相对扩图前基线）');
for (const t of out) console.log(t.name, t.min, '~', t.max);
