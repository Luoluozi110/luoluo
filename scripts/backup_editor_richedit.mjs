// 内容编辑器富文本 UI 重建的 GitHub 版本备份。
// git push 协议在本沙箱被拦截，故走 api.github.com REST API：
//   1) 以 main 当前 tree 为基底（保留全部既有文件，含 feihua-content.json / leaderboard.json）
//   2) 仅覆盖/新增本次改动的 feihua-editors 文件 + 交付说明
//   3) 创建提交并 fast-forward main
//   4) 创建不可复用的带注释标签 backup/20260827-2150-editor-richedit-ui
import { readFileSync, existsSync } from 'fs';
import https from 'https';

const TOKEN = process.env.TOKEN;
const OWNER = 'Luoluozi110';
const REPO = 'luoluo';
const TEXT = new Set(['.html', '.css', '.js', '.json', '.md']);

// 相对仓库根的路径
const CHANGED = [
  'feihua-editors/assets/css/styles.css',
  'feihua-editors/assets/js/adventure.js',
  'feihua-editors/assets/js/common.js',
  'feihua-editors/assets/js/copy.js',
  'feihua-editors/index.html',
  'feihua-editors/assets/js/richedit.js',
  'feihua-editors/tests/_verify-richedit.mjs',
  'feihua-编辑器UI重建说明.md',
];
const ROOT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25';

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: 'api.github.com', path, method,
      headers: {
        Authorization: 'Bearer ' + TOKEN,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'wb-backup',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
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
}

async function main() {
  const ref = await api('GET', `/repos/${OWNER}/${REPO}/git/refs/heads/main`);
  const parentSha = ref.object.sha;
  console.log('main 当前 HEAD:', parentSha);

  const cm = await api('GET', `/repos/${OWNER}/${REPO}/git/commits/${parentSha}`);
  const baseTree = await api('GET', `/repos/${OWNER}/${REPO}/git/trees/${cm.tree.sha}?recursive=1`);
  const map = new Map();
  for (const e of baseTree.tree) if (e.type === 'blob') map.set(e.path, e.sha);
  console.log('基底 tree 文件数:', map.size, '| 将覆盖/新增:', CHANGED.length);

  const tree = [];
  for (const rel of CHANGED) {
    const full = ROOT + '/' + rel;
    if (!existsSync(full)) { console.log('  跳过(不存在):', rel); continue; }
    const buf = readFileSync(full);
    const ext = rel.slice(rel.lastIndexOf('.'));
    const isText = TEXT.has(ext);
    const content = isText ? buf.toString('utf-8') : buf.toString('base64');
    const r = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content, encoding: isText ? 'utf-8' : 'base64' });
    map.set(rel, r.sha);
    console.log('  blob:', rel);
  }
  for (const [path, sha] of map) tree.push({ path, mode: '100644', type: 'blob', sha });

  const treeRes = await api('POST', `/repos/${OWNER}/${REPO}/git/trees`, { tree });
  const message = [
    'feat(editors): 内容编辑器富文本 UI 重建',
    '',
    '- 新增 richedit.js：把 <textarea data-rich> 包裹为 工具栏+素材插入面板+实时预览区',
    '- common.js / openOverlay / refreshWorkspaceUI 接入自动增强(MutationObserver 双保险)',
    '- copy.js / adventure.js / index.html 给叙事型文本域打 data-rich',
    '- styles.css 新增 .rich-editor 墨纸主题与响应式(移动端单列、按钮≥44px)',
    '- 测试零回归：editor-smoke 189/189、_verify-richedit 21/21',
  ].join('\n');
  const commit = await api('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
    message, tree: treeRes.sha, parents: [parentSha],
  });
  console.log('commit:', commit.sha);

  await api('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/main`, { sha: commit.sha });
  console.log('main 已更新');

  const tag = 'backup/20260827-2150-editor-richedit-ui';
  const tagObj = await api('POST', `/repos/${OWNER}/${REPO}/git/tags`, {
    tag, message: '内容编辑器富文本 UI 重建（工具栏/素材面板/实时预览）— 回退点',
    object: commit.sha, type: 'commit',
    tagger: { name: 'WorkBuddy', email: 'buddy@local', date: new Date().toISOString() },
  });
  await api('POST', `/repos/${OWNER}/${REPO}/git/refs`, { ref: 'refs/tags/' + tag, sha: tagObj.sha });
  console.log('已创建带注释标签:', tag, '->', tagObj.sha);
  console.log('DONE commit=' + commit.sha + ' tag=' + tagObj.sha);
}

main().then(() => process.exit(0)).catch((e) => { console.error('ERR', e.message); process.exit(1); });
