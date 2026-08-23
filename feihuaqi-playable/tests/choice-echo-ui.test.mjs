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

hud.choiceEcho({
  leadText: '奇遇所得',
  choiceText: '山寺听钟',
  resultText: '钟声越过水面，胸中焦躁也终于散去。'
});
const eventEcho = document.querySelectorAll('.toast.choice-echo')[1];
assert.equal(eventEcho.querySelector('.choice-echo-picked').textContent, '奇遇所得：山寺听钟');
assert.match(eventEcho.querySelector('.choice-echo-result').textContent, /钟声越过水面/);

console.log('奇遇回声 UI：选择、直接与挑战共用非阻塞分层反馈，DOM 验证通过');
dom.window.close();
