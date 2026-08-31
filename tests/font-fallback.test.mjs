// font-fallback.test.mjs —— 中文字体加载与缺字回退静态回归
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../css/base.css', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const font = new URL('../fonts/noto-serif-sc/NotoSerifSC-400.woff2', import.meta.url);

assert.match(css, /@font-face\s*\{[\s\S]*?font-family:\s*"Wenxin Serif SC";[\s\S]*?font-display:\s*swap;[\s\S]*?NotoSerifSC-400\.woff2\?v=20260831firstrun1
  '自托管字体须使用 swap，网络加载未完成时可立即显示回退字体');
assert.match(css, /--font-song:\s*var\(--font-system-cjk\)/, '首屏必须优先使用系统中文字体');
assert.match(css, /--font-system-cjk:[\s\S]*?"Songti SC"[\s\S]*?"PingFang SC"[\s\S]*?"Microsoft YaHei"[\s\S]*?"Noto Sans CJK SC"[\s\S]*?system-ui/s,
  '跨平台中文回退链须覆盖主流系统');
assert.match(css, /html\.font-web-ready[\s\S]*?--font-song:\s*"Wenxin Serif SC", var\(--font-system-cjk\)/,
  '仅在字体健康检查通过后启用自托管字体');
assert.match(css, /--font-symbol:[\s\S]*?"Segoe UI Symbol"[\s\S]*?"Noto Sans Symbols 2"/,
  '符号必须使用独立回退链');
assert.match(css, /--font-emoji:[\s\S]*?"Apple Color Emoji"[\s\S]*?"Segoe UI Emoji"/,
  '彩色表情必须使用独立回退链');
assert.match(page, /rel="preload" as="font" type="font\/woff2" href="fonts\/noto-serif-sc\/NotoSerifSC-400\.woff2\?v=20260831firstrun1" crossorigin/,
  '首屏应预加载自托管字体');
assert.match(page, /css\/base\.css\?v=20260831firstrun1
  '字体策略更新必须更新样式缓存版本');
assert.match(page, /document\.fonts\.load\('400 16px "Wenxin Serif SC"',[\s\S]*?font-web-ready/,
  '页面必须在字体加载成功后才启用自托管字体');
assert.match(page, /loadingerror[\s\S]*?classList\.remove\('font-web-ready'\)/,
  '字体运行时加载失败时必须切回系统字体');

const bytes = fs.readFileSync(font);
assert.equal(bytes.subarray(0, 4).toString(), 'wOF2', '随包字体必须是有效的 WOFF2 文件');
assert.ok(bytes.byteLength > 1_000_000, '随包字体不得被意外替换为残缺文件');

console.log('font-fallback.test.mjs: 自托管字体、跨平台中文回退与缓存版本全部通过');

