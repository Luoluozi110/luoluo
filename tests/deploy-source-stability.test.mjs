// deploy-source-stability.test.mjs —— 完整部署必须拒绝新旧文件混合与并发覆盖
import assert from 'node:assert/strict';
import fs from 'node:fs';

const deploy = fs.readFileSync(new URL('../deploy_github2.mjs', import.meta.url), 'utf8');

assert.match(deploy, /const sourceSnapshot = new Map\(files\.map\(\(rel\) => \[rel, readFileSync\(join\(ROOT, rel\)\)\]\)\)/,
  '发布开始时必须冻结完整源文件快照');
assert.match(deploy, /const buf = sourceSnapshot\.get\(rel\)/,
  '全部上传内容必须来自同一份快照');
assert.match(deploy, /assertSourceUnchanged\(files, sourceSnapshot\)/,
  '更新 main 前必须验证工作区在上传期间未变化');
assert.match(deploy, /latestRef\.object\.sha !== parentSha/,
  '更新 main 前必须拒绝远端并发更新');
assert.ok(deploy.indexOf('assertSourceUnchanged(files, sourceSnapshot)') < deploy.indexOf("await api('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/main`"),
  '源文件稳定性检查必须发生在 main 更新之前');

console.log('deploy-source-stability.test.mjs: 源文件快照与远端并发保护全部通过');
