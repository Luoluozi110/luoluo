// 回退「行路耗神」补偿：把 grades 九档分数线从 ×0.94 恢复为原值（÷0.94）。
// 仅改 grades[].min/max，不动 bonuses/结构。
import fs from 'fs';
const p = 'feihuaqi-playable/config/grades.json';
const g = JSON.parse(fs.readFileSync(p, 'utf8'));
const F = 0.94;
for (const gr of g.grades) {
  gr.min = Math.round(gr.min / F);
  gr.max = gr.max == null ? null : Math.round(gr.max / F);
}
fs.writeFileSync(p, JSON.stringify(g, null, 2) + '\n');
console.log('grades.json 已 ÷0.94 回退：');
for (const gr of g.grades) console.log(`  ${gr.name}: ${gr.min}${gr.max == null ? '~∞' : '~' + gr.max}`);
