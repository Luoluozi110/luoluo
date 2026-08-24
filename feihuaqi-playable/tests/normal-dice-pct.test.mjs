// 普通灵感骰乘区回归：骰点不再直接兑换固定分，而是放大本场创作底盘。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as R from '../js/engine/rules.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/[A-Za-z]:/, s => s.slice(1))), '..');
const inspiration = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'inspiration.json'), 'utf8'));
const attrsConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'attrs.json'), 'utf8'));
const styles = attrsConfig.styleSystem;

assert.equal(inspiration.dicePct, 0.05, '普通骰每点进入 +5% 乘区');

const attrs = { shi: 10, ci: 10, lian: 10, bi: 10, xue: 10, si: 10 };
const ordinary = R.styleDiceScore('shi', [4], styles, R.BATTLE_COEF.diceMult, 0, inspiration.dicePct);
assert.equal(ordinary.score, 30, '保留旧固定分字段供 NPC/旧调用兼容');
assert.ok(Math.abs(ordinary.pct - 0.3) < 1e-9, '诗四点按高骰规则进入 +30% 乘区');
const amplified = R.styleDiceScore('shi', [4], styles, 8, 0, inspiration.dicePct);
assert.ok(Math.abs(amplified.pct - 0.48) < 1e-9, '旧骰倍率文心按相对倍率放大新乘区');

const out = R.battleScore({
  attrs, style: 'shi', dice: 4, dicePct: ordinary.pct,
  dicePctDetail: ordinary.pctDetail, coef: R.BATTLE_COEF
});
assert.equal(out.breakdown.coreBase, 220, '作品创作底盘按三项基础分合计');
assert.ok(Math.abs(out.breakdown.dicePct - 0.3) < 1e-9, '结算保留本场骰组的有效乘区');
assert.equal(out.breakdown.diceContribution, 66, '乘区收益按底盘 220 × 30% 计算');
assert.equal(out.total, 286, '普通骰收益并入乘区后再进入总分');
assert.match(out.items[3].detail, /乘区 \+30%/);

const fixed = R.battleScore({ attrs, style: 'shi', dice: 4, dicePct: ordinary.pct, diceFixed: 15 });
assert.equal(fixed.breakdown.dicePct, 0, '固定骰仍走固定值路径，不重复叠加普通骰乘区');
assert.equal(fixed.items[3].value, 15, '固定灵感骰保留原有收益');

const low = R.styleDiceScore('shi', [2], styles, R.BATTLE_COEF.diceMult, 0, inspiration.dicePct);
assert.ok(Math.abs(low.pct - 0.07) < 1e-9, '诗低骰仍保留 0.7 倍的文体差异');

console.log('normal-dice-pct.test.mjs: all assertions passed');
