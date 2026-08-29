#!/usr/bin/env node
// 强反馈版跨局成长：首局必升级 + 开局/结算/图鉴三处展示契约。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Album from '../js/engine/album.js';
import { Game } from '../js/engine/game.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

assert.equal(Album.MASTERY_THRESHOLDS[1], 12, 'Lv2 门槛必须为首局固定结算所得的 12');
const store = Album.emptyStore();
const firstRun = Album.addMasteryXp(store, 'bowen', { reachedEnd: false, wenzong: false });
assert.equal(firstRun.gained, 12, '普通首局结算固定获得 12 熟练度');
assert.equal(firstRun.after.level, 2, '普通首局结算后必定永久升至 Lv2');

const app = read('js/ui/app.js');
assert.match(app, /schoolStartPreview/, '开局卡必须从实际开局公式预览属性');
assert.match(app, /本局实属性/, '开局卡必须展示实际属性');
assert.match(app, /初授文心.*继承 Lv/, '开局卡必须展示初授文心继承等级');
assert.match(app, /跨局所得/, '结算页必须展示跨局所得');
assert.match(app, /下一局具体变化/, '结算页必须展示下一局具体变化');
const gameSource = read('js/engine/game.js');
assert.match(gameSource, /crossRunSummary/, '结算展示必须使用引擎提供的跨局结算事实');

const codex = read('js/ui/codex.js');
assert.match(codex, /历史最高 Lv/, '文心图鉴必须展示历史最高等级');
assert.match(codex, /再获即继承此等级/, '图鉴必须说明历史等级的继承结果');

const loadConfig = name => JSON.parse(fs.readFileSync(path.join(root, 'config', `${name}.json`), 'utf8'));
const cfg = {};
for (const name of ['attrs', 'inspiration', 'board', 'questions', 'events', 'talents', 'schools', 'affinity', 'npcs', 'sky', 'grades', 'album', 'talent-upgrade']) cfg[name] = loadConfig(name);
cfg.talentById = new Map(cfg.talents.map(talent => [talent.id, talent]));
cfg.talentUpgradeById = new Map(Object.entries(cfg['talent-upgrade']));
const result = {};
const ui = {
  floatAttrs() {}, floatInspiration() {}, onState() {}, toast() {},
  async showResult(summary) { result.summary = summary; },
  async askReplaceTalent() { return 0; }
};
Album.resetStore();
const game = new Game(cfg, ui, () => 0.5);
game.start('bowen', { name: '测试' });
game.s.inspiration = 999;
const starter = game.s.passive[0];
const upgraded = game.upgradeTalent(starter.id);
assert.equal(upgraded.ok, true, '可在结算前制造一条文心历史等级提升');
await game.endGame('turnlimit');
assert.equal(result.summary.crossRun.mastery.after.level, 2, '结算跨局数据记录首局 Lv2 突破');
assert.ok(result.summary.crossRun.talentLevels.some(item => item.id === starter.id && item.after === 2), '结算跨局数据记录本局文心历史最高等级');

console.log('crossrun-strong-feedback.test.mjs: 跨局强反馈契约全部通过');
