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

const hud = new Hud(document.querySelector('#hud'));

assert.equal(document.querySelector('#attrPanel').parentElement.id, 'leftHudRail');
assert.equal(document.querySelector('#inspBar').parentElement.id, 'leftHudRail');
assert.equal(document.querySelector('#skyBadges').parentElement.id, 'rightHudRail');
assert.equal(document.querySelector('#talentBar').parentElement.id, 'rightHudRail');
for (const id of ['logBox', 'toastZone', 'rollZone', 'turnInfo']) {
  assert.equal(document.querySelector(`#${id}`).parentElement.id, 'actionDock');
}

hud.render({
  attrs: { shi: 5, ci: 5, lian: 5, bi: 5, xue: 5, si: 5 },
  inspiration: 48, inspirationMax: 68, sky: [], passive: [], active: [], synergies: [],
  nextBattlePct: 0, abilityState: null, school: {}, schoolState: {},
  log: [{ turn: 1, text: '踏入桃花书院' }], turn: 1, phase: 'child', playerName: ''
});
hud.recordChange({ kind: 'inspiration', value: -2, reason: '应战' });
hud.recordChange({ kind: 'attr', values: { shi: 2, xue: 1 }, reason: '答对考题' });
assert.match(document.querySelector('#logBox').textContent, /灵感 -2/);
assert.match(document.querySelector('#logBox').textContent, /诗力 \+2、学力 \+1/);
assert.match(document.querySelector('#logBox').textContent, /答对考题/);
hud.recordLog({ turn: 2, text: '论战得胜' });
assert.match(document.querySelector('#logBox').textContent, /2\s*论战得胜/);
assert.match(document.querySelector('#logBox').textContent, /论战得胜/);

await new Promise(resolve => setTimeout(resolve, 220));
for (const id of ['attrPanel', 'inspBar', 'talentBar']) {
  assert.ok(document.querySelector(`#${id}`).classList.contains('collapsed'), `${id} 应在初始横向短屏自动收起`);
}

const css = fs.readFileSync(new URL('../css/ui.css', import.meta.url), 'utf8');
assert.match(css, /#rightHudRail\s*\{[^}]*display:\s*flex/s);
assert.match(css, /@media \(min-width: 601px\) and \(max-width: 900px\)/);
assert.match(css, /#actionDock #toastZone\s*\{[^}]*position:\s*static/s);
assert.match(css, /#actionDock #logBox \.log-history \.log-entry:last-child/);
assert.match(css, /#logBox \.log-delta/);

console.log('HUD 布局：左右栏与移动端行动栈结构验证通过');
dom.window.close();
