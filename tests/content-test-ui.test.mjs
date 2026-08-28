import assert from 'node:assert/strict';
import { JSDOM } from 'file:///C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom/lib/api.js';
import * as Album from '../js/engine/album.js';
import * as Codex from '../js/engine/codex.js';
import { ContentTestUI } from '../js/ui/contentTest.js';

const dom = new JSDOM('<!doctype html><html><body><div id="content-test-screen"></div></body></html>', {
  url: 'http://localhost/?test=content', pretendToBeVisual: true
});
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);

Album.saveStore(Album.emptyStore());
Codex.saveCodex(Codex.emptyCodex());
const cfg = {
  album: [{ id: 'A1' }],
  schools: [{ id: 'bowen' }],
  npcs: [], talents: [], synergies: [], sky: []
};
const el = document.querySelector('#content-test-screen');
const ui = new ContentTestUI({ el, cfg });
ui.open();

assert.ok(el.classList.contains('on'));
assert.equal(el.querySelector('.ct-title').textContent, '全 内 容 解 锁');
assert.equal(el.querySelectorAll('.ct-metric').length, 6);
assert.equal(el.querySelector('[data-apply]').textContent, '写入全量测试数据');
await new Promise(resolve => setTimeout(resolve, 30));
assert.ok(el.querySelector('[data-apply]') === document.activeElement || document.activeElement === el.querySelector('[data-apply]'));
ui.close();
assert.ok(!el.classList.contains('on'));
console.log('content-test-ui.test.mjs: 页面结构、入口焦点与关闭行为通过');
dom.window.close();
