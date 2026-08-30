// 三方合并：base=4e39fa56, main=线上最新, local=当前工作区
// 行尾统一归一化到 LF 后再 merge（否则全量假冲突），合并结果按各文件原始行尾风格写回。
// 有冲突的文件不写回工作区，落盘到 _merge_diff/conflict_* 供人工处理。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const OUT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/_merge_diff';
const ROOT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25';
const safe = (p) => p.replace(/[^\w.-]/g, '_');

function dominantEol(buf) {
  const s = buf.toString('latin1');
  const crlf = (s.match(/\r\n/g) || []).length;
  const lf = (s.match(/(?<!\r)\n/g) || []).length;
  return crlf >= lf ? '\r\n' : '\n';
}
const toLf = (buf) => Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
const toEol = (buf, eol) => (eol === '\r\n'
  ? Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'), 'utf8')
  : toLf(buf));

const rows = JSON.parse(readFileSync(join(OUT, 'sides.json'), 'utf8'));
// 特殊处理、不参与自动三方合并的文件：
// feihua-content.json —— main 侧「删除」了 sky/schools/grades/narrative 四块并丢了 10 道题（实为回退）。
// diff3 会把该删除当正当改动套用，反而固化回退；必须单独以本地为底、只挑回 main 的 npcs 增补。
const EXCLUDE = new Set(['feihua-content.json']);
const targets = process.argv[2] === '--only-main'
  ? rows.filter((r) => r.side === 'ONLY_MAIN_改')
  : rows.filter((r) => r.side === 'BOTH_需三方合并' && !EXCLUDE.has(r.path));

let clean = 0, conflicted = 0;
const conflicts = [];

for (const r of targets) {
  const s = safe(r.path);
  const baseP = join(OUT, 'base__' + s), mainP = join(OUT, 'main__' + s), localP = join(OUT, 'local__' + s);
  // 本地真实路径（用于写回）
  const realLocal = r.path.startsWith('feihua-editors/')
    ? join(ROOT, 'feihua-editors', r.path.slice('feihua-editors/'.length))
    : r.path === 'feihua-content.json' ? join(ROOT, 'feihua-content.json') : join(ROOT, 'feihuaqi-playable', r.path);

  const localBuf = readFileSync(localP);
  const eol = dominantEol(localBuf);

  if (r.side === 'ONLY_MAIN_改') {
    // 本地自基准未变，直接采用 main（按本地行尾风格写入）
    const merged = toEol(readFileSync(mainP), eol);
    writeFileSync(realLocal, merged);
    console.log(`[取main] ${r.path}  (${merged.length}B, EOL=${eol === '\r\n' ? 'CRLF' : 'LF'})`);
    clean++;
    continue;
  }

  if (!existsSync(baseP)) { console.log(`[跳过:无基准] ${r.path}`); continue; }

  const lfBase = join(OUT, '_lf_base_' + s), lfMain = join(OUT, '_lf_main_' + s), lfLocal = join(OUT, '_lf_local_' + s);
  writeFileSync(lfBase, toLf(readFileSync(baseP)));
  writeFileSync(lfMain, toLf(readFileSync(mainP)));
  writeFileSync(lfLocal, toLf(readFileSync(localP)));

  let out, code = 0;
  try {
    out = execFileSync('git', ['merge-file', '-p', '--diff3', lfMain, lfBase, lfLocal], { cwd: OUT, encoding: 'buffer', maxBuffer: 1 << 28 });
  } catch (e) {
    out = e.stdout; code = e.status;
  }
  const text = out.toString('utf8');
  const nConf = (text.match(/^<<<<<<</gm) || []).length;
  if (nConf > 0) {
    const cp = join(OUT, 'conflict_' + s);
    writeFileSync(cp, text);
    conflicted++;
    conflicts.push({ path: r.path, conflicts: nConf, file: 'conflict_' + s, realLocal, eol: eol === '\r\n' ? 'CRLF' : 'LF' });
    console.log(`[冲突×${nConf}] ${r.path}`);
  } else {
    writeFileSync(realLocal, toEol(Buffer.from(text, 'utf8'), eol));
    clean++;
    console.log(`[已合并] ${r.path}  (${text.length}B)`);
  }
}

console.log(`\n===== 自动合并成功 ${clean} 个 / 需人工处理 ${conflicted} 个 =====`);
if (conflicts.length) {
  console.log('\n需人工处理:');
  conflicts.forEach((c) => console.log(`   ${c.path}  冲突${c.conflicts}处  -> ${c.file}  (目标 ${c.realLocal})`));
  writeFileSync(join(OUT, 'conflicts.json'), JSON.stringify(conflicts, null, 2));
}
