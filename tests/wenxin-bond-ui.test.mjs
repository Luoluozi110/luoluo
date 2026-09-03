import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'file:///C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom/lib/api.js';

const dom = new JSDOM('<!doctype html><html><body><div id="layer"></div></body></html>', { url:'http://localhost/', pretendToBeVisual:true });
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.MutationObserver = dom.window.MutationObserver;
global.requestAnimationFrame = callback => setTimeout(callback, 0);

const { Modals } = await import('../js/ui/modals.js');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/[A-Za-z]:/, s => s.slice(1))), '..');
const load = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'config', `${name}.json`), 'utf8'));
const side = load('sidequest-talents');
const talents = [...load('talents'), ...side.talents];
const cfg = { synergies:load('synergies'), talentById:new Map(talents.map(t => [t.id, t])) };
const modals = new Modals(document.querySelector('#layer'), cfg);
modals.game = { s:{ passive:[cfg.talentById.get('T041'), cfg.talentById.get('T022')], active:[] } };

let closed = modals.showSynergyCatalog();
let overlay = document.querySelector('.synergy-catalog');
assert.ok(overlay, '右侧入口可打开羁绊图谱');
assert.match(overlay.textContent, /守诺成势/);
assert.match(overlay.textContent, /抱柱之信/);
assert.match(overlay.textContent, /一鼓作气/);
assert.match(overlay.textContent, /同声相应/);
assert.match(overlay.textContent, /同文风连捷达到 2 场，得分 \+10%/);
assert.match(overlay.textContent, /还差「同声相应」/);
overlay.querySelector('[data-ok]').click();
await closed;
await new Promise(resolve => setTimeout(resolve, 230));

const gainHints = [{
  ...cfg.synergies.find(sy => sy.id === 'S26'), active:false, missing:['同声相应'],
  members:[
    { id:'T041', name:'抱柱之信', owned:true },
    { id:'T022', name:'一鼓作气', owned:true },
    { id:'T039', name:'同声相应', owned:false }
  ]
}];
closed = modals.showTalentGain(cfg.talentById.get('T041'), { level:1, maxLevel:4, synergies:gainHints });
overlay = document.querySelector('.talent-card').closest('.overlay');
assert.match(overlay.textContent, /可构成羁绊 · 1 组/);
assert.match(overlay.textContent, /羁绊效果/);
assert.match(overlay.textContent, /还差「同声相应」/);
overlay.querySelector('[data-ok]').click();
await closed;

console.log('wenxin-bond-ui.test.mjs: 获得弹窗与右侧羁绊图谱查询 ✓');
dom.window.close();
