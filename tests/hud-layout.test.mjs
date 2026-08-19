#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'file:///C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom/lib/api.js';
import { Hud } from '../js/ui/hud.js';

const dom = new JSDOM('<!doctype html><html><body><div id="hud"></div></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true
});
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;

window.matchMedia = query => ({
  matches: query.includes('orientation: landscape') && query.includes('max-height: 500px'),
  addEventListener() {},
  removeEventListener() {}
});

new Hud(document.querySelector('#hud'));

assert.equal(document.querySelector('#attrPanel').parentElement.id, 'leftHudRail');
assert.equal(document.querySelector('#inspBar').parentElement.id, 'leftHudRail');
assert.equal(document.querySelector('#skyBadges').parentElement.id, 'rightHudRail');
assert.equal(document.querySelector('#talentBar').parentElement.id, 'rightHudRail');
for (const id of ['logBox', 'toastZone', 'rollZone', 'turnInfo']) {
  assert.equal(document.querySelector(`#${id}`).parentElement.id, 'actionDock');
}

await new Promise(resolve => setTimeout(resolve, 220));
for (const id of ['attrPanel', 'inspBar', 'talentBar']) {
  assert.ok(document.querySelector(`#${id}`).classList.contains('collapsed'), `${id} 应在初始横向短屏自动收起`);
}

const css = fs.readFileSync(new URL('../css/ui.css', import.meta.url), 'utf8');
assert.match(css, /#rightHudRail\s*\{[^}]*display:\s*flex/s);
assert.match(css, /@media \(min-width: 601px\) and \(max-width: 900px\)/);
assert.match(css, /#actionDock #toastZone\s*\{[^}]*position:\s*static/s);
assert.match(css, /#actionDock #logBox div:nth-last-child\(-n \+ 2\)/);

console.log('HUD 布局：左右栏与移动端行动栈结构验证通过');
dom.window.close();
