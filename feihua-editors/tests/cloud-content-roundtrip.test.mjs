import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { JSDOM } = require('C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom');
const editorRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = join(editorRoot, '..');
let html = readFileSync(join(editorRoot, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (tag, src) =>
  `<script>\n${readFileSync(join(editorRoot, src.split('?')[0]), 'utf8')}\n</script>`);

const dom = new JSDOM(html, {
  url: 'https://luoluozi110.github.io/luoluo/feihua-editors/',
  runScripts: 'dangerously',
  pretendToBeVisual: true
});
const { window } = dom;
await new Promise(resolve => {
  if (window.document.readyState !== 'loading') return resolve();
  window.addEventListener('DOMContentLoaded', resolve, { once: true });
});

const cloudProject = JSON.parse(readFileSync(join(workspaceRoot, 'feihua-content.json'), 'utf8'));

assert.doesNotThrow(
  () => window.Common.applyCloudProject(cloudProject),
  '仓库根目录的云端工程必须能被当前编辑器无损拉取'
);

const applied = window.Common.buildProject(cloudProject._version);
assert.deepEqual(
  Array.from(window.Common.projectDiffKeys(cloudProject, applied)),
  [],
  '云端工程经过编辑器导入/导出后不得改写任何模块'
);

console.log('cloud-content-roundtrip.test.mjs: 当前云端工程无损拉取通过');
