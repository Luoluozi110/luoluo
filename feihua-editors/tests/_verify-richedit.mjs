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
const dom = new JSDOM(html, { url: 'https://editor.local/', runScripts: 'dangerously', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
await new Promise(r => { if (document.readyState !== 'loading') return r(); window.addEventListener('DOMContentLoaded', r, { once: true }); });
await new Promise(r => setTimeout(r, 50));

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n); } };

ok(!!(window.Common && window.Common.richText), 'Common.richText 已挂载');
const ids = ['ev-text', 'tal-text', 'sky-text'];
for (const id of ids) {
  const ta = document.getElementById(id);
  const wrap = ta && ta.closest('.rich-editor');
  ok(!!wrap, id + ' 已被包裹为 .rich-editor');
  ok(!!wrap && !!wrap.querySelector('.re-toolbar'), id + ' 含工具栏');
  ok(!!wrap && !!wrap.querySelector('.re-preview'), id + ' 含预览区');
  ok(!!ta && ta.dataset.richEnhanced === '1', id + ' 标记已增强');
}

// 模拟在 ev-text 输入 markdown，验证预览渲染
const ta = document.getElementById('ev-text');
ta.value = '# 落英\n你来到**飞花棋**局前。\n> 一局既开，万缘皆动。\n- 落子\n- 成篇\n---';
ta.dispatchEvent(new window.Event('input', { bubbles: true }));
const prev = ta.closest('.rich-editor').querySelector('.re-preview');
const pv = prev.innerHTML;
ok(/<h3 class="re-h">落英<\/h3>/.test(pv), '预览渲染标题');
ok(/<strong>飞花棋<\/strong>/.test(pv), '预览渲染加粗');
ok(/<blockquote class="re-quote">一局既开/.test(pv), '预览渲染引用');
ok(/<ul class="re-ul">[\s\S]*<li>落子<\/li>/.test(pv), '预览渲染列表');
ok(/<hr class="re-hr">/.test(pv), '预览渲染分隔线');
ok(/你来到/.test(pv), '预览保留第二人称「你」');

// 模拟素材插入（第二人称「你」）
const before = ta.value;
const youBtn = [...ta.closest('.rich-editor').querySelectorAll('.re-btn')].find(b => b.textContent.includes('第二人称'));
youBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
ok(ta.value.length >= before.length, '素材按钮插入不丢失原文本');

// copy 标签叙事域增强
const copyTa = document.querySelector('#copylist textarea[data-rich]');
ok(!!copyTa && !!copyTa.closest('.rich-editor'), '叙事文案标签 textarea 已增强');

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
