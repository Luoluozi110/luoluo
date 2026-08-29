import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { JSDOM } = require('C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom');
const editorRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
let html = readFileSync(join(editorRoot, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (tag, src) =>
  `<script>\n${readFileSync(join(editorRoot, src.split('?')[0]), 'utf8')}\n</script>`);

const dom = new JSDOM(html, {
  url: 'https://entry-a.example/feihua-editors/',
  runScripts: 'dangerously',
  pretendToBeVisual: true
});
const { window } = dom;
await new Promise(resolve => {
  if (window.document.readyState !== 'loading') return resolve();
  window.addEventListener('DOMContentLoaded', resolve, { once: true });
});

const clone = value => JSON.parse(JSON.stringify(value));
const baseline = window.Common.buildProject();

// 不同网页入口 localStorage 互不相通，必须能从部署的 raw 地址恢复同一发布目标。
assert.deepEqual(
  JSON.parse(JSON.stringify(window.CloudSync.settingsFromUrl('https://raw.githubusercontent.com/Luoluozi110/luoluo/main/feihua-content.json'))),
  {
    mode: 'repo', owner: 'Luoluozi110', repo: 'luoluo', repoRaw: 'Luoluozi110/luoluo',
    branch: 'main', path: 'feihua-content.json',
    url: 'https://raw.githubusercontent.com/Luoluozi110/luoluo/main/feihua-content.json'
  }
);

// 任一模块未初始化时必须阻止发布，不能把缺失模块静默序列化为空数组。
window.SKY._ready = false;
assert.throws(() => window.Common.buildProject(), /阻止导出\/发布残缺工程：天象/);
window.SKY._ready = true;

// 云端同步固定为替换：本入口独有的旧条目必须被删除，应用后与云端逐模块全等。
const remote = clone(baseline);
remote.questions[0].scenario = '云端唯一来源：两个网页入口都应读取这一句。';
const localQuestions = clone(remote.questions);
localQuestions.push({ ...clone(localQuestions[0]), id: 'Q_LOCAL_ONLY' });
window.QB.importData(localQuestions, true);
const result = window.Common.applyCloudProject(remote);
assert.equal(window.QB.get().some(question => question.id === 'Q_LOCAL_ONLY'), false);
assert.equal(window.QB.get()[0].scenario, remote.questions[0].scenario);
assert.equal(window.Common.projectDiffKeys(remote, result.project).length, 0);
assert.equal(result.fingerprint, window.Common.projectFingerprint(remote));

// 模拟某模块在导入时被当前页面版本二次改写：同步必须失败，并恢复同步前快照。
const beforeFailure = window.Common.buildProject();
const incompatible = clone(beforeFailure);
incompatible.events[0].name += '（云端版）';
const originalImport = window.TALENT.importData;
let injectOnce = true;
window.TALENT.importData = (items, replace) => {
  originalImport(items, replace);
  if (injectOnce) {
    injectOnce = false;
    window.TALENT.get()[0].name += '（页面私自改写）';
  }
};
assert.throws(() => window.Common.applyCloudProject(incompatible), /当前编辑器版本会改写这些云端模块：文心/);
window.TALENT.importData = originalImport;
assert.equal(window.Common.projectDiffKeys(beforeFailure, window.Common.buildProject()).length, 0);

console.log('cloud-sync-integrity.test.mjs: 跨入口目标发现、完整替换、逐模块核验与失败回滚通过');
