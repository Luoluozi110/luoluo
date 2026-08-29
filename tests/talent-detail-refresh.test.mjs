#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'file:///C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom/lib/api.js';
import { Modals } from '../js/ui/modals.js';

const dom = new JSDOM('<!doctype html><html><body><div id="modalLayer"></div></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.requestAnimationFrame = cb => cb();

const root = process.cwd();
const talents = JSON.parse(fs.readFileSync(path.join(root, 'config', 'talents.json'), 'utf8'));
const upgrades = JSON.parse(fs.readFileSync(path.join(root, 'config', 'talent-upgrade.json'), 'utf8'));
const base = talents.find(t => t.id === 'TA03');
const up = upgrades.TA03;
assert.ok(base && up && up.levels.length >= 3, 'TA03 及其升级表必须存在');
const max = up.maxLevel;

const cloneAt = level => ({
  ...base,
  effect: structuredClone(up.levels[level - 1].effect),
  cost: up.levels[level - 1].cost ?? base.cost
});

let current = cloneAt(1);
const state = {
  passive: [], active: [current], talentLevels: { TA03: 1 },
  inspiration: 99, inspirationMax: 99
};
let stateRefreshes = 0;
const game = {
  s: state,
  ui: {
    onState() {
      stateRefreshes++;
      // 模拟真实 HUD 重绘/状态归一：升级后槽位替换成新的运行时对象。
      current = cloneAt(state.talentLevels.TA03);
      state.active = [current];
    },
    toast() {}
  },
  upgradeTalent(id) {
    const level = state.talentLevels[id];
    const cost = up.upCost[level - 1];
    state.inspiration -= cost;
    state.talentLevels[id] = level + 1;
    // 先改旧对象，随后 onState 会把槽位替换成新对象；详情页必须重新从 game.s 查找。
    state.active[0].effect = structuredClone(up.levels[level].effect);
    state.active[0].cost = up.levels[level].cost ?? state.active[0].cost;
    this.ui.onState(state);
    return { ok: true, level: level + 1, max: up.maxLevel, cost };
  }
};

const modals = new Modals(document.querySelector('#modalLayer'), {
  talentUpgradeById: new Map([['TA03', up]])
});
modals.game = game;
modals.showTalentDetail(current);

const text = () => document.querySelector('.talent-detail .talent-card').textContent.replace(/\s+/g, ' ').trim();
assert.match(text(), new RegExp(`Lv 1/${max}`), '打开详情页时显示 Lv1');
assert.match(text(), new RegExp(`消耗灵感 ${up.levels[0].cost}`), '打开详情页时显示当前 Lv1 主动成本');
assert.match(text(), new RegExp(`下一级（Lv2）`), '打开详情页时预览 Lv2');

let firstButton = document.querySelector('.talent-detail [data-up]');
firstButton.click();
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(state.talentLevels.TA03, 2, '点击升级后状态升至 Lv2');
assert.ok(stateRefreshes >= 1, '升级后触发状态刷新');
assert.match(text(), new RegExp(`Lv 2/${max}`), '弹窗即时刷新为 Lv2');
assert.match(text(), new RegExp(`消耗灵感 ${up.levels[1].cost}`), '弹窗即时刷新当前主动成本');
assert.match(text(), new RegExp(`下一级（Lv3）`), '弹窗即时刷新下一级预览');
assert.ok(document.querySelector('.talent-detail [data-up]'), '升级后按钮已重新绑定，可连续升级');

const secondButton = document.querySelector('.talent-detail [data-up]');
secondButton.click();
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(state.talentLevels.TA03, 3, '连续升级后状态升至 Lv3');
assert.match(text(), new RegExp(`Lv 3/${max}`), '弹窗即时刷新为 Lv3');
assert.match(text(), /下一级（Lv4）/, '连续升级后继续显示最新下一级预览');
assert.ok(document.querySelector('.talent-detail [data-up]'), '未满级时仍可继续升级');

console.log('文心详情页：升级后等级、效果来源、主动成本与下一级预览均实时刷新');
dom.window.close();
