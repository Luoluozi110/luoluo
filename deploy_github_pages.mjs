// 幂等 GitHub Pages 部署：若 main 已存在则更新，否则创建；best-effort 启用 Pages。
// 用法：TOKEN="$(cat /tmp/ghtok)" node deploy_github_pages.mjs
// 注意：脚本绝不打印 TOKEN 本身。
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import https from 'https';

const TOKEN = process.env.TOKEN;
const OWNER = 'Luoluozi110';
const REPO = 'luoluo';
const WORKSPACE = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25';
const ROOT = WORKSPACE + '/feihuaqi-playable';
const CONTENT_FILE = WORKSPACE + '/feihua-content.json';

const TEXT = new Set(['.html', '.css', '.js', '.json', '.md']);

function walk(dir, base = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === '.git') continue;
    const full = join(dir, name);
    const rel = base ? base + '/' + name : name;
    const st = statSync(full);
    if (st.isDirectory()) {
      if (rel === 'fonts') continue; // 字体单独部署，避免体积过大
      out.push(...walk(full, rel));
    } else {
      if (rel.endsWith('school-preview.html')) continue; // 本地预览页，不上线
      out.push(rel);
    }
  }
  return out;
}

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: 'api.github.com', path, method,
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
  // 1) 校验 token
  try {
    const me = await req('GET', '/user');
    console.log('token 校验通过，登录用户:', me.login);
  } catch (e) {
    console.error('token 校验失败（无效/无权限/网络）:', e.message);
    process.exit(2);
  }

  const files = walk(ROOT).sort();
  console.log('上传文件数:', files.length, '(不含字体)');
  const blobs = {};
  for (const rel of files) {
    const full = join(ROOT, rel);
    const buf = readFileSync(full);
    const ext = rel.slice(rel.lastIndexOf('.'));
    const isText = TEXT.has(ext);
    const content = isText ? buf.toString('utf-8') : buf.toString('base64');
    const r = await req('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content, encoding: isText ? 'utf-8' : 'base64' });
    blobs[rel] = r.sha;
    process.stdout.write('.');
  }
  console.log('\nblob 完成');

  // 同步内容工程：随构建显式上传，避免云端旧 talents/npcs 覆盖本地新值。
  const contentText = readFileSync(CONTENT_FILE, 'utf-8');
  const contentBlob = await req('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content: contentText, encoding: 'utf-8' });
  blobs['feihua-content.json'] = contentBlob.sha;

  // 2) main 是否已存在；若存在，以当前 tree 作为 base_tree 增量更新，保留字体/根数据文件。
  let parentSha = null, parentTreeSha = null, exists = false;
  try {
    const ref = await req('GET', `/repos/${OWNER}/${REPO}/git/refs/heads/main`);
    parentSha = ref.object.sha; exists = true;
    const parent = await req('GET', `/repos/${OWNER}/${REPO}/git/commits/${parentSha}`);
    parentTreeSha = parent.tree.sha;
    console.log('main 已存在，将增量更新。parent =', parentSha);
  } catch (e) {
    console.log('main 不存在，将创建新分支。');
  }

  const tree = files.map((rel) => ({ path: rel, mode: '100644', type: 'blob', sha: blobs[rel] }));
  tree.push({ path: 'feihua-content.json', mode: '100644', type: 'blob', sha: blobs['feihua-content.json'] });
  const treeBody = parentTreeSha ? { base_tree: parentTreeSha, tree } : { tree };
  const treeRes = await req('POST', `/repos/${OWNER}/${REPO}/git/trees`, treeBody);
  console.log('tree sha:', treeRes.sha, '| 已保留未触及路径并更新 feihua-content.json');

  const commit = await req('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
    message: 'feihuaqi: 加入流派熟练度机制，每流派永久养成、等级影响初始属性与流派特效',
    tree: treeRes.sha,
    parents: parentSha ? [parentSha] : [],
  });
  console.log('commit sha:', commit.sha);

  if (exists) {
    await req('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/main`, { sha: commit.sha });
    console.log('已更新 main');
  } else {
    await req('POST', `/repos/${OWNER}/${REPO}/git/refs`, { ref: 'refs/heads/main', sha: commit.sha });
    console.log('已创建 main');
  }

  // 3) 启用 Pages（best-effort，需 pages 权限）
  try {
    const p = await req('GET', `/repos/${OWNER}/${REPO}/pages`);
    console.log('Pages 已启用:', p.html_url);
  } catch (e) {
    try {
      const p = await req('POST', `/repos/${OWNER}/${REPO}/pages`, { source: { branch: 'main', path: '/' } });
      console.log('已启用 Pages:', p.html_url);
    } catch (e2) {
      console.log('Pages 启用未成功（token 可能无 pages:write 权限或仓库未就绪）：', e2.message);
      console.log('请到仓库 Settings → Pages → Source 选 main 分支 /(root) 手动启用。');
    }
  }
  console.log('站点预期地址: https://' + OWNER + '.github.io/' + REPO + '/');
}

main().then(() => console.log('DONE')).catch((e) => { console.error('ERR', e.message); process.exit(1); });
