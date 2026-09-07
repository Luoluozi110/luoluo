import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const source = process.argv[2] ? path.resolve(process.argv[2]) :
  (fs.existsSync(path.join(repo, 'feihuaqi-playable/config/attrs.json')) ? path.join(repo, 'feihuaqi-playable') : repo);
const read = name => JSON.parse(fs.readFileSync(path.join(source, 'config', name), 'utf8'));
const attrs = read('attrs.json'), inspiration = read('inspiration.json');
assert.deepEqual(Object.values(attrs.initial), [5, 5, 5, 5, 5, 5]);
assert.equal(attrs.abilitySystem.study.progressPerXue, 0.04);
assert.equal(attrs.abilitySystem.study.progressNeed, 3);
assert.equal(attrs.abilitySystem.manuscript.fragmentPerBi, 0.05);
assert.equal(attrs.abilitySystem.manuscript.fragmentNeed, 2);
assert.equal(attrs.abilitySystem.manuscript.fragmentFastBi, 16);
assert.equal(attrs.abilitySystem.strategy.chargePerSi, 10);
assert.deepEqual([inspiration.initial, inspiration.max, inspiration.extraDiceCost], [36, 54, 5]);

let conservationChecks = 0;
// Independent legacy reference in hundredths. No floating rounding in accumulations.
for (let a = 0; a <= 60; a++) {
  const systems = [
    { name: 'study', oldRate: Math.min(200, 100 + 4*a), oldNeed: 300, rate: Math.min(50, 25+a), need: 75 },
    { name: 'manuscript', oldRate: Math.min(150, 5*a), oldNeed: a >= 16 ? 100 : 200, rate: Math.min(30, a), need: a >= 16 ? 20 : 40 },
    { name: 'strategy', oldRate: 100+10*a, oldNeed: 100, rate: 10+a, need: 10 }
  ];
  for (const s of systems) {
    assert.equal(s.rate*s.oldNeed, s.oldRate*s.need);
    let rest = 0, completed = 0;
    for (let turn = 1; turn <= 200; turn++) {
      rest += s.rate;
      completed += Math.floor(rest/s.need);
      rest %= s.need;
      assert.equal(completed, Math.floor(turn*s.oldRate/s.oldNeed), `${s.name}/${a}/${turn}`);
      assert.equal(rest*s.oldNeed, ((turn*s.oldRate)%s.oldNeed)*s.need);
      assert.equal(completed*s.need+rest, turn*s.rate);
      conservationChecks++;
    }
  }
}
const growth = (attribute, remainder, count) => {
  for (let i = 0; i < count; i++) {
    remainder += attribute >= 48 ? 1 : attribute >= 34 ? 2 : 4;
    attribute += Math.floor(remainder/4);
    remainder %= 4;
  }
  return [attribute, remainder];
};
let splitChecks = 0;
for (let a = 0; a <= 60; a++) for (let rem = 0; rem < 4; rem++) {
  for (let n = 0; n <= 20; n++) for (let cut = 0; cut <= n; cut++) {
    const first = growth(a, rem, cut);
    assert.deepEqual(growth(...first, n-cut), growth(a, rem, n));
    splitChecks++;
  }
}
assert.deepEqual(growth(33, 0, 3), [35, 0]);
assert.deepEqual(growth(34, 0, 2), [35, 0]);
assert.deepEqual(growth(48, 0, 4), [49, 0]);
assert.deepEqual([4, 5, 7].map(n => Math.ceil(n*4/5)), [4, 4, 6]);
const base = Math.round((7*15+9*5)/3)+4*15;
assert.equal(base, 110);
const percentages = [3.4, 6.8, 10.2, 20, 25, 30];
const scores = percentages.map(p => Math.round(base*(100+p)/100));
assert.deepEqual(scores, [114, 117, 121, 132, 138, 143]);
const doc = fs.readFileSync(path.join(here, '文心棋-数值系统全面重构方案-v2.md'), 'utf8');
assert.equal((doc.match(/^```/gm) || []).length % 2, 0);
assert.ok(!doc.includes('\uFFFD'));
let tableColumns = 0;
for (const line of doc.split(/\r?\n/)) {
  if (!line.startsWith('|')) { tableColumns = 0; continue; }
  const columns = line.split('|').length;
  if (tableColumns) assert.equal(columns, tableColumns, line);
  tableColumns = columns;
}
const report = {
  scheme: 'small-integer-v2-proposal',
  scope: 'Arithmetic checks only; no runtime changes or full-game balance validation',
  conservationChecks, growthCandidateSplitChecks: splitChecks,
  attributeRange: [0, 60], incomeEventsPerCase: 200,
  base, poetrySingleDieScores: scores,
  progressScalesFromLegacy: { study: 25, manuscript: 20, strategy: 10 },
  sourceFingerprints: Object.fromEntries(['attrs.json', 'inspiration.json'].map(name => [name,
    createHash('sha256').update(fs.readFileSync(path.join(source, 'config', name))).digest('hex')])),
  limitations: ['No capacity or overflow simulation', 'No changing attributes or stacked rewards',
    'No legacy save migration', 'No full effect mapping', 'No game balance or playtesting'],
  passed: true
};
fs.writeFileSync(path.join(here, '文心棋-数值重构-核查记录-v2.json'), JSON.stringify(report, null, 2)+'\n');
for (const match of doc.matchAll(/\]\(([^)]+)\)/g)) assert.ok(fs.existsSync(path.join(here, match[1])), match[1]);
console.log(JSON.stringify(report, null, 2));
