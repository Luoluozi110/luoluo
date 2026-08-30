// 把部署脚本 deploy_github2.mjs 的改动（保留 feihua-editors 子树）备份到 main。
// 仅覆盖该脚本文件，保留 main 其余文件（含 feihua-editors/、feihua-content.json、leaderboard.json）。
import { readFileSync } from 'fs';
import https from 'https';

const TOKEN = process.env.TOKEN;
const OWNER = 'Luoluozi110';
const REPO = 'luoluo';
const FILE = 'deploy_github2.mjs';
const ROOT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25';

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({ hostname: 'api.github.com', path, method, headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'wb-backup', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' } }, (res) => {
      let s = ''; res.on('data', (c) => (s += c));
      res.on('end', () => { let j = null; try { j = JSON.parse(s); } catch (e) {} if (res.statusCode >= 200 && res.statusCode < 300) { if (j == null) return reject(new Error('empty ' + method)); resolve(j); } else reject(new Error(method + ' ' + path + ' -> ' + res.statusCode + ' ' + (j && (j.message || s.slice(0, 200))))); });
    });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
}

async function main() {
  const ref = await api('GET', `/repos/${OWNER}/${REPO}/git/refs/heads/main`);
  const parentSha = ref.object.sha;
  const cm = await api('GET', `/repos/${OWNER}/${REPO}/git/commits/${parentSha}`);
  const base = await api('GET', `/repos/${OWNER}/${REPO}/git/trees/${cm.tree.sha}?recursive=1`);
  const map = new Map();
  for (const e of base.tree) if (e.type === 'blob') map.set(e.path, e.sha);

  const content = readFileSync(ROOT + '/' + FILE, 'utf-8');
  const blob = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content, encoding: 'utf-8' });
  map.set(FILE, blob.sha);
  const tree = [...map.entries()].map(([path, sha]) => ({ path, mode: '100644', type: 'blob', sha }));

  const treeRes = await api('POST', `/repos/${OWNER}/${REPO}/git/trees`, { tree });
  const commit = await api('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
    message: 'chore(deploy): 游戏部署保留 feihua-editors 子树，避免误删线上编辑器页面',
    tree: treeRes.sha, parents: [parentSha],
  });
  await api('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/main`, { sha: commit.sha });
  const tag = 'backup/20260827-2210-deploy-preserve-editor';
  const tagObj = await api('POST', `/repos/${OWNER}/${REPO}/git/tags`, {
    tag, message: '部署脚本：游戏拍平部署时保留 feihua-editors/ 子树 — 回退点',
    object: commit.sha, type: 'commit', tagger: { name: 'WorkBuddy', email: 'buddy@local', date: new Date().toISOString() },
  });
  await api('POST', `/repos/${OWNER}/${REPO}/git/refs`, { ref: 'refs/tags/' + tag, sha: tagObj.sha });
  console.log('DONE commit=' + commit.sha + ' tag=' + tagObj.sha);
}
main().then(() => process.exit(0)).catch((e) => { console.error('ERR', e.message); process.exit(1); });
