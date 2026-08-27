// 外科手术式部署：基于当前 main 的树，仅新增/更新指定根目录文件，不重建整棵树。
// 用法：node deploy_root_docs.mjs "<提交信息>" <文件1> <文件2> ...
// 文件相对仓库根（即本工作区根）。
import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import https from 'https';

const TOKEN = process.env.TOKEN;
const OWNER = 'Luoluozi110';
const REPO = 'luoluo';
const ROOT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25';
const MSG = process.argv[2];
const FILES = process.argv.slice(3);

const TEXT = new Set(['.html', '.css', '.js', '.json', '.md', '.txt']);

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        Authorization: 'token ' + TOKEN,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'wb-deploy',
        'Content-Type': 'application/json',
      },
    }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        let j = null; try { j = JSON.parse(d); } catch (e) {}
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(j);
        else reject(new Error(method + ' ' + path + ' -> ' + res.statusCode + ' ' + (j && (j.message || d.slice(0, 200)))));
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  const ref = await req('GET', `/repos/${OWNER}/${REPO}/git/refs/heads/main`);
  const parentSha = ref.object.sha;
  const parentTree = await req('GET', `/repos/${OWNER}/${REPO}/git/trees/${parentSha}`);
  const existing = parentTree.tree.filter((e) => e.type === 'blob');

  const blobs = {};
  for (const rel of FILES) {
    const full = join(ROOT, rel);
    const buf = readFileSync(full);
    const ext = rel.slice(rel.lastIndexOf('.'));
    const isText = TEXT.has(ext);
    const content = isText ? buf.toString('utf-8') : buf.toString('base64');
    const r = await req('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content, encoding: isText ? 'utf-8' : 'base64' });
    blobs[rel] = r.sha;
    console.log('blob', rel, '->', r.sha.slice(0, 8));
  }

  const kept = existing.filter((e) => !FILES.includes(e.path));
  const added = FILES.map((rel) => ({ path: rel, mode: '100644', type: 'blob', sha: blobs[rel] }));
  const treeRes = await req('POST', `/repos/${OWNER}/${REPO}/git/trees`, { tree: [...kept, ...added] });
  console.log('tree sha:', treeRes.sha);

  const commit = await req('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
    message: MSG,
    tree: treeRes.sha,
    parents: [parentSha],
  });
  console.log('commit sha:', commit.sha);

  await req('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/main`, { sha: commit.sha });
  console.log('已更新 main (父提交=' + parentSha + ')');
  console.log('NEW_MAIN=' + commit.sha);
}

main().then(() => console.log('DONE')).catch((e) => { console.error('ERR', e.message); process.exit(1); });
