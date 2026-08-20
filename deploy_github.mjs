// 通过 GitHub Git Database API 直接建提交（绕过 git push，因本机 git HTTPS 传输被重置）。
// 用法：node deploy_github.mjs            —— 部署除 fonts 外的全部文件（首提交）
//       node deploy_github.mjs fonts      —— 在已有 main 上追加提交，仅上传 fonts
import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import https from 'https';

const TOKEN = process.env.TOKEN;
const OWNER = 'Luoluozi110';
const REPO = 'luoluo';
const ROOT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/feihuaqi-playable';
const FONTS_ONLY = process.argv[2] === 'fonts';

const TEXT_EXT = new Set(['.html', '.css', '.js', '.json', '.md', '.txt', '.woff2'.replace('woff2', 'x')]);
// 文本类（按 utf-8 上传）；其余按 base64
const TEXT = new Set(['.html', '.css', '.js', '.json', '.md']);

function walk(dir, base = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === '.git') continue;
    const full = join(dir, name);
    const rel = base ? base + '/' + name : name;
    const st = statSync(full);
    if (st.isDirectory()) {
      if (FONTS_ONLY && rel !== 'fonts') continue;
      if (!FONTS_ONLY && rel === 'fonts') continue;
      out.push(...walk(full, rel));
    } else {
      if (FONTS_ONLY && !rel.startsWith('fonts/')) continue;
      if (!FONTS_ONLY && rel.startsWith('fonts/')) continue;
      out.push(rel);
    }
  }
  return out;
}

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
  const files = walk(ROOT).sort();
  console.log('上传文件数:', files.length, FONTS_ONLY ? '(仅字体)' : '(不含字体)');
  const blobs = {};
  for (const rel of files) {
    const full = join(ROOT, rel);
    const buf = readFileSync(full);
    const ext = rel.slice(rel.lastIndexOf('.'));
    const isText = TEXT.has(ext);
    const encoding = isText ? 'utf-8' : 'base64';
    const content = isText ? buf.toString('utf-8') : buf.toString('base64');
    const r = await req('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content, encoding });
    blobs[rel] = r.sha;
    process.stdout.write('.');
  }
  console.log('\nblob 完成');

  const tree = files.map((rel) => ({ path: rel, mode: '100644', type: 'blob', sha: blobs[rel] }));
  const treeRes = await req('POST', `/repos/${OWNER}/${REPO}/git/trees`, { tree });
  console.log('tree sha:', treeRes.sha);

  // main 始终存在：以当前 main 为父节点，PATCH 前进（不再造孤儿提交）
  const ref = await req('GET', `/repos/${OWNER}/${REPO}/git/refs/heads/main`);
  const parentSha = ref.object.sha;
  const MSG = process.argv[3] || (FONTS_ONLY ? 'feihuaqi: 补充自托管字体（Noto Serif SC）' : 'feihuaqi playable: 桃花岛·飞花棋 部署版');
  const commit = await req('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
    message: MSG,
    tree: treeRes.sha,
    parents: parentSha ? [parentSha] : [],
  });
  console.log('commit sha:', commit.sha);

  await req('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/main`, { sha: commit.sha });
  console.log('已更新 main (父提交=' + parentSha + ')');
}

main().then(() => console.log('DONE')).catch((e) => { console.error('ERR', e.message); process.exit(1); });
