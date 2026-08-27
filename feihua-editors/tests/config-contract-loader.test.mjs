import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const primary = '../feihuaqi-playable/js/engine/config-contract.js?v=20260827contractfix1';
const fallback = '../js/engine/config-contract.js?v=20260827contractfix1';
const common = 'assets/js/common.js?v=';

// 静态标签优先命中源码工作区（file:// 与本地 http 预览），并保证 jsdom 冒烟能内联真契约
assert.ok(html.includes(`<script src="${primary}"></script>`), '源码工作区使用 sibling playable 的契约静态路径');
// GitHub Pages 扁平布局下首个路径 404，由 document.write 回退到根目录 js
assert.ok(html.includes(`document.write('<script src="${fallback}`), 'GitHub Pages 使用根目录 js 的契约回退路径');
assert.ok(/if \(!window\.FeihuaConfigContract\) \{\s*document\.write/.test(html), '回退仅在静态契约未加载时触发');
const contractEnd = html.indexOf('</script>', html.indexOf(fallback));
const commonAt = html.indexOf(common);
assert.ok(commonAt > 0 && contractEnd > 0 && contractEnd < commonAt, '契约脚本（含回退）必须先于 common.js 执行');

console.log('config-contract-loader.test.mjs: 编辑器契约静态优先 + 线上回退加载顺序通过');
