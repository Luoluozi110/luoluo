// 比对：live main 树 vs 本地工作区（playable 拍平到根 + editors 子树 + 根 feihua-content.json）
// 用 git blob SHA（sha1("blob <len>\0"+bytes)）比对，不受换行/编码影响。
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import https from 'node:https';

const TOKEN = process.env.TOKEN;
const OWNER = 'Luoluozi110';
const REPO = 'luoluo';
const ROOT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25';
const PLAYABLE = join(ROOT, 'feihuaqi-playable');
const EDITOR = join(ROOT, 'feihua-editors');
const OUT = join(ROOT, '_merge_diff');

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: 'api.github.com', path, method,
      headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'wb-diff', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
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

function blobSha(buf) {
  const h = createHash('sha1');
  h.update(Buffer.from('blob ' + buf.length + '\0'));
  h.update(buf);
  return h.digest('hex');
}

function walk(dir, base = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    if (name.startsWith('_')) continue;
    const full = join(dir, name);
    const rel = base ? base + '/' + name : name;
    if (statSync(full).isDirectory()) out.push(...walk(full, rel));
    else out.push(rel);
  }
  return out;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const ref = await api('GET', `/repos/${OWNER}/${REPO}/git/refs/heads/main`);
  const cm = await api('GET', `/repos/${OWNER}/${REPO}/git/commits/${ref.object.sha}`);
  const tree = await api('GET', `/repos/${OWNER}/${REPO}/git/trees/${cm.tree.sha}?recursive=1`);
  const mainMap = new Map((tree.tree || []).filter((e) => e.type === 'blob').map((e) => [e.path, e.sha]));
  console.log('main:', ref.object.sha.slice(0, 12), '| blob 数:', mainMap.size);

  // 本地文件 → 远端路径
  const local = new Map();
  for (const rel of walk(PLAYABLE)) local.set(rel, join(PLAYABLE, rel));
  for (const rel of walk(EDITOR)) local.set('feihua-editors/' + rel, join(EDITOR, rel));
  const pc = join(ROOT, 'feihua-content.json');
  local.set('feihua-content.json', pc);

  const onlyLocal = [], differ = [], same = [];
  for (const [path, abs] of local) {
    const buf = readFileSync(abs);
    const sha = blobSha(buf);
    const m = mainMap.get(path);
    if (m === undefined) onlyLocal.push(path);
    else if (m === sha) same.push(path);
    else differ.push({ path, abs, localSha: sha, mainSha: m });
  }
  console.log('\n=== 分类 ===');
  console.log('一致:', same.length);
  console.log('仅本地有（新增）:', onlyLocal.length);
  console.log('内容不一致（需合并/判断）:', differ.length);
  if (onlyLocal.length) console.log('\n[仅本地]:\n  ' + onlyLocal.join('\n  '));

  // 拉取 main 版本落盘，便于逐文件 diff
  const list = [];
  for (const d of differ) {
    const j = await api('GET', `/repos/${OWNER}/${REPO}/git/blobs/${d.mainSha}`);
    const buf = Buffer.from(j.content, j.encoding === 'base64' ? 'base64' : 'utf-8');
    const safe = d.path.replace(/[^\w.-]/g, '_');
    writeFileSync(join(OUT, 'main__' + safe), buf);
    writeFileSync(join(OUT, 'local__' + safe), readFileSync(d.abs));
    list.push({ path: d.path, mainFile: 'main__' + safe, localFile: 'local__' + safe, mainSize: buf.length, localSize: readFileSync(d.abs).length });
  }
  writeFileSync(join(OUT, 'index.json'), JSON.stringify({ main: ref.object.sha, onlyLocal, differ: list }, null, 2));
  console.log('\n[不一致文件]（已落盘到 _merge_diff/）:');
  list.forEach((l) => console.log(`  ${l.path}  (main ${l.mainSize}B / local ${l.localSize}B)`));
}
main().then(() => process.exit(0)).catch((e) => { console.error('ERR', e.message); process.exit(1); });
