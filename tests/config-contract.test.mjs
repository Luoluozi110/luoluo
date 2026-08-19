import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig, validateProject, applyProjectOverride, normalizeConfig } from '../js/engine/config.js';

const names = ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies','npc-mechanics','talent-upgrade','narrative'];
const raw = {};
for (const name of names) raw[name] = JSON.parse(readFileSync(new URL(`../config/${name}.json`, import.meta.url), 'utf8'));

const clone = value => JSON.parse(JSON.stringify(value));

const valid = validateConfig(raw);
assert.equal(valid.ok, true, JSON.stringify(valid.errors.slice(0, 5)));

const badAnswer = clone(raw);
badAnswer.questions[0].answer = 999;
let result = validateConfig(badAnswer);
assert.equal(result.ok, false);
assert.ok(result.errors.some(x => x.path === 'questions[0].answer'));

const badScenario = clone(raw);
badScenario.questions[0].scenario = '太短';
badScenario.questions[0].optionActs[0] = '短';
result = validateConfig(badScenario);
assert.ok(result.errors.some(x => x.path === 'questions[0].scenario'));
assert.ok(result.errors.some(x => x.path === 'questions[0].optionActs[0]'));

const leakedChoice = clone(raw);
const choiceIndex = leakedChoice.questions.findIndex(q => q.type === 'choice');
leakedChoice.questions[choiceIndex].scenario = raw.questions[0].scenario;
leakedChoice.questions[choiceIndex].optionActs = raw.questions[0].optionActs;
result = validateConfig(leakedChoice);
assert.ok(result.errors.some(x => x.path === `questions[${choiceIndex}].scenario`));
assert.ok(result.errors.some(x => x.path === `questions[${choiceIndex}].optionActs`));

const legacyKnowledge = clone(raw);
delete legacyKnowledge.questions[0].scenario;
delete legacyKnowledge.questions[0].optionActs;
assert.equal(validateConfig(legacyKnowledge).ok, true, '旧知识题仍应兼容');

const badUpgrade = clone(raw);
badUpgrade['talent-upgrade'].UNKNOWN = { maxLevel: 2, upCost: [1], levels: [{ effect: {} }, { effect: {} }] };
result = validateConfig(badUpgrade);
assert.ok(result.errors.some(x => x.code === 'missing_ref' && x.path === 'talent-upgrade.UNKNOWN'));

const badRoute = clone(raw);
badRoute.board.route[0].cellId = 99999;
result = validateConfig(badRoute);
assert.ok(result.errors.some(x => x.path === 'board.route[0].cellId'));

const incomplete = validateProject({ _type: 'feihua-content', talents: raw.talents });
assert.equal(incomplete.ok, false);
assert.ok(incomplete.errors.some(x => x.code === 'required'));

const patch = { _type: 'feihua-content', questions: raw.questions.slice(0, 2) };
assert.equal(validateProject(patch, { requireComplete: false }).ok, true);
const normalized = normalizeConfig(clone(raw));
const merged = applyProjectOverride(normalized, patch, { requireType: true });
assert.equal(merged.questions.length, 2);

assert.throws(
  () => applyProjectOverride(normalized, { _type: 'wrong', questions: [] }, { requireType: true }),
  /_type/
);

console.log('config-contract.test.mjs: 本地配置 / 云端补丁 / 引用与字段路径校验全部通过');
