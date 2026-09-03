import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const modals = readFileSync(new URL('../js/ui/modals.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../js/ui/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/ui.css', import.meta.url), 'utf8');
const album = readFileSync(new URL('../js/ui/album.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.match(modals, /aria-pressed=/, '候选必须暴露选中状态');
assert.match(modals, /data-chapter-line/, '候选必须可由键鼠聚焦和切换');
assert.match(modals, /只定表达，不改得失/, '明确说明章句不影响数值');
assert.match(modals, /return selectedId;/, '弹窗必须把选中的句子回传引擎');
assert.match(app, /class="end-scroll paper"/, '结算页必须展示独立行卷卡');
assert.doesNotMatch(app, /const inkBlock =/, '旧行卷留痕不再作为重复卡片出现');
assert.doesNotMatch(app, /const narrativeBlock =/, '旧卷末余音不再作为重复卡片出现');
assert.match(css, /\.chapter-line-choice:focus-visible/, '键盘焦点必须清晰可见');
assert.match(css, /@media \(max-width: 560px\)[\s\S]*\.chapter-line-choices \{ grid-template-columns:1fr;/, '窄屏候选改为单列');
assert.match(album, /sum\.endScroll/, '成绩图必须读取终局行卷');
assert.match(html, /20260903wenxinbonds2/, '入口缓存版本必须更新');

console.log('end-scroll-ui.test.mjs: 默认选择、键盘焦点、响应式、结算与成绩图接线全部通过');
