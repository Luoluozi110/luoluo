// 备份推送：把本地提交 4096663 经 REST API 推到 GitHub 新备份分支 + 注释标签。
// 不更新共享分支（远端 codex/wenxin-dice-rework-20260824 已分叉，禁止强推），
// 只新增 codex/backup-<stamp>-editor-contract-fix 分支与 backup/<stamp>-editor-contract-fix 标签。
import { execSync } from 'child_process';
import https from 'https';
import { readFileSync } from 'fs';

const TOKEN = readFileSync(process.env.HOME + '/.workbuddy/gh_token_pages', 'utf8').trim();
const OWNER = 'Luoluozi110';
const REPO = 'luoluo';
const COMMIT = '40966638ee56b8de07cfe7889f0db3aa1678ee67';
const PARENT = '4355d204ffa61dbd6fb69e0eb5751577d288be7d';
const BASE_TREE = 'cf1bb1cc629f4a3920aaae3c349ab5247902b886'; // 4355d20^{tree}
const STAMP = '20260827-2036';
const BRANCH = `codex/backup-${STAMP}-editor-contract-fix`;
const TAG = `backup/${STAMP}-editor-contract-fix`;

async function api(method, path, body) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const r = https.request({
          hostname: 'api.github.com', path, method,
          headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'wb-backup', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
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
    } catch (e) {
      lastErr = e;
      console.log(`  (retry ${attempt}/4) ${e.message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

function run(cmd) { return execSync(cmd, { cwd: 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25', maxBuffer: 64 * 1024 * 1024 }); }

async function main() {
  // 1) 变更文件清单与 (mode, blob sha) 映射
  const raw = run(`git diff-tree -r --no-renames -z --name-only ${PARENT} ${COMMIT}`).toString();
  const paths = raw.split('\0').filter(Boolean);
  console.log('变更文件:', paths.length);
  const ls = run(`git -c core.quotepath=false ls-tree -r ${COMMIT}`).toString();
  const info = new Map();
  for (const line of ls.split('\n')) {
    const m = line.match(/^(\d+) blob ([0-9a-f]+)\t(.+)$/);
    if (m) info.set(m[3], { mode: m[1], sha: m[2] });
  }

  // 2) 上传 blob（统一 base64，保证字节一致）
  const entries = [];
  for (const p of paths) {
    const meta = info.get(p);
    if (!meta) throw new Error('ls-tree 缺少 ' + p);
    const buf = run(`git cat-file blob ${meta.sha}`);
    const r = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content: buf.toString('base64'), encoding: 'base64' });
    entries.push({ path: p, mode: meta.mode, type: 'blob', sha: r.sha });
    console.log('  blob', r.sha.slice(0, 8), p);
  }

  // 3) 建树（base_tree 取远端已有的 4355d20 树）
  const tree = await api('POST', `/repos/${OWNER}/${REPO}/git/trees`, { base_tree: BASE_TREE, tree: entries });
  console.log('新树:', tree.sha);

  // 4) 复刻提交（author/committer/message 与本地完全一致，期望 SHA 相同）
  const commitRaw = run(`git cat-file commit ${COMMIT}`).toString();
  const msg = commitRaw.slice(commitRaw.indexOf('\n\n') + 2);
  const who = { name: 'Luoluozi110', email: '775225929@qq.com', date: '2026-08-27T20:29:59+08:00' };
  const commit = await api('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
    message: msg, tree: tree.sha, parents: [PARENT], author: who, committer: who,
  });
  console.log('远端提交:', commit.sha, commit.sha === COMMIT ? '（与本地 SHA 一致）' : '（与本地不同，内容一致）');

  // 5) 备份分支（新建，不触碰既有引用）
  await api('POST', `/repos/${OWNER}/${REPO}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha: commit.sha });
  console.log('备份分支:', BRANCH);

  // 6) 注释标签
  const tagObj = await api('POST', `/repos/${OWNER}/${REPO}/git/tags`, {
    tag: TAG, message: '编辑器契约双路径加载修复 + Q0122 倾向对齐（编辑器13/13、游戏57/57全绿）', object: commit.sha, type: 'commit', tagger: who,
  });
  await api('POST', `/repos/${OWNER}/${REPO}/git/refs`, { ref: `refs/tags/${TAG}`, sha: tagObj.sha });
  console.log('备份标签:', TAG);
  console.log('完成: commit', commit.sha, '| 分支', BRANCH, '| 标签', TAG);
}

main().catch((e) => { console.error('备份失败:', e.message); process.exit(1); });
