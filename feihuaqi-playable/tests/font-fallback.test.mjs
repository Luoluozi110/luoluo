// font-fallback.test.mjs —— 中文字体加载与缺字回退静态回归
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../css/base.css', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const font = new URL('../fonts/noto-serif-sc/NotoSerifSC-400.woff2', import.meta.url);

assert.match(css, /@font-face\s*\{[\s\S]*?font-family:\s*"Noto Serif SC";[\s\S]*?font-display:\s*swap;[\s\S]*?NotoSerifSC-400\.woff2/s,
  '自托管字体须使用 swap，网络加载未完成时可立即显示回退字体');
assert.match(css, /--font-song:\s*"Noto Serif SC"/, '正文优先使用随游戏发布的字体');
assert.match(css, /--font-cjk-fallback:[\s\S]*?"PingFang SC"[\s\S]*?"Microsoft YaHei"[\s\S]*?"Noto Sans CJK SC"[\s\S]*?system-ui/s,
  '跨平台中文回退链须覆盖主流系统');
assert.match(css, /--font-song:[\s\S]*?var\(--font-cjk-fallback\)/,
  '正文在缺字时必须能进入 CJK 回退链');
assert.match(css, /--font-kai:[\s\S]*?var\(--font-cjk-fallback\)/,
  '标题在缺字时必须能进入 CJK 回退链');
assert.match(page, /rel="preload" as="font" type="font\/woff2" href="fonts\/noto-serif-sc\/NotoSerifSC-400\.woff2" crossorigin/,
  '首屏应预加载自托管字体');
assert.match(page, /css\/base\.css\?v=20260828-font-fallback1/,
  '字体策略更新必须更新样式缓存版本');

const bytes = fs.readFileSync(font);
assert.equal(bytes.subarray(0, 4).toString(), 'wOF2', '随包字体必须是有效的 WOFF2 文件');
assert.ok(bytes.byteLength > 1_000_000, '随包字体不得被意外替换为残缺文件');

console.log('font-fallback.test.mjs: 自托管字体、跨平台中文回退与缓存版本全部通过');
