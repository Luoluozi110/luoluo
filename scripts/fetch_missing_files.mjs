// 取回「仅 main 有、本地缺失」的文件（他方新增，本地从未有过）。
// leaderboard.json 除外——它是玩家成绩，部署时须保留线上数据，不能由本地覆盖。
import { readFileSync, writeFileSync } from 'node:fs';
import https from 'node:https';

const TOKEN = process.env.TOKEN;
const OWNER = 'Luoluozi110';
const REPO = 'luoluo';
const ROOT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/';

const WANT = [
  'config/sidequest-npcs.json',
  'tests/sidequest-ui-wiring.test.mjs',
  'feihua-editors/assets/js/seed-sidequests.js',
  'feihua-editors/tests/sidequest-content-sync.test.mjs',
];
const SKIP = ['leaderboard.json']; // 玩家成绩，部署时保留线上版本

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: 'api.github.com', path, method,
      headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'wb-fetch', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
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
  const cm = await api('GET', `/repos/${OWNER}/${REPO}/git/commits/${ref.object.sha}`);
  const tree = await api('GET', `/repos/${OWNER}/${REPO}/git/trees/${cm.tree.sha}?recursive=1`);
  const map = new Map((tree.tree || []).filter((e) => e.type === 'blob').map((e) => [e.path, e.sha]));

  for (const p of WANT) {
    const sha = map.get(p);
    if (!sha) { console.log('[main 上不存在，跳过] ' + p); continue; }
    const b = await api('GET', `/repos/${OWNER}/${REPO}/git/blobs/${sha}`);
    const buf = Buffer.from(b.content, b.encoding === 'base64' ? 'base64' : 'utf-8');
    // 远端路径 -> 本地路径
    const local = p.startsWith('feihua-editors/')
      ? ROOT + p
      : ROOT + 'feihuaqi-playable/' + p;
    writeFileSync(local, buf);
    console.log(`[已取回] ${p}  (${buf.length}B) -> ${local}`);
  }
  console.log('\n[保留线上、不从本地覆盖] ' + SKIP.join(', '));
}
main().then(() => process.exit(0)).catch((e) => { console.error('ERR', e.message); process.exit(1); });
