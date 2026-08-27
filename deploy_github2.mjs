// 最终部署：把 feihuaqi-playable 全部静态文件（含字体）推到 main。
// 若工作区根目录有 feihua-content.json，则同时上传它，保证云端工程配置与静态游戏同一提交；
// 否则保留仓库已有文件。这样地图/阶段门改动不会出现“JS 已更新、云端 board 仍旧”的拆分状态。
import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import https from 'https';

const TOKEN = process.env.TOKEN;
const OWNER = 'Luoluozi110';
const REPO = 'luoluo';
const ROOT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/feihuaqi-playable';
const PROJECT_CONTENT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/feihua-content.json';
const TEXT = new Set(['.html', '.css', '.js', '.json', '.md']);

function walk(dir, base = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === '.git') continue;
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
    } catch (e) {
      lastErr = e;
      console.log(`  (retry ${attempt}/4) ${e.message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

async function main() {
  // 1) 当前 main 的 feihua-content.json blob（保留）
  const ref = await api('GET', `/repos/${OWNER}/${REPO}/git/refs/heads/main`);
  const parentSha = ref.object.sha;
  const cm = await api('GET', `/repos/${OWNER}/${REPO}/git/commits/${parentSha}`);
  const baseFull = await api('GET', `/repos/${OWNER}/${REPO}/git/trees/${cm.tree.sha}?recursive=1`);
  const contentEntry = (baseFull.tree || []).find((e) => e.path === 'feihua-content.json');
  console.log('当前 main:', parentSha, '| 保留 feihua-content.json:', contentEntry ? contentEntry.sha : '(未找到)');
  // 排行榜数据文件 leaderboard.json：玩家提交创建，部署时需保留，否则会被整树替换清空玩家成绩
  const lbEntry = (baseFull.tree || []).find((e) => e.path === 'leaderboard.json');

  // 2) 上传全部静态文件
  const files = walk(ROOT).sort();
  console.log('待上传文件:', files.length);
  const blobs = {};
  for (const rel of files) {
    const buf = readFileSync(join(ROOT, rel));
    const ext = rel.slice(rel.lastIndexOf('.'));
    const isText = TEXT.has(ext);
    const content = isText ? buf.toString('utf-8') : buf.toString('base64');
    const r = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content, encoding: isText ? 'utf-8' : 'base64' });
    blobs[rel] = r.sha;
    process.stdout.write('.');
  }
  console.log('\nblob 完成');

  // 3) 组装 tree（静态文件 + 同步的工程文件）
  const tree = files.map((rel) => ({ path: rel, mode: '100644', type: 'blob', sha: blobs[rel] }));

  // 3.0) 根目录工程文件存在时必须覆盖上传。玩家启动时 cloud.json 会拉取它，
  // 因此不能仅部署 config/board.json，否则远端旧 board 会再次整体覆盖本地棋盘。
  if (existsSync(PROJECT_CONTENT)) {
    const projectBlob = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, {
      content: readFileSync(PROJECT_CONTENT, 'utf8'), encoding: 'utf-8'
    });
    blobs['feihua-content.json'] = projectBlob.sha;
    console.log('已同步工作区根 feihua-content.json（与静态游戏同一提交）');
  }

  // 3.1) 若设了 LB_WORKER_URL，则用 cf 配置（无 token）覆盖 config/leaderboard.json，
  //      使 GitHub Pages 这种公开静态站也能安全联网上榜，且前端不持有任何 token。
  //      本地 / CloudStudio 仍使用 github+token 配置，不受影响、不回归。
  const LB_WORKER_URL = process.env.LB_WORKER_URL;
  if (LB_WORKER_URL) {
    const cfCfg = JSON.stringify({ backend: 'cf', workerUrl: LB_WORKER_URL }, null, 2);
    const cfBlob = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content: cfCfg, encoding: 'utf-8' });
    blobs['config/leaderboard.json'] = cfBlob.sha;
    console.log('已用 cf 配置覆盖 config/leaderboard.json（Worker:', LB_WORKER_URL, '）— GitHub Pages 部署不含 token');
  }

  if (blobs['feihua-content.json']) {
    tree.push({ path: 'feihua-content.json', mode: '100644', type: 'blob', sha: blobs['feihua-content.json'] });
  } else if (contentEntry) {
    tree.push({ path: 'feihua-content.json', mode: '100644', type: 'blob', sha: contentEntry.sha });
    console.log('已保留远端 feihua-content.json（本地工程文件不存在）');
  }
  if (lbEntry && !blobs['leaderboard.json']) {
    tree.push({ path: 'leaderboard.json', mode: '100644', type: 'blob', sha: lbEntry.sha });
    console.log('已保留 leaderboard.json（不清空玩家成绩）');
  } else if (!lbEntry && !blobs['leaderboard.json']) {
    // 首次部署：在树里创建一个空榜单文件，使读取接口立即可用
    const empty = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content: '[]', encoding: 'utf-8' });
    tree.push({ path: 'leaderboard.json', mode: '100644', type: 'blob', sha: empty.sha });
    console.log('已新建空 leaderboard.json');
  }
  // 保留 feihua-editors/ 子树：编辑器与游戏同仓部署在 main，游戏拍平部署若不保留会误删线上编辑器页面。
  // 仅当 base 树含该子树且当前游戏树未覆盖时才补回，绝不覆盖游戏文件。
  for (const e of (baseFull.tree || [])) {
    if (e.path.startsWith('feihua-editors/') && !tree.find((t) => t.path === e.path)) {
      tree.push({ path: e.path, mode: e.mode, type: e.type, sha: e.sha });
    }
  }
  console.log('已保留 feihua-editors/ 子树（', (baseFull.tree || []).filter((e) => e.path.startsWith('feihua-editors/')).length, '个文件）');

  const treeRes = await api('POST', `/repos/${OWNER}/${REPO}/git/trees`, { tree });
  console.log('tree:', treeRes.sha);

  const commit = await api('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
    message: 'feihuaqi playable: 桃花岛·飞花棋 完整部署（含字体 + 保留云端同步文件）',
    tree: treeRes.sha, parents: [parentSha],
  });
  console.log('commit:', commit.sha);

  await api('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/main`, { sha: commit.sha });
  console.log('main 已更新为完整部署');
}

main().then(() => console.log('DONE')).catch((e) => { console.error('ERR', e.message); process.exit(1); });
