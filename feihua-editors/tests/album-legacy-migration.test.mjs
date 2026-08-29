import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const editorRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(editorRoot, '..');
const require = createRequire(import.meta.url);
const { JSDOM } = require('C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom');
const runtime = JSON.parse(readFileSync(join(root, 'feihuaqi-playable/config/album.json'), 'utf8'));
const legacy = runtime.map(card => ({
  id: card.id,
  name: card.name,
  unlock: card.unlock,
  reward: card.reward,
  rewardDesc: card.rewardDesc,
  text: card.text,
  growth: { baseXp: card.growth.baseXp },
  branches: []
}));

let html = readFileSync(join(editorRoot, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => `<script>${readFileSync(join(editorRoot, src.split('?')[0]), 'utf8')}</script>`);
const dom = new JSDOM(html, {
  url: 'https://editor.local/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.localStorage.setItem('feihua_editors_v1_album', JSON.stringify(legacy));
  }
});
const { window } = dom;
await new Promise(resolve => window.document.readyState !== 'loading'
  ? resolve()
  : window.document.addEventListener('DOMContentLoaded', resolve, { once: true }));

const cards = window.ALBUM.exportRaw();
assert.equal(cards.length, runtime.length, '旧存档仍保留全部名篇');
assert.equal(cards.reduce((n, c) => n + c.branches.length, 0), 24, '旧存档启动后补回全部分支');
assert.equal(cards.reduce((n, c) => n + c.branches.reduce((m, b) => m + b.effects.length, 0), 0), 96, '旧存档启动后补回全部分支效果');
for (let i = 0; i < runtime.length; i++) {
  for (let j = 0; j < runtime[i].branches.length; j++) {
    for (let k = 0; k < runtime[i].branches[j].effects.length; k++) {
      const expected = runtime[i].branches[j].effects[k];
      const actual = cards[i].branches[j].effects[k];
      if (Object.prototype.hasOwnProperty.call(expected, 'value')) assert.equal(actual.value, expected.value, `${runtime[i].id}/${runtime[i].branches[j].id} 效果数值同步`);
    }
  }
}

const stored = JSON.parse(window.localStorage.getItem('feihua_editors_v1_album'));
assert.equal(stored.reduce((n, c) => n + c.branches.length, 0), 24, '迁移后的完整分支已写回 localStorage');
console.log('album-legacy-migration.test.mjs: 旧版 localStorage 自动补齐分支、效果和数值通过');
