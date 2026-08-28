#!/usr/bin/env node
// 阶段预案交互契约：旧调步/立章入口必须彻底消失，自动触发不得依赖隐藏信息。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const game = read('js/engine/game.js');
const app = read('js/ui/app.js');
const battle = read('js/ui/battle.js');
const modals = read('js/ui/modals.js');

for (const [name, source] of [['game', game], ['app', app], ['battle', battle], ['modals', modals]]) {
  assert.equal(source.includes('askStrategyMove'), false, `${name} 不得残留每回合调步弹窗入口`);
  assert.equal(source.includes('pickChapter'), false, `${name} 不得残留每场立章步骤`);
  assert.equal(source.includes('redirectStudy'), false, `${name} 不得残留筹策易策耦合`);
}
assert.equal(battle.includes('④½ 立章'), false, '战斗六步流程不再插入额外选择');
assert.ok(game.includes('applyStrategyMovement') && game.includes('strategyBattlePct') && game.includes('strategyLossAmount'), '三种预案均由引擎自动执行');

const automaticCore = game.slice(game.indexOf('strategyCanTrigger('), game.indexOf('spendManuscript('));
for (const forbidden of ['correctIndex', 'answerIndex', 'futureDice', 'futureStyle', 'intentLocked', 'expectedScore(', 'Math.random']) {
  assert.equal(automaticCore.includes(forbidden), false, `自动预案不得读取 ${forbidden}`);
}

console.log('阶段预案流程：0 调步弹窗、0 立章步骤、0 隐藏信息读取 ✓');
