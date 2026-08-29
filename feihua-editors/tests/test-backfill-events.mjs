/* 验证 adventure.js loadData 的 backfillOfficialEvents() 能在旧 localStorage（缺 E042）场景下补入 E042。
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

// 在 DOMContentLoaded 触发前注入旧 localStorage：事件 41 条（种子去掉 E042）
// 必须用内联 seed 解析后的数据来构造，因为脚本此刻尚未执行。
const seedEvSrc = readFileSync(join(root, 'assets/js/seed-events.js'), 'utf8');
const mEv = seedEvSrc.match(/window\.GAME_EVENTS\s*=\s*(\[[\s\S]*\]);?\s*\n?$/);
const SEED_EVENTS = eval('(' + mEv[1] + ')');
const stale = SEED_EVENTS.filter(e => e.id !== 'E042').map(e => {
  const copy = JSON.parse(JSON.stringify(e));
  if (copy.kind === 'direct') delete copy.resultText;
  if (copy.kind === 'choice') (copy.choices || []).forEach(c => delete c.resultText);
  if (copy.kind === 'challenge') { delete copy.challenge.winText; delete copy.challenge.failText; }
  return copy;
});
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

console.log('E042 backfill 模拟旧 localStorage（' + stale.length + ' 条事件，无 E042）');
const events = window.ADV ? window.ADV.get() : [];
ok(events.length === 42, 'loadData 后事件数为 42', events.length);
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

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
if (fail) process.exit(1);
