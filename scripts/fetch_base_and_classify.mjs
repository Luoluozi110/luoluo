// 取合并基准 4e39fa56 的内容，判定每个分歧文件的「改动侧」：
//   只有 main 改 / 只有 local 改 / 双方都改（需三方合并）
// 输出 base__* 供 git merge-file 使用。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import https from 'node:https';

const TOKEN = process.env.TOKEN;
const OWNER = 'Luoluozi110';
const REPO = 'luoluo';
const BASE_SHA = '4e39fa56aa2afeba440dda945de7eb8cac0a8d0c';
const OUT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/_merge_diff';

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: 'api.github.com', path, method,
      headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'wb-base', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
    }, (res) => {
      let s = ''; res.on('data', (c) => (s += c));
      res.on('end', () => {
        let j = null; try { j = JSON.parse(s); } catch (e) {}
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(j);
        else reject(new Error(method + ' ' + path + ' -> ' + res.statusCode + ' ' + (j && (j.message || s.slice(0, 200)))));
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const sha1 = (buf) => createHash('sha1').update(Buffer.from('blob ' + buf.length + '\0')).update(buf).digest('hex');

async function main() {
  mkdirSync(OUT, { recursive: true });
  const idx = JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8'));
  // 基准树
  const bc = await api('GET', `/repos/${OWNER}/${REPO}/git/commits/${BASE_SHA}`);
  const bt = await api('GET', `/repos/${OWNER}/${REPO}/git/trees/${bc.tree.sha}?recursive=1`);
  const baseMap = new Map((bt.tree || []).filter((e) => e.type === 'blob').map((e) => [e.path, e.sha]));

  const rows = [];
  for (const d of idx.differ) {
    const localBuf = readFileSync(join(OUT, d.localFile));
    const mainBuf = readFileSync(join(OUT, d.mainFile));
    const baseEntry = baseMap.get(d.path);
    let baseBuf = null, side;
    if (baseEntry === undefined) {
      side = 'BASE_缺失→需人工判断';
    } else {
      const j = await api('GET', `/repos/${OWNER}/${REPO}/git/blobs/${baseEntry}`);
      baseBuf = Buffer.from(j.content, j.encoding === 'base64' ? 'base64' : 'utf-8');
      const bS = sha1(baseBuf), lS = sha1(localBuf), mS = sha1(mainBuf);
      const localChanged = bS !== lS, mainChanged = bS !== mS;
      side = localChanged && mainChanged ? 'BOTH_需三方合并'
        : mainChanged ? 'ONLY_MAIN_改'
        : localChanged ? 'ONLY_LOCAL_改'
        : '两侧均未变(异常)';
      const safe = d.path.replace(/[^\w.-]/g, '_');
      writeFileSync(join(OUT, 'base__' + safe), baseBuf);
    }
    rows.push({ path: d.path, side, baseSize: baseBuf ? baseBuf.length : 0, mainSize: mainBuf.length, localSize: localBuf.length });
    process.stdout.write('.');
  }
  console.log('\n');
  const by = {};
  rows.forEach((r) => (by[r.side] ||= []).push(r));
  for (const [s, list] of Object.entries(by)) {
    console.log(`\n### ${s}  (${list.length})`);
    list.forEach((r) => console.log(`   ${r.path.padEnd(52)} base=${r.baseSize} main=${r.mainSize} local=${r.localSize}`));
  }
  writeFileSync(join(OUT, 'sides.json'), JSON.stringify(rows, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error('ERR', e.message); process.exit(1); });
