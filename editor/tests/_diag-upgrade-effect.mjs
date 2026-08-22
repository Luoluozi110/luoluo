/* 诊断 v2：逐级效果编辑 → 点保存 → 检查 state.talents（正确的持久化路径） */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const { JSDOM } = require('C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let html = readFileSync(join(root, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const code = readFileSync(join(root, src), 'utf8');
  return `<script>\n${code}\n</script>`;
});

const dom = new JSDOM(html, { url: 'https://editor.local/', runScripts: 'dangerously', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.URL.createObjectURL = () => 'blob:stub';
window.URL.revokeObjectURL = () => {};
window.Blob = class { constructor(parts) { this._s = parts.join(''); } };
await new Promise(res => {
  if (document.readyState !== 'loading') return res();
  window.addEventListener('DOMContentLoaded', res, { once: true });
});

let pass = 0, fail = 0;
const ok = (c, n, e) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (e != null ? `（${e}）` : '')); } };
const fire = (el, t) => el.dispatchEvent(new window.Event(t, { bubbles: true }));
const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const q = s => document.querySelector(s);

const t = {
  id: 'T_DIAG', name: '诊断升级', kind: 'passive', text: 't',
  effect: { type: 'on_win_bonus', style: 'shi', value: 2 },
  upgrade: { quality: 'rare', maxLevel: 4, upCost: [7, 11, 16],
    levels: [
      { effect: { type: 'on_win_bonus', style: 'ci', value: 3 } },
      { effect: { type: 'on_win_bonus', style: 'lian', value: 4 } },
      { effect: { type: 'attr_flat', attrs: { shi: 2 } } }
    ] }
};
window.TALENT.importData([t], true);
const idx = window.TALENT.get().findIndex(x => x.id === 'T_DIAG');
click(document.querySelector(`#tallist [data-edit="${idx}"]`));

// 场景1：修改逐级效果数值（不改类型），保存
console.log('[场景1] Lv2 数值 3 -> 9（on_win_bonus 的 .tal-value）');
let block = document.querySelector('#talUpgradeLevels [data-lvl="0"] .lvl-eff-dyn');
let val = block && block.querySelector('.tal-value');
ok(!!val, 'Lv2 .tal-value 存在');
// on_win_bonus 的 value 是"获胜额外+值"
if (val) {
  val.value = '9';
  fire(val, 'input');
  fire(val, 'change');
  click(q('#talSave'));
}
let saved1 = window.TALENT.get().find(x => x.id === 'T_DIAG');
ok(saved1 && saved1.upgrade.levels[0].effect.value === 9, '保存后 Lv2 value=9', saved1 && saved1.upgrade.levels[0].effect.value);

// 场景2：修改逐级效果类型，保存
console.log('[场景2] 重开编辑，Lv2 类型 on_win_bonus -> dice_mult，保存');
click(document.querySelector(`#tallist [data-edit="${idx}"]`));
let typeSelect = document.querySelector('#talUpgradeLevels [data-lvl="0"] .tal-eff-type');
ok(!!typeSelect, 'Lv2 类型下拉存在');
if (typeSelect) {
  console.log('   Lv2 当前类型 =', typeSelect.value);
  typeSelect.value = 'dice_mult';
  fire(typeSelect, 'change');
  // 重新查询渲染后的 DOM
  const afterType = document.querySelector('#talUpgradeLevels [data-lvl="0"] .tal-eff-type');
  console.log('   change 后 Lv2 类型 =', afterType ? afterType.value : '(无 re-render)');
  ok(afterType && afterType.value === 'dice_mult', 'change 后下拉变为 dice_mult', afterType && afterType.value);
  click(q('#talSave'));
}
let saved2 = window.TALENT.get().find(x => x.id === 'T_DIAG');
ok(saved2 && saved2.upgrade.levels[0].effect.type === 'dice_mult', '保存后 Lv2 type=dice_mult', saved2 && saved2.upgrade.levels[0].effect.type);

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
