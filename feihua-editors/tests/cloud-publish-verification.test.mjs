import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const editorRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const common = readFileSync(join(editorRoot, 'assets/js/common.js'), 'utf8');

assert.ok(common.includes('const expectedProject = global.CloudSync.buildProject();'),
  '发布前固定完整工程快照，保证回读比较的是本次编辑内容');
assert.ok(common.includes('const verifyUrl = cacheBust(published.verifyUrl || url);'),
  '发布后优先从不可变 revision 地址回读，并绕过缓存');
assert.ok(common.includes('const verifyRes = await fetch(verifyUrl, { cache: "no-store" });'),
  '发布后回读使用 no-store');
assert.ok(common.includes('const diff = projectDiffKeys(expectedProject, remoteProject);'),
  '发布后逐模块校验完整工程，而非只检查传世名篇');
assert.ok(common.includes('const result = applyCloudProject(data);'),
  '云端拉取使用可回滚的完整替换入口');
assert.equal(common.includes('拉取模式：'), false, '云端同步不再提供容易造成跨入口分叉的合并模式');

console.log('cloud-publish-verification.test.mjs: 发布完整回读与拉取原子替换校验已接入');
