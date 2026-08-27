// 一次性精确备份脚本：经 GitHub Git Database API（gh）更新 main 上本次移动端优化涉及的 5 个路径，
// 其余文件原样保留，不重建整棵树、不触碰字体以外的任何内容。
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const OWNER = 'Luoluozi110';
const REPO = 'luoluo';
const ROOT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/feihuaqi-playable';

// 本地文件 -> GitHub 仓库根路径
const UPDATES = [
  ['css/base.css', 'css/base.css'],
  ['index.html', 'index.html'],
  ['js/engine/config.js', 'js/engine/config.js'],
  ['js/ui/app.js', 'js/ui/app.js'],
];
const DELETE = ['fonts/noto-serif-sc/NotoSerifSC-700.woff2'];

function gh(method, path, body) {
  let cmd = `gh api --method ${method} ${JSON.stringify('repos/' + OWNER + '/' + REPO + '/' + path)}`;
  if (body !== undefined) {
    cmd += ` --input -`;
    const out = execSync(cmd, { input: JSON.stringify(body), maxBuffer: 1 << 28 });
    return out.length ? JSON.parse(out.toString('utf-8')) : {};
  }
  const out = execSync(cmd + ' --jq .', { maxBuffer: 1 << 28 });
  return JSON.parse(out.toString('utf-8'));
}

async function main() {
  // 1) 当前 main
  const ref = gh('GET', 'git/refs/heads/main');
  const parentSha = ref.object.sha;
  console.log('main parent:', parentSha);

  // 2) 完整树（保留其余条目）
  const treeRes = gh('GET', 'git/trees/' + parentSha + '?recursive=1');
  if (treeRes.truncated) throw new Error('tree truncated, 需分批处理');
  const entries = treeRes.tree.filter(e => e.type === 'blob');
  const byPath = new Map(entries.map(e => [e.path, e]));

  // 3) 为 4 个变更文件创建 blob
  const newEntries = [];
  for (const [local, ghPath] of UPDATES) {
    const buf = readFileSync(join(ROOT, local));
    const content = buf.toString('utf-8');
    const blob = gh('POST', 'git/blobs', { content, encoding: 'utf-8' });
    newEntries.push({ path: ghPath, mode: '100644', type: 'blob', sha: blob.sha });
    console.log('blob', ghPath, blob.sha.slice(0, 10));
  }

  // 4) 组装新树：保留未变更条目，覆盖已变更，剔除已删除
  const delSet = new Set(DELETE);
  const override = new Map(newEntries.map(e => [e.path, e]));
  const finalTree = [];
  for (const e of entries) {
    if (delSet.has(e.path)) { console.log('delete', e.path); continue; }
    if (override.has(e.path)) { finalTree.push(override.get(e.path)); continue; }
    finalTree.push({ path: e.path, mode: e.mode, type: e.type, sha: e.sha });
  }
  // 确保 4 个覆盖都进了树（理论上都在 entries 中）
  const finalPaths = new Set(finalTree.map(e => e.path));
  for (const e of newEntries) if (!finalPaths.has(e.path)) finalTree.push(e);

  const tree = gh('POST', 'git/trees', { tree: finalTree });
  console.log('new tree:', tree.sha);

  // 5) 提交
  const MSG = 'perf(mobile): 削减首屏体积并解除进局网络阻塞\n\n'
    + '- 字体：移除未使用的 NotoSerifSC-700(4.4MB)，粗体改由 font-synthesis 合成；预加载 400 字重。\n'
    + '- 配置：config.js fetch 由 no-store 改 no-cache，重复访问走 304。\n'
    + '- 云端：fetchCloudConfig 去掉 _cb 缓存击穿并改 no-cache，复用 ETag。\n'
    + '- 进局：waitForCloudBeforeGame 不再硬等云端，弱网不再卡数秒。';
  const commit = gh('POST', 'git/commits', { message: MSG, tree: tree.sha, parents: [parentSha] });
  console.log('new commit:', commit.sha);

  // 6) 前进 main
  gh('PATCH', 'git/refs/heads/main', { sha: commit.sha });
  console.log('main ->', commit.sha);

  // 7) 注释标签
  const tagName = 'backup/20260821-1009-mobile-perf';
  const tagObj = gh('POST', 'git/tags', {
    tag: tagName,
    message: '移动端性能优化：字体减半+配置缓存+进局不阻塞',
    object: commit.sha,
    type: 'commit',
    tagger: { name: 'CodeBuddy Code', email: 'noreply@tencent.com', date: new Date().toISOString() }
  });
  console.log('tag obj:', tagObj.sha);
  gh('POST', 'git/refs', { ref: 'refs/tags/' + tagName, sha: tagObj.sha });
  console.log('tag ref created:', tagName);
  console.log('SHA=' + commit.sha);
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
