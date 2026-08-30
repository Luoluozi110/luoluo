// 把本地完整的 feihua-editors/ 目录整体推到 main（覆盖 editor 子树、保留其余游戏文件）。
// 修复：上一版编辑器备份只推送了 8 个文件，导致 19 个 JS（8 个模块 + 10 个 seed + icon-library）
// 在 GitHub Pages 上 404，对应模块 window.X 未定义、init 不执行、_ready 永远 false，
// 工作区摘要永久显示「正在载入 X/10 个模块…」。本次补齐全部文件。
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import https from 'node:https';

const TOKEN = process.env.TOKEN;
const OWNER = 'Luoluozi110';
const REPO = 'luoluo';
const ROOT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/feihua-editors';
const TEXT = new Set(['.html', '.css', '.js', '.json', '.md', '.mjs']);

function walk(dir, base = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = base ? base + '/' + name : name;
    if (statSync(full).isDirectory()) out.push(...walk(full, rel));
    else out.push(rel);
  }
  return out;
}

async function api(method, path, body) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const r = https.request({
          hostname: 'api.github.com', path, method,
          headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'wb-deploy', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
        }, (res) => {
          let s = ''; res.on('data', (c) => (s += c));
          res.on('end', () => {
            let j = null; try { j = JSON.parse(s); } catch (e) {}
            if (res.statusCode >= 200 && res.statusCode < 300) {
              if (j == null) return reject(new Error('empty-body ' + method + ' ' + path));
              resolve(j);
            } else reject(new Error(method + ' ' + path + ' -> ' + res.statusCode + ' ' + (j && (j.message || s.slice(0, 200)))));
          });
        });
        r.on('error', reject);
        if (data) r.write(data);
        r.end();
      });
    } catch (e) { lastErr = e; console.log(`  (retry ${attempt}/4) ${e.message}`); await new Promise((r) => setTimeout(r, 1500 * attempt)); }
  }
  throw lastErr;
}

async function main() {
  const ref = await api('GET', `/repos/${OWNER}/${REPO}/git/refs/heads/main`);
  const parentSha = ref.object.sha;
  const cm = await api('GET', `/repos/${OWNER}/${REPO}/git/commits/${parentSha}`);
  const baseFull = await api('GET', `/repos/${OWNER}/${REPO}/git/trees/${cm.tree.sha}?recursive=1`);
  const beforeEditors = (baseFull.tree || []).filter((e) => e.path.startsWith('feihua-editors/')).length;
  console.log('当前 main:', parentSha, '| 现有 feihua-editors 文件:', beforeEditors);

  // 上传本地 feihua-editors 全部文件
  const files = walk(ROOT).sort();
  console.log('本地 feihua-editors 待上传文件:', files.length);
  const blobs = {};
  for (const rel of files) {
    const buf = readFileSync(join(ROOT, rel));
    const ext = rel.slice(rel.lastIndexOf('.'));
    const isText = TEXT.has(ext);
    const content = isText ? buf.toString('utf-8') : buf.toString('base64');
    const r = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content, encoding: isText ? 'utf-8' : 'base64' });
    blobs['feihua-editors/' + rel] = r.sha;
    process.stdout.write('.');
  }
  console.log('\nblob 完成');

  // 组装 tree：保留 main 其余所有文件，用本地完整 feihua-editors 覆盖该子树
  const tree = (baseFull.tree || [])
    .filter((e) => !e.path.startsWith('feihua-editors/'))
    .map((e) => ({ path: e.path, mode: e.mode, type: e.type, sha: e.sha }));
  for (const rel of files) {
    tree.push({ path: 'feihua-editors/' + rel, mode: '100644', type: 'blob', sha: blobs['feihua-editors/' + rel] });
  }
  console.log('最终 tree 条目:', tree.length, '（feihua-editors:', files.length, '）');

  const treeRes = await api('POST', `/repos/${OWNER}/${REPO}/git/trees`, { tree });
  console.log('tree:', treeRes.sha);
  const commit = await api('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
    message: 'fix(editors): 补齐部署缺失的 19 个 JS 文件，修复工作区永久「正在载入」\n\n上一版编辑器备份仅推送 8 个文件，导致 talent/npc/affinity/synergy/board/sky/album/cloud 八模块、10 个 seed 与 icon-library 在 GitHub Pages 404，对应 window.X 未定义、init 不执行、_ready 永远 false。现用本地完整目录覆盖 feihua-editors/ 子树，其余游戏文件与工程配置保持不变。',
    tree: treeRes.sha, parents: [parentSha],
  });
  console.log('commit:', commit.sha);
  await api('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/main`, { sha: commit.sha });
  console.log('main 已更新');

  // 带注释备份标签
  const tagName = 'backup/20260827-2231-editor-full-deploy';
  const tagObj = await api('POST', `/repos/${OWNER}/${REPO}/git/tags`, {
    tag: tagName,
    message: '编辑器完整部署：补齐缺失的 19 个 JS，修复「正在载入」卡死（commit ' + commit.sha.slice(0, 8) + '）',
    object: commit.sha,
    type: 'commit',
    tagger: { name: 'WorkBuddy', email: 'buddy@local', date: new Date().toISOString() },
  });
  await api('POST', `/repos/${OWNER}/${REPO}/git/refs`, { ref: 'refs/tags/' + tagName, sha: tagObj.sha });
  console.log('annotated tag:', tagName, '->', tagObj.sha);
}

main().then(() => console.log('DONE')).catch((e) => { console.error('ERR', e.message); process.exit(1); });
