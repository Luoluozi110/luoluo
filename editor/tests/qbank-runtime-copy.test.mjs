import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { JSDOM } = require('C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let html = readFileSync(join(root, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  return `<script>\n${readFileSync(join(root, src), 'utf8')}\n</script>`;
});

const dom = new JSDOM(html, {
  url: 'https://editor-runtime-copy.local/',
  runScripts: 'dangerously',
  pretendToBeVisual: true
});
const { window } = dom;
const { document, localStorage } = window;
await new Promise(resolve => {
  if (document.readyState !== 'loading') return resolve();
  window.addEventListener('DOMContentLoaded', resolve, { once: true });
});

const fire = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }));
const original = JSON.parse(JSON.stringify(window.GAME_QUESTIONS[0]));
const stale = JSON.parse(JSON.stringify(original));
delete stale.scenario;
delete stale.optionActs;
stale.stem = '编辑器保留的题库题干';
window.QB.importData([stale], true);

assert.equal(window.QB.runtimeSyncSummary().stale, 1, '可识别与游戏端不一致的柔性文案');
assert.match(document.getElementById('btnSyncRuntime').textContent, /同步游戏文案（1）/, '同步按钮展示待同步数量');
assert.match(document.querySelector('#qlist .q-runtime-copy').textContent, /编辑器保留的题库题干/, '列表展示回退到题库题干');

const result = window.QB.syncRuntimeCopy();
assert.equal(result.updated, 1, '同步更新一条题目的游戏文案');
assert.equal(window.QB.get()[0].stem, stale.stem, '同步不覆盖题库题干');
assert.equal(window.QB.get()[0].scenario, original.scenario, '同步写入游戏内情境');
assert.deepEqual([...window.QB.get()[0].optionActs], original.optionActs, '同步写入全部行动文案');
assert.equal(window.QB.runtimeSyncSummary().stale, 0, '同步后不再有差异');

document.querySelector('#qlist [data-edit="0"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
assert.equal(document.getElementById('edRuntimeCopyPanel').getAttribute('aria-label'), '游戏内显示文案预览', '预览区有明确的无障碍名称');
assert.equal(document.getElementById('edRuntimeStem').getAttribute('aria-live'), 'polite', '题面预览更新会通知读屏用户');
assert.equal(document.getElementById('edRuntimeStem').textContent, original.scenario, '编辑弹窗预览游戏内题面');
assert.equal(document.querySelectorAll('#edRuntimeOptions li').length, original.options.length, '编辑弹窗预览全部游戏内行动');

const changedScenario = '暮色渐沉，你与同窗在客舟中谈及旧诗，远处钟声穿江而来，正等你作答。';
const scenario = document.getElementById('ed-scenario');
scenario.value = changedScenario;
fire(scenario, 'input');
assert.equal(document.getElementById('edRuntimeStem').textContent, changedScenario, '编辑情境时预览即时更新');

const firstAct = document.querySelector('#ed-options .opt-act');
firstAct.value = '答他此句出自张继笔下';
fire(firstAct, 'input');
assert.match(document.querySelector('#edRuntimeOptions li').textContent, /答他此句出自张继笔下/, '编辑行动文案时预览即时更新');

dom.window.close();
console.log('题库编辑器：游戏内柔性文案同步、列表回退与弹窗预览全部通过');
