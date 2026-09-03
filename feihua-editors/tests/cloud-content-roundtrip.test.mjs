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

const incomingNpc = cloudProject.npcs.flatMap(tier => tier.npcs || []).find(npc => npc.difficultyRole);
const appliedNpc = applied.npcs.flatMap(tier => tier.npcs || []).find(npc => npc.id === incomingNpc.id);
assert.deepEqual(
  {
    difficultyRole: appliedNpc.difficultyRole,
    beginnerWeight: appliedNpc.beginnerWeight,
    standardWeight: appliedNpc.standardWeight
  },
  {
    difficultyRole: incomingNpc.difficultyRole,
    beginnerWeight: incomingNpc.beginnerWeight,
    standardWeight: incomingNpc.standardWeight
  },
  'NPC 入门难度角色及双模式权重必须无损往返'
);

// 浏览器可能曾发布/拉取过更高版本；显式从云端拉取时，云端版本必须覆盖本地游标。
window.Common.markCurrentDataVersion(cloudProject._version + 7);
assert.equal(window.Common.buildProject()._version, cloudProject._version + 7, '测试前本地版本游标高于云端');
const lowered = window.Common.applyCloudProject(cloudProject);
assert.equal(lowered.project._version, cloudProject._version, '拉取结果必须严格采用云端版本');
assert.equal(window.Common.localDataVersion(), cloudProject._version, '成功拉取后本地版本游标必须回落到云端版本');

console.log('cloud-content-roundtrip.test.mjs: 当前云端工程无损拉取通过');
