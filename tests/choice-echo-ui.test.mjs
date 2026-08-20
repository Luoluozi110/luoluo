#!/usr/bin/env node
import assert from 'node:assert/strict';
import { JSDOM } from 'file:///C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom/lib/api.js';
import { Hud } from '../js/ui/hud.js';

const dom = new JSDOM('<!doctype html><html><body><div id="hud"></div></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true
});
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const hud = new Hud(document.querySelector('#hud'));
hud.choiceEcho({
  choiceText: '还他五色笔，从此老实读书',
  resultText: '五色光从指间退去。你重新铺纸。'
});

const echo = document.querySelector('.toast.choice-echo');
assert.ok(echo, '应即时插入专属回声节点');
assert.equal(document.querySelector('.choice-echo-picked').textContent, '已选择：还他五色笔，从此老实读书');
assert.equal(document.querySelector('.choice-echo-result').textContent, '五色光从指间退去。你重新铺纸。');
assert.equal(echo.querySelectorAll('.choice-echo-picked').length, 1);
assert.equal(echo.querySelectorAll('.choice-echo-result').length, 1);

console.log('选择回声 UI：已选择与结果分层呈现，DOM 验证通过');
dom.window.close();
