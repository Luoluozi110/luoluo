import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { JSDOM } = require('C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom');
const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', '..', 'qbank-editor', 'index.html'), 'utf8');
const original = {
  id: 'QFLEX', type: 'knowledge', stem: '测试题干',
  scenario: '夜雨敲窗，你与友人围炉谈诗。友人忽然举出一句旧作，请你辨明它真正的作者。',
  options: ['甲', '乙'], optionActs: ['答他此句应是甲所作', '答他此句应是乙所作'], answer: 0,
  difficulty: 2, category: 'shi', tendency: '', analysis: '测试解析', enabled: true
};

const dom = new JSDOM(html, {
  url: 'https://standalone-editor.local/', runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(window) {
    window.localStorage.setItem('feihuaqi_qbank_v1', JSON.stringify([original]));
  }
});
const { window } = dom;
const { document } = window;
await new Promise(resolve => {
  if (document.readyState !== 'loading') return resolve();
  window.addEventListener('DOMContentLoaded', resolve, { once: true });
});

const fire = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }));
const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

assert.equal(window.QB.get()[0].scenario, original.scenario, '独立版读取 scenario');
assert.deepEqual([...window.QB.get()[0].optionActs], original.optionActs, '独立版读取 optionActs');
assert.equal(window.QB.get().filter(q => /^Q013[0-9]$/.test(q.id)).length, 10,
  '旧版独立编辑器缓存会安全补入 10 道新发布题目');
click(document.querySelector('#qlist [data-edit="0"]'));
assert.equal(document.getElementById('ed-scenario').value, original.scenario, '情境预填');
assert.equal(document.querySelectorAll('#ed-options .opt-act').length, 2, '行动文案输入框数量正确');

const changed = '江边暮色渐深，你与同行士子谈到古人的名句。他停下脚步，请你从两个答案中作出判断。';
const scenario = document.getElementById('ed-scenario');
scenario.value = changed; fire(scenario, 'input');
const act = document.querySelector('#ed-options .opt-act');
act.value = '从容答他应当选择甲'; fire(act, 'input');
click(document.getElementById('ed-addopt'));
assert.equal(document.getElementById('ed-scenario').value, changed, '增项后情境不丢失');
assert.equal(document.querySelector('#ed-options .opt-act').value, '从容答他应当选择甲', '增项后行动文案不丢失');
click(document.querySelector('#ed-options [data-delopt="2"]'));
click(document.getElementById('edSave'));

assert.equal(window.QB.get()[0].scenario, changed, '独立版保存 scenario');
assert.equal(window.QB.get()[0].optionActs[0], '从容答他应当选择甲', '独立版保存 optionActs');
assert.equal(window.QB.validateAll().length, 0, '保存结果通过题库校验');

window.QB.add({
  id: 'QCHOICE', type: 'choice', stem: '选择', scenario: changed,
  optionActs: ['不应保留一', '不应保留二'],
  options: [{ text: '其一', attr: null }, { text: '其二', attr: null }],
  difficulty: 1, category: 'shi', analysis: '', enabled: true
});
const choice = window.QB.get().find(q => q.id === 'QCHOICE');
assert.equal(choice.scenario, undefined, '抉择题不泄漏 scenario');
assert.equal(choice.optionActs, undefined, '抉择题不泄漏 optionActs');

dom.window.close();
console.log('独立版题库编辑器：柔性字段读取、动态编辑、保存与题型隔离全部通过');
