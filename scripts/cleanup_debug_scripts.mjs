// 清理：从 main 删除此前部署遗留的 _* 调试脚本（不被 index.html 引用，仅调试用）。
// 经 REST API 推送，不触碰共享分支以外的引用，创建新的不可复用注释标签。
import https from 'node:https';

const TOKEN = process.env.TOKEN;
const OWNER = 'Luoluozi110';
const REPO = 'luoluo';
const REMOVE = [
  'feihua-editors/tests/_diag-upgrade-effect.mjs',
  'feihua-editors/tests/_verify-richedit.mjs',
];

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: 'api.github.com', path, method,
      headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'wb-deploy', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
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

async function main() {
  const ref = await api('GET', `/repos/${OWNER}/${REPO}/git/refs/heads/main`);
  const parentSha = ref.object.sha;
  const cm = await api('GET', `/repos/${OWNER}/${REPO}/git/commits/${parentSha}`);
  const base = await api('GET', `/repos/${OWNER}/${REPO}/git/trees/${cm.tree.sha}?recursive=1`);
  const rm = new Set(REMOVE);
  const kept = (base.tree || []).filter((e) => e.type === 'blob' && !rm.has(e.path));
  console.log('基础树 blob 数:', (base.tree || []).filter((e) => e.type === 'blob').length, '| 删除:', REMOVE.length, '| 保留:', kept.length);
  const treeRes = await api('POST', `/repos/${OWNER}/${REPO}/git/trees`, { tree: kept.map((e) => ({ path: e.path, mode: e.mode, type: e.type, sha: e.sha })) });
  const commit = await api('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
    message: 'chore: 从线上移除遗留的 _* 调试脚本\n\n按部署要求排除调试脚本：feihua-editors/tests/_diag-upgrade-effect.mjs 与 _verify-richedit.mjs 不被 index.html 引用，仅本地调试用，已从 main 删除。',
    tree: treeRes.sha, parents: [parentSha],
  });
  await api('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/main`, { sha: commit.sha });
  console.log('main 已更新:', commit.sha);
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const tag = `backup/${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}-remove-debug-scripts`;
  const tagObj = await api('POST', `/repos/${OWNER}/${REPO}/git/tags`, {
    tag, message: '移除遗留 _* 调试脚本（main ' + commit.sha.slice(0, 8) + '）',
    object: commit.sha, type: 'commit', tagger: { name: 'WorkBuddy', email: 'buddy@local', date: d.toISOString() },
  });
  await api('POST', `/repos/${OWNER}/${REPO}/git/refs`, { ref: 'refs/tags/' + tag, sha: tagObj.sha });
  console.log('annotated tag:', tag, '->', tagObj.sha);
  console.log('DONE', commit.sha, tag);
}
main().then(() => process.exit(0)).catch((e) => { console.error('ERR', e.message); process.exit(1); });
