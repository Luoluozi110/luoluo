// feihua-content.json 定向合并：
// 以本地为底（保住 77 题 + sky/schools/grades/narrative 四块，修复线上回退），
// 仅从 main 挑回两处 npcs 增补：① 档0-4 的 balanceVersion + difficultyBoost；
// ② 康尔玉 palaceForcedWhen / stageForcedWhen 的 strictlyHigherThan（丢失会导致殿试必遇失效）。
import { readFileSync, writeFileSync } from 'node:fs';

const D = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/_merge_diff/';
const TARGET = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/feihua-content.json';

const main = JSON.parse(readFileSync(D + 'main__feihua-content.json', 'utf8'));
const local = JSON.parse(readFileSync(TARGET, 'utf8'));

const canon = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map((kk) => [kk, v[kk]])) : v));

let changed = [];
// ① 难度平衡：档 0-4
main.npcs.forEach((mf, i) => {
  const lf = local.npcs[i];
  if (!lf || !mf.difficultyBoost) return;
  if (canon(lf.difficultyBoost) === canon(mf.difficultyBoost) && lf.balanceVersion === mf.balanceVersion) return;
  lf.difficultyBoost = mf.difficultyBoost;
  lf.balanceVersion = mf.balanceVersion;
  changed.push(`档${i}(${mf.id}) 补 difficultyBoost=${JSON.stringify(mf.difficultyBoost)} balanceVersion=${mf.balanceVersion}`);
});

// ② 康尔玉 强制规则
const findNpc = (arr, name) => (arr || []).find((n) => n && n.name === name);
const mk = findNpc(main.npcs[4].npcs, '康尔玉');
const lk = findNpc(local.npcs[4].npcs, '康尔玉');
if (mk && lk) {
  for (const field of ['palaceForcedWhen', 'stageForcedWhen']) {
    const mv = mk[field], lv = lk[field] || {};
    if (mv && canon(mv) !== canon(lv)) {
      lk[field] = { ...lv, ...mv };
      changed.push(`康尔玉 ${field} 补 ${JSON.stringify(mv)}`);
    }
  }
}

writeFileSync(TARGET, JSON.stringify(local, null, 2) + '\n', 'utf8');
console.log('=== 已合并进本地 feihua-content.json ===');
changed.forEach((c) => console.log('  + ' + c));

// 校验：除上述两处外，npcs 块是否还有实质差异
let remain = [];
main.npcs.forEach((mf, i) => {
  const lf = local.npcs[i];
  if (!lf) return;
  const keys = [...new Set([...Object.keys(mf), ...Object.keys(lf)])];
  for (const k of keys) {
    if (k === 'npcs') continue;
    if (canon(mf[k]) !== canon(lf[k])) remain.push(`档${i}.${k}: main=${JSON.stringify(mf[k])} local=${JSON.stringify(lf[k])}`);
  }
  (mf.npcs || []).forEach((n, j) => {
    const ln = (lf.npcs || [])[j];
    if (!ln) { remain.push(`档${i}.npcs[${j}] ${n.name} main有本地无`); return; }
    if (canon(n) !== canon(ln)) remain.push(`档${i}.${n.name}: 内容仍不同`);
  });
});
console.log('\n=== npcs 块残余实质差异（空=完全一致）===');
remain.length ? remain.forEach((r) => console.log('  ! ' + r.slice(0, 160))) : console.log('  无');
