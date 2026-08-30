// 完整工作区部署：把 feihuaqi-playable（拍平到仓库根）+ feihua-editors（作为子树）
// 一次性推到 main。保留 feihua-content.json（用本地根，作为云端工程基准）与
// leaderboard.json（保留玩家成绩）。排除 _* 调试脚本与备份脚本。
// 仅经 REST API 推送（git 协议在本沙箱被拦截），不触碰任何共享分支以外的引用。
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import https from 'node:https';

const TOKEN = process.env.TOKEN;
const OWNER = 'Luoluozi110';
const REPO = 'luoluo';
const PLAYABLE = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/feihuaqi-playable';
const EDITOR = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/feihua-editors';
const PROJECT_CONTENT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/feihua-content.json';
const DEPLOY_MESSAGE = process.env.DEPLOY_MESSAGE || 'deploy: publish playable, editor, and cloud content';
const TAG_TOPIC = (process.env.TAG_TOPIC || 'full-deploy').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'full-deploy';
const TAG_MESSAGE = process.env.TAG_MESSAGE || '完整部署（游戏、编辑器与云端工程基准）';
// 仅文本类型按 utf-8 上传；字体/图片等二进制走 base64，避免损坏。
const TEXT = new Set(['.html', '.css', '.js', '.json', '.md', '.mjs']);

function walk(dir, base = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    // 排除 _* 调试脚本（按任意路径段判定）
    if (name.startsWith('_')) continue;
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
  const baseTree = new Map((baseFull.tree || []).map((e) => [e.path, e]));
  console.log('当前 main:', parentSha, '| 基础树条目:', baseTree.size);

  // 1) 游戏（拍平到根）
  const pFiles = walk(PLAYABLE).sort();
  console.log('游戏待上传:', pFiles.length);
  const blobs = new Map();
  for (const rel of pFiles) {
    const buf = readFileSync(join(PLAYABLE, rel));
    const ext = rel.slice(rel.lastIndexOf('.'));
    const isText = TEXT.has(ext);
    const r = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content: isText ? buf.toString('utf-8') : buf.toString('base64'), encoding: isText ? 'utf-8' : 'base64' });
    blobs.set(rel, r.sha);
    process.stdout.write('.');
  }
  console.log('\n游戏 blob 完成');

  // 2) 编辑器（作为 feihua-editors/ 子树，已排除 _*）
  const eFiles = walk(EDITOR).sort();
  console.log('编辑器待上传:', eFiles.length);
  for (const rel of eFiles) {
    const buf = readFileSync(join(EDITOR, rel));
    const ext = rel.slice(rel.lastIndexOf('.'));
    const isText = TEXT.has(ext);
    const r = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content: isText ? buf.toString('utf-8') : buf.toString('base64'), encoding: isText ? 'utf-8' : 'base64' });
    blobs.set('feihua-editors/' + rel, r.sha);
    process.stdout.write('.');
  }
  console.log('\n编辑器 blob 完成');

  // 3) 组装最终树：以基础树为底，覆盖游戏与编辑器
  const tree = (baseFull.tree || []).map((e) => ({ path: e.path, mode: e.mode, type: e.type, sha: e.sha }));
  const treeMap = new Map(tree.map((e) => [e.path, e]));
  for (const [path, sha] of blobs) {
    treeMap.set(path, { path, mode: '100644', type: 'blob', sha });
  }

  // 3.0) feihua-content.json：用本地根（云端工程基准，与静态游戏同一提交）
  if (existsSync(PROJECT_CONTENT)) {
    const b = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content: readFileSync(PROJECT_CONTENT, 'utf8'), encoding: 'utf-8' });
    treeMap.set('feihua-content.json', { path: 'feihua-content.json', mode: '100644', type: 'blob', sha: b.sha });
    console.log('已用本地根 feihua-content.json 覆盖（云端工程基准）');
  } else if (baseTree.has('feihua-content.json')) {
    console.log('已保留远端 feihua-content.json（本地工程文件不存在）');
  }

  // 3.1) leaderboard.json：保留玩家成绩，不清空
  if (baseTree.has('leaderboard.json')) {
    console.log('已保留 leaderboard.json（不清空玩家成绩）');
  } else {
    const b = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content: '[]', encoding: 'utf-8' });
    treeMap.set('leaderboard.json', { path: 'leaderboard.json', mode: '100644', type: 'blob', sha: b.sha });
    console.log('已新建空 leaderboard.json');
  }

  const finalTree = [...treeMap.values()];
  const treeRes = await api('POST', `/repos/${OWNER}/${REPO}/git/trees`, { tree: finalTree });
  console.log('tree:', treeRes.sha, '| 条目:', finalTree.length);

  const commit = await api('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
    message: DEPLOY_MESSAGE,
    tree: treeRes.sha, parents: [parentSha],
  });
  console.log('commit:', commit.sha);
  await api('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/main`, { sha: commit.sha });
  console.log('main 已更新:', commit.sha);

  // 4) 带注释备份标签
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const tag = `backup/${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}-${TAG_TOPIC}`;
  const tagObj = await api('POST', `/repos/${OWNER}/${REPO}/git/tags`, {
    tag, message: TAG_MESSAGE + '（commit ' + commit.sha.slice(0, 8) + '）',
    object: commit.sha, type: 'commit',
    tagger: { name: 'WorkBuddy', email: 'buddy@local', date: d.toISOString() },
  });
  await api('POST', `/repos/${OWNER}/${REPO}/git/refs`, { ref: 'refs/tags/' + tag, sha: tagObj.sha });
  console.log('annotated tag:', tag, '->', tagObj.sha);
  console.log('DONE', commit.sha, tag);
}

main().then(() => process.exit(0)).catch((e) => { console.error('ERR', e.message); process.exit(1); });
