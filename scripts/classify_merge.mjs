// 对 33 个分歧文件做包含关系分析：判断「本地是 main 的超集 / main 是本地的超集 / 真双向分歧」
// 依据：以行为单位（去空白归一化）计算各自独有的行数。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/_merge_diff';
const idx = JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8'));

const norm = (s) => s.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

const rows = [];
for (const d of idx.differ) {
  const m = norm(readFileSync(join(OUT, d.mainFile), 'utf8'));
  const l = norm(readFileSync(join(OUT, d.localFile), 'utf8'));
  const ms = new Set(m), ls = new Set(l);
  const onlyMain = [...new Set(m.filter((x) => !ls.has(x)))];
  const onlyLocal = [...new Set(l.filter((x) => !ms.has(x)))];
  let verdict;
  if (onlyMain.length === 0 && onlyLocal.length === 0) verdict = 'IDENTICAL_忽略空白';
  else if (onlyMain.length === 0) verdict = 'LOCAL_SUPERSET→取本地';
  else if (onlyLocal.length === 0) verdict = 'MAIN_SUPERSET→取main';
  else verdict = 'BOTH_双向分歧';
  rows.push({ path: d.path, onlyMain: onlyMain.length, onlyLocal: onlyLocal.length, verdict });
}

const byVerdict = {};
for (const r of rows) (byVerdict[r.verdict] ||= []).push(r);
for (const [v, list] of Object.entries(byVerdict)) {
  console.log(`\n### ${v}  (${list.length} 个)`);
  list.sort((a, b) => (b.onlyMain + b.onlyLocal) - (a.onlyMain + a.onlyLocal));
  list.forEach((r) => console.log(`   ${r.path}   main独有行=${r.onlyMain}  local独有行=${r.onlyLocal}`));
}
