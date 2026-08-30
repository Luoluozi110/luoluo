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

assert.equal(window.CloudSync.bridgeApi, 'http://127.0.0.1:8787/api/github',
  'GitHub Pages 正式编辑器必须连接本机回环桥接，不能把 API 请求误发到 Pages 同源');

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

// 云端发布修订号可以高于页面种子版本；拉取后应保持该版本，而不是被 buildProject 固定写回。
const newerRemote = clone(window.Common.buildProject());
newerRemote._version += 3;
const newerResult = window.Common.applyCloudProject(newerRemote);
assert.equal(newerResult.project._version, newerRemote._version);
assert.equal(window.Common.localDataVersion(), newerRemote._version,
  '云端工程应用成功后必须立即推进本地版本游标');
assert.equal(window.Common.buildProject()._version, newerRemote._version,
  '成功拉取/发布后的下一次工程构造必须沿用最新云端修订号');
// 拉取后继续编辑时，发布快照必须从云端版本继续递增，不能卡在旧页面种子版本。
const editedAfterPull = clone(window.Common.buildProject());
editedAfterPull.questions[0].scenario += '（拉取后编辑）';
assert.equal(Math.max(window.Common.localDataVersion(), editedAfterPull._version) + 1, newerRemote._version + 1,
  '拉取后编辑的下一次发布应从云端版本继续递增');

// 兼容旧云端的无损字段：旧版羁绊可能没有 stackMode，云端模块也可能带有编辑器尚未展示的扩展字段。
// 这些差异不应被误判为“当前编辑器会改写模块”，且扩展字段必须随拉取保留。
const compatibleLegacy = clone(window.Common.buildProject());
const explicitDefaultStyle = { fontFamily: '', fontSize: 0, color: '', lineHeight: 0, textAlign: '', textIndent: 0, marginBottom: 0 };
for (const synergy of compatibleLegacy.synergies) {
  for (const effect of synergy.effects) delete effect.stackMode;
}
for (const upgrade of Object.values(compatibleLegacy['talent-upgrade'])) {
  for (const level of upgrade.levels) level.style = clone(explicitDefaultStyle);
}
compatibleLegacy.synergies[0].cloudNote = '云端羁绊扩展字段';
const upgradeId = Object.keys(compatibleLegacy['talent-upgrade'])[0];
compatibleLegacy['talent-upgrade'][upgradeId].cloudNote = '云端升级扩展字段';
if (compatibleLegacy['talent-upgrade'][upgradeId].levels[1]) {
  compatibleLegacy['talent-upgrade'][upgradeId].levels[1].cloudNote = '云端等级扩展字段';
}
const compatibleResult = window.Common.applyCloudProject(compatibleLegacy);
assert.equal(window.Common.projectDiffKeys(compatibleLegacy, compatibleResult.project).length, 0,
  '旧版缺省字段与编辑器未知扩展字段不应阻断云端拉取');
assert.equal(compatibleResult.project.synergies[0].cloudNote, '云端羁绊扩展字段');
assert.equal(compatibleResult.project['talent-upgrade'][upgradeId].cloudNote, '云端升级扩展字段');
assert.equal(compatibleResult.project['talent-upgrade'][upgradeId].levels[1].cloudNote, '云端等级扩展字段');

const changedSidequest = clone(newerRemote);
changedSidequest.sidequests.routes[0].name += '（不同步）';
assert.ok(window.Common.projectDiffKeys(newerRemote, changedSidequest).includes('sidequests'),
  '完整工程核验必须覆盖支线路线，不能静默漏检游戏端配置块');

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
