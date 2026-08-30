// 对若干个 conflict_* 文件逐冲突区做取舍分析：取 main 会丢哪些本地行 / 取 local 会丢哪些 main 行
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/_merge_diff';
const only = process.argv.slice(2);

function parse(file) {
  const lines = readFileSync(join(OUT, file), 'utf8').split('\n');
  const regions = []; let cur = null;
  lines.forEach((l, i) => {
    if (/^<{7}/.test(l)) { cur = { main: [], base: [], local: [], start: i + 1, sec: 'main' }; return; }
    if (!cur) return;
    if (/^\|{7}/.test(l)) { cur.sec = 'base'; return; }
    if (/^={7}$/.test(l)) { cur.sec = 'local'; return; }
    if (/^>{7}/.test(l)) { regions.push(cur); cur = null; return; }
    cur[cur.sec].push(l);
  });
  return regions;
}

const files = only.length ? only : readdirSync(OUT).filter((f) => f.startsWith('conflict_'));
for (const f of files) {
  const regions = parse(f);
  console.log(`\n########## ${f}  (${regions.length} 处冲突) ##########`);
  const trim = (a) => a.map((x) => x.trim()).filter(Boolean);
  regions.forEach((r, i) => {
    const b = new Set(trim(r.base)), m = new Set(trim(r.main)), l = new Set(trim(r.local));
    const mNew = [...m].filter((x) => !b.has(x)), lNew = [...l].filter((x) => !b.has(x));
    const loseIfLocal = mNew.filter((x) => !l.has(x));   // 取local会丢的main新增
    const loseIfMain = lNew.filter((x) => !m.has(x));    // 取main会丢的local新增
    console.log(`\n--- 冲突${i + 1} @行${r.start} | main区${r.main.length}行 local区${r.local.length}行`);
    console.log(`    取LOCAL丢main:${loseIfLocal.length}  取MAIN丢local:${loseIfMain.length}`);
    if (loseIfLocal.length <= 3) loseIfLocal.forEach((x) => console.log(`      丢main> ${x.slice(0, 110)}`));
    if (loseIfMain.length <= 3) loseIfMain.forEach((x) => console.log(`      丢local> ${x.slice(0, 110)}`));
    if (loseIfLocal.length > 3 || loseIfMain.length > 3) {
      console.log(`      (main侧首行) ${(r.main[0] || '').trim().slice(0, 100)}`);
      console.log(`      (local侧首行) ${(r.local[0] || '').trim().slice(0, 100)}`);
    }
  });
}
