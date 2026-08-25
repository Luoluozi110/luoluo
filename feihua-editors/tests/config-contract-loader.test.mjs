import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const primary = '../feihuaqi-playable/js/engine/config-contract.js?v=20260826contractpath1';
const fallback = '../js/engine/config-contract.js?v=20260826contractpath1';
const common = 'assets/js/common.js?v=20260825npcdice1';

assert.ok(html.includes(primary), '源码工作区使用 sibling playable 的契约路径');
assert.ok(html.includes(fallback), 'GitHub Pages 使用根目录 js 的契约回退路径');
assert.ok(html.indexOf(fallback) < html.indexOf(common), '契约回退必须先于 common.js 执行');
assert.match(html, /if \(!window\.FeihuaConfigContract\)[\s\S]*document\.write/, '主路径失效时会同步装载回退脚本');

console.log('config-contract-loader.test.mjs: 编辑器契约双路径加载顺序通过');
