/* 验证 adventure.js 能从旧版 41/42 条缓存增补到 62 条官方奇遇，且保留用户编辑。
 * 跟随 editor-smoke.mjs 模式：载入真实 index.html，在 DOMContentLoaded 前注入旧 localStorage。 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const { JSDOM } = require('C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let html = readFileSync(join(root, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const code = readFileSync(join(root, src.split('?')[0]), 'utf8');
  return `<script>\n${code}\n</script>`;
});

const dom = new JSDOM(html, {
  url: 'https://editor.local/',
  runScripts: 'dangerously',
  pretendToBeVisual: true
});
const { window } = dom;
const { document, localStorage } = window;

// 在 DOMContentLoaded 触发前注入旧 localStorage；OLD_EVENT_COUNT=42 可验证上一版缓存。
// 必须用内联 seed 解析后的数据来构造，因为脚本此刻尚未执行。
const seedEvSrc = readFileSync(join(root, 'assets/js/seed-events.js'), 'utf8');
const mEv = seedEvSrc.match(/window\.GAME_EVENTS\s*=\s*(\[[\s\S]*\]);?\s*\n?$/);
const SEED_EVENTS = eval('(' + mEv[1] + ')');
const oldCount = Number(process.env.OLD_EVENT_COUNT || 41);
const stale = SEED_EVENTS.filter(e => Number(e.id.slice(1)) <= oldCount).map(e => {
  const copy = JSON.parse(JSON.stringify(e));
  if (copy.kind === 'direct') delete copy.resultText;
  if (copy.kind === 'choice') (copy.choices || []).forEach(c => delete c.resultText);
  if (copy.kind === 'challenge') { delete copy.challenge.winText; delete copy.challenge.failText; }
  return copy;
});
stale[0].name = '用户保留的奇遇名称';
stale[0].resultText = '用户自己编写的结算回声';
const custom = { id: 'LOCAL_EVENT', name: '自建奇遇', rarity: 'common', kind: 'direct', text: '用户原创', effect: { inspiration: 2 }, resultText: '自建回声' };
stale.push(custom);
localStorage.setItem('feihua_editors_v1_events', JSON.stringify(stale));

await new Promise(resolve => {
  if (document.readyState !== 'loading') return resolve();
  window.addEventListener('DOMContentLoaded', resolve, { once: true });
});

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra != null ? `（${extra}）` : '')); }
}

console.log('模拟旧 localStorage：' + oldCount + ' 条官方奇遇及 1 条用户自建');
const events = window.ADV ? window.ADV.get() : [];
ok(events.length === 63, 'loadData 后保留 62 条官方奇遇及 1 条自建', events.length);
ok(events.find(e => e.id === 'E001').name === stale[0].name, '不覆盖已有名称');
ok(events.find(e => e.id === 'E001').resultText === stale[0].resultText, '不覆盖已有结算回声');
ok(JSON.stringify(events.find(e => e.id === 'LOCAL_EVENT')) === JSON.stringify(custom), '完整保留自建奇遇');
ok(SEED_EVENTS.slice(42).every(e => events.some(v => v.id === e.id)), 'E043—E062 全部回填');
ok(events.some(e => e.id === 'E042'), 'E042「留人古寺」已被回填');
ok(events.filter(e => e.kind === 'direct').every(e => e.resultText), '旧缓存中的直接奇遇已补齐回声');
ok(events.filter(e => e.kind === 'choice').flatMap(e => e.choices || []).every(c => c.resultText), '旧缓存中的选择奇遇已补齐回声');
ok(events.filter(e => e.kind === 'challenge').every(e => e.challenge.winText && e.challenge.failText), '旧缓存中的挑战奇遇已补齐胜负回声');

const e042 = events.find(e => e.id === 'E042');
if (e042) {
  ok(e042.name === '留人古寺', 'E042 名称正确');
  ok(e042.kind === 'choice', 'E042 类型为 choice');
  const c1 = e042.choices && e042.choices[1];
  ok(c1 && c1.effect && c1.effect.talent === 'T034', 'E042 choices[1].effect.talent === T034',
     c1 && c1.effect ? c1.effect.talent : '?');
}
const persisted = JSON.parse(localStorage.getItem('feihua_editors_v1_events') || '[]');
ok(persisted.some(e => e.id === 'E042'), '回填后的 E042 已持久化到 localStorage');
ok(persisted.filter(e => e.kind === 'direct').every(e => e.resultText), '补齐后的回声已持久化到 localStorage');

ok(SEED_EVENTS.slice(42).every(e => persisted.some(v => v.id === e.id)), '新增 20 个奇遇全部持久化');

function edit(id) {
  const idx = window.ADV.get().findIndex(e => e.id === id);
  const button = document.querySelector('#evlist [data-edit="' + idx + '"]');
  if (!button) throw new Error('没有编辑入口：' + id);
  button.click();
  ok(document.getElementById('evTitle').textContent.includes(id), id + ' 可在真实编辑弹窗打开');
}
edit('E048');
const capInput = document.querySelector('#evEffectBox .eff-insp-max');
ok(capInput.value === '3', '瓦壶容春显示灵感上限 +3');
ok(document.querySelector('#evEffectBox').textContent.includes('本局，不自动回满'), '上限说明与引擎一致');
capInput.value = '4';
capInput.dispatchEvent(new window.Event('input', { bubbles: true }));
document.getElementById('evSave').click();
ok(window.ADV.get().find(e => e.id === 'E048').effect.inspirationMax === 4, '编辑上限并保存生效');
edit('E048');
ok(document.querySelector('#evEffectBox .eff-insp-max').value === '4', '重新打开保留编辑后的上限');
document.getElementById('evCancel').click();

for (const id of ['E058', 'E057', 'E062']) {
  const before = JSON.stringify(window.ADV.get().find(e => e.id === id));
  edit(id);
  if (id === 'E058') ok(document.querySelector('#evChoices .eff-talent-info').textContent.includes('同声相应'), '文心选项显示真实关联文心');
  if (id === 'E057') ok(document.querySelectorAll('#evWinBox .eff-attr').length === 6, '六艺雅集可编辑全部六维奖励');
  if (id === 'E062') ok(document.querySelectorAll('#evChoices .choice-block').length === 3, '渔火分题可编辑三个独立选项');
  document.getElementById('evSave').click();
  ok(JSON.stringify(window.ADV.get().find(e => e.id === id)) === before, id + ' 编辑保存往返不丢失效果与文案');
}
const saved = JSON.parse(localStorage.getItem('feihua_editors_v1_events'));
ok(saved.find(e => e.id === 'E048').effect.inspirationMax === 4, '手动修改持久化到缓存');
dom.window.close();
console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
if (fail) process.exit(1);
