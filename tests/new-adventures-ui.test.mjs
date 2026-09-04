import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'file:///C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom/lib/api.js';

const dom = new JSDOM('<!doctype html><div id="layer"></div>', { url:'http://localhost/', pretendToBeVisual:true });
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.MutationObserver = dom.window.MutationObserver;
global.requestAnimationFrame = callback => setTimeout(callback,0);
const { Modals } = await import('../js/ui/modals.js');
const events = JSON.parse(readFileSync(new URL('../config/events.json',import.meta.url),'utf8'));
const modals = new Modals(document.getElementById('layer'),{});
for (const id of ['E048','E057','E058','E062']) {
  const ev = events.find(e=>e.id === id);
  const done = modals.showEvent(ev);
  const card = document.querySelector('.event-card');
  assert.ok(card.textContent.includes(ev.name));
  assert.ok(card.textContent.includes(ev.text));
  if (id === 'E048') {
    assert.match(card.textContent,/灵感上限 \+3/);
    assert.match(card.textContent,/灵感 \+1/);
  }
  if (id === 'E057') {
    assert.match(card.textContent,/连战 2 场，全胜可得/);
    for (const name of ['诗力','词力','联力','笔力','学力','思力']) assert.ok(card.textContent.includes(name+' +1'));
  }
  if (id === 'E058') {
    assert.match(card.querySelector('[data-i="0"]').textContent,/获得文心/);
    assert.match(card.querySelector('[data-i="0"]').textContent,/灵感 -3/);
    assert.match(card.querySelector('[data-i="1"]').textContent,/灵感 \+2/);
  }
  const index = id === 'E062' ? 2 : 0;
  if (id === 'E062') assert.equal(card.querySelectorAll('[data-i]').length,3);
  card.querySelector('[data-i="'+index+'"]').click();
  assert.equal(await done,index);
  // Modals.close 的移除动画结束后，再测试下一个卡片。
  await new Promise(resolve=>setTimeout(resolve,240));
}
dom.window.close();
console.log('new-adventures-ui.test.mjs: 新奇遇的扩容、六维、文心及三选项在选择前完整展示，点击分支正确 ✓');
