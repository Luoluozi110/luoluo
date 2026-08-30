// 按规则解决三方合并残留的冲突（diff3 标记）。
// spec: { "<conflictFile>": { out: "<写回路径>", rules: ["main"|"local", ...] 或 {n:{pick:'main'|'local'|'custom', lines:[...]}} } }
// 冲突按出现顺序编号（从 1 开始）。
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/_merge_diff';
const ROOT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25';

const spec = JSON.parse(readFileSync(join(OUT, 'resolve-spec.json'), 'utf8'));

function dominantEol(buf) {
  const s = buf.toString('latin1');
  const crlf = (s.match(/\r\n/g) || []).length;
  const lf = (s.match(/(?<!\r)\n/g) || []).length;
  return crlf >= lf ? '\r\n' : '\n';
}
const toEol = (text, eol) => (eol === '\r\n' ? text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n') : text.replace(/\r\n/g, '\n'));

let filesDone = 0;
for (const [conflictFile, cfg] of Object.entries(spec)) {
  const src = readFileSync(join(OUT, conflictFile), 'utf8');
  const lines = src.split('\n');
  const out = [];
  let cur = null, idx = 0;

  const flush = () => {
    if (!cur) return;
    idx++;
    const rule = cfg.rules[idx - 1];
    const pick = typeof rule === 'string' ? rule : rule.pick;
    if (pick === 'main') out.push(...cur.main);
    else if (pick === 'local') out.push(...cur.local);
    else if (pick === 'base') out.push(...cur.base);
    else if (pick === 'custom') out.push(...rule.lines);
    else if (pick === 'mergeByPrefix') {
      // 按「行首标识符」逐行挑选来源：两边互补地改了同一组不同字段时用它拼接，避免手抄长行出错。
      const keyOf = (l) => (l.trim().match(/^([A-Za-z_$][\w$]*)\s*:/) || [])[1] || '';
      const want = new Map(rule.map.map((m) => [m.prefix, m.from]));
      const pickFrom = (key, side) => (side === 'local' ? cur.local : cur.main).find((l) => keyOf(l) === key);
      const used = new Set();
      for (const l of cur.main) {
        const k = keyOf(l);
        if (want.has(k) && want.get(k) === 'local') { const alt = pickFrom(k, 'local'); if (alt) { out.push(alt); used.add(k); continue; } }
        out.push(l); used.add(k);
      }
      for (const l of cur.local) { const k = keyOf(l); if (!used.has(k)) out.push(l); }
      console.log(`   冲突${idx}: 按字段拼接 ${rule.map.map((m) => m.prefix + '←' + m.from).join(', ')}`);
      cur = null; return;
    }
    else throw new Error('未知规则: ' + JSON.stringify(rule) + ' @冲突' + idx);
    console.log(`   冲突${idx}: 取 ${pick}${pick === 'custom' ? ' (' + rule.lines.length + '行手写)' : ''}`);
    cur = null;
  };

  for (const l of lines) {
    if (/^<{7}/.test(l)) { cur = { main: [], base: [], local: [], sec: 'main' }; continue; }
    if (cur) {
      if (/^\|{7}/.test(l)) { cur.sec = 'base'; continue; }
      if (/^={7}$/.test(l)) { cur.sec = 'local'; continue; }
      if (/^>{7}/.test(l)) { flush(); continue; }
      cur[cur.sec].push(l); continue;
    }
    out.push(l);
  }
  flush();

  const text = out.join('\n');
  if (/^<{7}|^={7}$|^>{7}/m.test(text)) throw new Error(conflictFile + ' 仍残留冲突标记');

  const target = join(ROOT, cfg.out);
  const eol = cfg.eol || (dominantEol(readFileSync(join(OUT, 'local__' + conflictFile.replace(/^conflict_/, '')))) === '\r\n' ? 'CRLF' : 'LF');
  writeFileSync(target, Buffer.from(toEol(text, eol === 'CRLF' ? '\r\n' : '\n'), 'utf8'));
  console.log(`[已解决] ${conflictFile} -> ${cfg.out}  (${out.length}行, EOL=${eol})`);
  filesDone++;
}
console.log(`\n完成 ${filesDone} 个文件`);
