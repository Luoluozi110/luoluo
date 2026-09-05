#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game } from '../js/engine/game.js';
import { normalizeConfig, validateConfig, validateProject } from '../js/engine/config.js';
import { deserializeRun } from '../js/engine/save.js';
import { Reincarnate } from '../js/engine/reincarnate.js';
import * as R from '../js/engine/rules.js';

const names = [
  'attrs', 'inspiration', 'board', 'questions', 'events', 'talents', 'schools', 'affinity',
  'npcs', 'sky', 'grades', 'album', 'synergies', 'npc-mechanics', 'talent-upgrade', 'narrative',
  'sidequest-talents', 'sidequest-npcs', 'sidequests'
];
const load = name => JSON.parse(fs.readFileSync(new URL(`../config/${name}.json`, import.meta.url), 'utf8'));
const buildCfg = () => normalizeConfig(Object.fromEntries(names.map(name => [name, load(name)])));
const clone = value => JSON.parse(JSON.stringify(value));
const ui = {
  floatAttrs() {}, floatInspiration() {}, floatInspirationMax() {}, onState() {}, showDice() {}, movePiece() {},
  highlightCell() {}, showQuizResult() {}, showSky() {}, skyExpired() {}, showTalentGain() {}, showPalaceIntro() {},
  toast() {}, async showResult() {}, async askReplaceTalent() { return 0; }, async askScenic() { return false; },
  async showQuiz() { return { index: 0, timedOut: false }; }, async showEvent() { return 0; },
  async runBattle() { throw new Error('numeric-v2 test does not use the UI battle flow'); }
};
const talent = (cfg, id) => clone(cfg.talentById.get(id));

console.log('== 数值 v2：整数配置、运行期比例归一化与云端工程 ==');
{
  const raw = Object.fromEntries(names.map(name => [name, load(name)]));
  assert.equal(validateConfig(raw).ok, true);
  const project = JSON.parse(fs.readFileSync(new URL('../feihua-content.json', import.meta.url), 'utf8'));
  assert.equal(validateProject(project).ok, true);
  assert.equal(project.numericVersion, 2);
  const cfg = buildCfg();
  assert.equal(cfg.attrs.initial.shi, 50);
  assert.equal(cfg.inspiration.initial, 360);
  assert.equal(cfg.attrs.styleSystem.shi.lowMult, 0.85);
  assert.equal(cfg.schools[0].schoolMechanics.talentConversion.chance, 0.45);
  assert.equal(cfg.npcs[4].npcs[1].mech.signature.main.pct, 0.12);
  assert.equal(cfg['sidequest-npcs'].routes.jianghu.climax.mech.signature.pct, 0.08);
  assert.equal(cfg.sky[2].choices[0].effect.value, 0.08);
  assert.equal(cfg.sky[2].choices[1].effect.value, 20);
  assert.equal(cfg.synergies.find(x => x.id === 'S22').effects[0].target, 'score');
  assert.equal(cfg.synergies.find(x => x.id === 'S41').effects[0].target, 'attrs');
}

console.log('== 数值 v2：三功均以整数进度结算 ==');
{
  Reincarnate.reset();
  const g = new Game(buildCfg(), ui, () => 0);
  g.start('bowen', { tutorial: true });
  assert.equal(g.studyProgressRate(), 1440);
  assert.equal(g.strategyIncome(), 1500);
  assert.equal(g.manuscriptFragmentRate(), 250);
  const a = g.ensureAbilityState();
  a.study.progress.shi = 2800;
  const study = g.gainStudyProgress('shi', 400, '测试研修');
  assert.deepEqual({ gained: study.gained, progress: study.progress, need: study.need }, { gained: 1, progress: 200, need: 3000 });
  assert.equal(g.s.attrs.shi, 60);
  a.strategy.chargeRemainder = 500;
  a.strategy.refillPhase = '';
  assert.equal(g.refillStrategy('numeric-v2'), 2);
  assert.equal(a.strategy.chargeRemainder, 0);
  assert.ok(Number.isInteger(a.study.progress.shi));
  assert.ok(Number.isInteger(a.strategy.chargeRemainder));
  assert.ok(Number.isInteger(a.manuscript.fragments));
}

console.log('== 数值 v2：文心羁绊分别进入属性、得分与费用链路 ==');
{
  Reincarnate.reset();
  const cfg = buildCfg();
  const g = new Game(cfg, ui, () => 0);
  g.start('bowen', { tutorial: true });
  g.s.passive = [talent(cfg, 'T026'), talent(cfg, 'T034'), talent(cfg, 'T001'), talent(cfg, 'T002')];
  g.s.active = [];
  assert.equal(g.effectiveAttrs().shi, 52, 'S22 仅提高作品得分，不重复放大六维');
  const foe = { id: 'numeric_foe', name: '校验对手', fullName: '校验对手', attrs: { shi: 80, ci: 80, lian: 80, bi: 80, xue: 80, si: 80 } };
  const out = g.resolveBattle(g.createSession({ npc: foe, label: '军械库分层' }), 'shi', 'wanyue', [4]);
  assert.match(out.selfCalc.items.map(item => item.detail || '').join('\n'), /羁绊·百炼归真·百炼 \+3%/);

  g.s.passive = [talent(cfg, 'T026'), talent(cfg, 'T004'), talent(cfg, 'T001')];
  assert.equal(g.effectiveAttrs().shi, 53, 'T026 与 S41 共同作用于属性层，按 6% 一次结算');

  g.s.passive = [talent(cfg, 'T016'), talent(cfg, 'T005'), talent(cfg, 'T004')];
  const costSession = g.createSession({ npc: foe, label: '羁绊减费' });
  const withSynergy = costSession.extraDiceCost('shi', 1, [1]);
  const originalSynergySet = g.synergySet.bind(g);
  g.synergySet = () => [];
  const withoutSynergy = costSession.extraDiceCost('shi', 1, [1]);
  g.synergySet = originalSynergySet;
  assert.equal(withSynergy, 10);
  assert.equal(withoutSynergy, 20, 'S04 的首骰减费进入与文心相同的费用账单');
}

console.log('== 数值 v2：旧存档与传承只迁移一次 ==');
{
  const cfg = buildCfg();
  const legacy = {
    v: 9,
    state: {
      school: { id: 'bowen' }, routeIndex: 0, turn: 1, passive: [], active: [], sky: [], loadout: [],
      attrs: { shi: 5, ci: 5, lian: 5, bi: 5, xue: 5, si: 5 }, inspiration: 36, inspirationMax: 54,
      schoolState: { inspirationAccumulator: 0.4 },
      abilityState: {
        version: 2, insight: 3,
        study: { focus: ['shi'], nextFocus: ['shi'], progress: { shi: 1.2 } },
        strategy: { charges: 1, chargeRemainder: 0.5, refillPhase: '', plan: 'guard', nextPlan: 'guard' },
        manuscript: { pages: 0, fragments: 0.25, volumes: 0, polish: 0 }
      }
    }
  };
  const restored = deserializeRun(legacy, cfg);
  assert.equal(restored.ok, true, restored.error);
  assert.equal(restored.state.attrs.shi, 50);
  assert.equal(restored.state.inspiration, 360);
  assert.equal(restored.state.abilityState.insight, 30);
  assert.equal(restored.state.abilityState.study.progress.shi, 1200);
  assert.equal(restored.state.abilityState.strategy.chargeRemainder, 500);
  assert.equal(restored.state.abilityState.manuscript.fragments, 250);
  assert.equal(restored.state.schoolState.inspirationAccumulator, 4000);

  Reincarnate.reset();
  Reincarnate._mem = { attrs: { shi: 5, ci: 5, lian: 5, bi: 5, xue: 5, si: 5 } };
  assert.equal(Reincarnate.peek().attrs.shi, 50);
  assert.equal(Reincarnate.peek().numericVersion, 2);
  Reincarnate.reset();
}

console.log('== 数值 v2：终局评级保持原量级 ==');
{
  const grades = load('grades');
  const common = { battle: { win: 3, draw: 1, loss: 0, maxStreak: 2, upsets: 0, winsByStyle: {} }, events: {} };
  const v1Grades = clone(grades);
  v1Grades.numericVersion = 1;
  for (const dim of v1Grades.dimensions) if (dim.coeff && dim.coeff.softRate != null) dim.coeff.softRate /= 10000;
  const v1 = R.sixDimScore({ ...common, attrs: { shi: 12, ci: 11, lian: 10, bi: 9, xue: 8, si: 7 }, finish: { inspirationLeft: 36 } }, v1Grades);
  const v2 = R.sixDimScore({ ...common, numericVersion: 2, attrs: { shi: 120, ci: 110, lian: 100, bi: 90, xue: 80, si: 70 }, finish: { inspirationLeft: 360 } }, grades);
  assert.equal(v2.total, v1.total);
  assert.equal(v2.grade.name, v1.grade.name);
}

console.log('numeric-v2.test.mjs: 数值重构、存档迁移、羁绊分层与终局等价性 ✓');
