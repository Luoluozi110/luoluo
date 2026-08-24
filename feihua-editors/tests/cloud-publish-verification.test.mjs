import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const editorRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const common = readFileSync(join(editorRoot, 'assets/js/common.js'), 'utf8');
const cloud = readFileSync(join(editorRoot, 'assets/js/cloud.js'), 'utf8');

assert.ok(common.includes('const expectedProject = global.CloudSync.buildProject();'),
  '发布前固定完整工程快照，保证回读比较的是本次编辑内容');
assert.ok(common.includes('const verifyUrl = url + (url.includes("?") ? "&" : "?") + "_wb=" + Date.now();'),
  '发布后回读使用时间戳 URL，绕过 Raw/CDN 旧响应');
assert.ok(common.includes('const verifyRes = await fetch(verifyUrl, { cache: "no-store" });'),
  '发布后回读使用 no-store');
assert.ok(common.includes('JSON.stringify(remoteProject.album || []) !== JSON.stringify(expectedProject.album || [])'),
  '发布后校验传世名篇内容与编辑器快照一致');
assert.ok(cloud.includes('GitHub Token 无效、已过期或已被撤销'),
  '401 响应明确提示更换无效或过期的 GitHub Token');

console.log('cloud-publish-verification.test.mjs: 发布后回读与名篇一致性校验已接入');
