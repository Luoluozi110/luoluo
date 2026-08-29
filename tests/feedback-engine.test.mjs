import assert from 'node:assert/strict';
import { Game } from '../js/engine/game.js';
import { effectBrief } from '../js/ui/modals.js';

const seen = { attrs: [], inspiration: [], capacity: [], logs: [] };
const game = new Game({
  attrs: { diminish: null },
  inspiration: { max: 10 }
}, {
  floatAttrs: (...args) => seen.attrs.push(args),
  floatInspiration: (...args) => seen.inspiration.push(args),
  floatInspirationMax: (...args) => seen.capacity.push(args),
  recordLog: entry => seen.logs.push(entry)
});

game.s = {
  turn: 3,
  attrs: { shi: 5, ci: 5, lian: 5, bi: 5, xue: 5, si: 5 },
  inspiration: 6,
  inspirationMax: 10,
  sky: [], log: [], school: { schoolMechanics: {} }, schoolState: {}
};

const attr = game.addAttrs({ shi: 2, xue: 1 }, { reason: '答对考题' });
assert.deepEqual(attr, { shi: 2, xue: 1 });
assert.deepEqual(seen.attrs.at(-1)[0], { shi: 2, xue: 1 });
assert.equal(seen.attrs.at(-1)[2], '答对考题');

assert.equal(game.addInspiration(-2, '应战'), -2);
assert.deepEqual(seen.inspiration.at(-1), [-2, '应战']);

assert.equal(game.addInspirationMax(4, '奇遇·心源拓阔'), 4);
assert.equal(game.s.inspirationMax, 14);
assert.deepEqual(seen.capacity.at(-1), [4, '奇遇·心源拓阔']);

await game.applyEffect({ attrs: { shi: 3, xue: 2 }, inspiration: 1 });
assert.deepEqual(seen.attrs.at(-1), [{ shi: 3, xue: 2 }, undefined, '奇遇所得']);
assert.deepEqual(seen.inspiration.at(-1), [1, '奇遇']);
assert.equal(effectBrief({ attrs: { shi: 3, xue: 2 }, inspiration: 1, inspirationMax: 2 }), '诗力 +3　学力 +2　灵感 +1　灵感上限 +2');

game.push('论战得胜');
assert.deepEqual(seen.logs.at(-1), { turn: 3, text: '论战得胜' });

console.log('数值反馈引擎：属性、灵感、上限与即时日志全部通过');
