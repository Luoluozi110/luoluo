#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Game } from '../js/engine/game.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/[A-Za-z]:/, s => s.slice(1))), '..');
const CFG_DIR = path.join(ROOT, 'config');
const load = name => JSON.parse(fs.readFileSync(path.join(CFG_DIR, `${name}.json`), 'utf8'));

function buildCfg() {
  const cfg = {};
  for (const name of ['attrs', 'inspiration', 'board', 'questions', 'events', 'talents', 'schools', 'affinity', 'npcs', 'sky', 'grades']) cfg[name] = load(name);
  for (const name of ['album', 'synergies', 'npc-mechanics', 'talent-upgrade']) {
    try { cfg[name] = load(name); } catch (_) { cfg[name] = name === 'npc-mechanics' || name === 'talent-upgrade' ? {} : []; }
  }
  const board = cfg.board;
  const byId = new Map();
  for (const c of board.mainRing) byId.set(c.id, { ...c, ring: 'main' });
  board.cellById = byId;
  board.laps = Number(board.laps) || 2;
  board.ringSize = board.mainRing.length;
  cfg.questions = (cfg.questions || []).filter(q => q.enabled !== false);
  cfg.events = (cfg.events || []).filter(e => e.enabled !== false);
  cfg.affinity.themeNames ||= {};
  cfg.affinity.mannerNames ||= {};
  cfg.affinity.matrix ||= {};
  cfg.talentById = new Map((cfg.talents || []).map(t => [t.id, t]));
  cfg.talentUpgradeById = new Map(Object.entries(cfg['talent-upgrade'] || {}));
  cfg['npc-mechanics'].signatureTemplates ||= {};
  cfg['npc-mechanics'].weaknessTemplates ||= {};
  cfg['npc-mechanics'].intentTemplates ||= {};
  cfg['npc-mechanics'].budget ||= {};
  return cfg;
}

function makeUI(choiceIndex = 0) {
  const calls = { echoes: [], eventEchoes: [], toasts: [], states: 0, events: [] };
  return {
    calls,
    floatAttrs() {}, floatInspiration() {}, showDice() {}, movePiece() {}, highlightCell() {},
    showQuizResult() {}, showSky() {}, skyExpired() {}, showTalentGain() {}, showPalaceIntro() {},
    async showResult() {}, async askReplaceTalent() { return 0; }, async askScenic() { return false; },
    async showQuiz() { return { index: 0, timedOut: false }; },
    async showEvent(ev) { calls.events.push(ev.id); return choiceIndex; },
    async runBattle() { return { win: true, score: 1, oppScore: 0 }; },
    onState() { calls.states++; },
    toast(text) { calls.toasts.push(text); },
    showChoiceEcho(echo) { calls.echoes.push({ ...echo }); },
    showEventEcho(echo) { calls.eventEchoes.push({ ...echo }); }
  };
}

function newGame(choiceIndex = 0, schoolId = 'bowen') {
  const ui = makeUI(choiceIndex);
  const g = new Game(buildCfg(), ui, () => 0);
  g.start(schoolId, { name: '' });
  return { g, ui };
}


const events = load('events');
const added = events.filter(e => Number(e.id.slice(1)) >= 43);
const effects = e => e.kind === 'choice' ? e.choices.map(c => c.effect) : [e.kind === 'challenge' ? e.challenge.winAll : e.effect];
assert.equal(events.length, 62);
assert.equal(added.length, 20);
assert.equal(new Set(events.map(e => e.id)).size, 62);
assert.equal(new Set(events.map(e => e.name)).size, 62);
assert.deepEqual(added.map(e => e.id), Array.from({length:20}, (_,i) => 'E' + (43+i).toString().padStart(3,'0')));
for (const [kind,count] of Object.entries({direct:7,choice:9,challenge:4})) assert.equal(added.filter(e => e.kind === kind).length, count);
for (const [rarity,count] of Object.entries({common:12,rare:6,legend:2})) assert.equal(added.filter(e => e.rarity === rarity).length, count);
assert.equal(added.filter(e => effects(e).some(f => f.inspirationMax > 0)).length, 4);
assert.equal(added.filter(e => effects(e).some(f => f.talent)).length, 4);
for (const key of ['shi','ci','lian','bi','xue','si']) assert.ok(added.some(e => effects(e).some(f => f.attrs?.[key] > 0)));
const echoes = added.flatMap(e => e.kind === 'direct' ? [e.resultText] : e.kind === 'choice' ? e.choices.map(c => c.resultText) : [e.challenge.winText,e.challenge.failText]);
assert.ok(echoes.every(v => typeof v === 'string' && v.trim().length > 10));
assert.equal(new Set(echoes).size, echoes.length);
for (const ev of added) {
  assert.ok(ev.text?.trim() && !ev.draft && ev.enabled !== false);
  for (const ef of effects(ev)) {
    if (ef.talent) assert.ok(load('talents').some(t => t.id === ef.talent), '文心必须来自既有主线库');
    for (const v of Object.values(ef.attrs || {})) assert.ok(Number.isInteger(v) && v > 0 && v <= 5);
  }
}
const { runInNewContext } = await import('node:vm');
const sandbox = {window:{}};
runInNewContext(fs.readFileSync(path.join(ROOT,'feihua-editors/assets/js/seed-events.js'),'utf8'),sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.GAME_EVENTS)), events, '编辑器种子与游戏配置一致');
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(ROOT,'feihua-content.json'),'utf8')).events, events, '云端奇遇与游戏配置一致');
console.log('✓ 20 个新增内容、类型配比、六维覆盖、文心引用与三份数据一致');

function fresh(choice=0) {
  const result = newGame(choice);
  const {g,ui} = result;
  g.s.passive = []; g.s.active = [];
  g.s.attrs = Object.fromEntries(['shi','ci','lian','bi','xue','si'].map(k => [k,10]));
  g.s.inspiration = 20; g.s.inspirationMax = 54;
  ui.calls.talents = [];
  ui.showTalentGain = async (t,meta) => ui.calls.talents.push({id:t.id,meta});
  return result;
}
function verify(g,ui,ef,initial=20) {
  for (const k of Object.keys(g.s.attrs)) assert.equal(g.s.attrs[k],10+(ef.attrs?.[k]||0), k+' 奖励不得串入其他选项');
  assert.equal(g.s.inspiration,initial+(ef.inspiration||0));
  assert.equal(g.s.inspirationMax,54+(ef.inspirationMax||0));
  assert.deepEqual([...g.s.passive,...g.s.active].map(t=>t.id), ef.talent ? [ef.talent] : []);
  if (ef.talent) {
    assert.equal(ui.calls.talents.length,1);
    assert.equal(ui.calls.talents[0].id,ef.talent);
    assert.ok(ui.calls.talents[0].meta.synergies.filter(s=>s.members.length === 2).length >= 2,'新奇遇获得文心仍能查看独立羁绊');
  }
}
let branches=0;
for (const ev of added) {
  if (ev.kind === 'challenge') continue;
  for (let idx=0; idx<(ev.choices?.length||1);idx++) {
    const {g,ui} = fresh(idx);
    const ef = ev.kind === 'choice' ? ev.choices[idx].effect : ev.effect;
    if (ev.kind === 'choice') {
      await g.applyEventChoice(ev,idx);
      assert.equal(ui.calls.echoes.at(-1).resultText,ev.choices[idx].resultText);
    } else {
      await g.applyDirectEvent(ev);
      assert.equal(ui.calls.eventEchoes.at(-1).resultText,ev.resultText);
    }
    verify(g,ui,ef); branches++;
  }
}
console.log('✓ '+branches+' 个直接/抉择分支实际结算正确（含真实授予文心与羁绊提示）');
for (const ev of added.filter(e=>e.kind === 'challenge')) {
  for (const outcome of ['win','lose','exhausted']) {
    const {g,ui} = fresh();
    let battles=0;
    g.doBattle = async () => { battles++; return outcome === 'lose' && battles === 1 ? 'lose' : 'win'; };
    if (outcome === 'exhausted') g.s.inspiration=0;
    const result = await g.runChallenge(ev);
    const won = outcome === 'win';
    assert.equal(result.complete,won);
    assert.equal(battles,outcome === 'exhausted' ? 0 : ev.challenge.battles);
    verify(g,ui,won ? ev.challenge.winAll : {},outcome === 'exhausted' ? 0 : 20);
    assert.equal(ui.calls.eventEchoes.at(-1).resultText,won ? ev.challenge.winText : ev.challenge.failText);
  }
}
console.log('✓ 4 个挑战分别验证全胜、失利、枯竭中止；仅全胜发放最终奖励');
for (const ev of added) {
  const {g,ui} = fresh();
  g.cfg.events=[ev]; g.s.seenEvents.clear();
  g.doBattle=async()=>'win';
  await g.doEvent({type:'event'});
  assert.deepEqual(ui.calls.events,[ev.id]);
  assert.ok(g.s.seenEvents.has(ev.id));
  verify(g,ui,effects(ev)[0],20+g.cfg.inspiration.eventCellCost);
  let fallback=0; g.doPing=async()=>fallback++;
  await g.doEvent({type:'event'});
  assert.equal(fallback,1);
  assert.equal(ui.calls.events.length,1);
}
console.log('✓ 20 个奇遇均可从普通格触发，耗神一次，同局去重');
{
  const {g} = fresh();
  g.s.inspiration=54;
  await g.applyDirectEvent(events.find(e=>e.id==='E048'));
  assert.equal(g.s.inspirationMax,57);
  assert.equal(g.s.inspiration,54,'沿用引擎先恢复后扩容顺序，扩容不自动补满');
  g.s.inspiration=3;
  await g.applyEventChoice(events.find(e=>e.id==='E047'),0);
  assert.equal(g.s.inspiration,3);
  assert.equal(g.s.inspirationMax,59);
}
console.log('新增二十个奇遇：全部测试通过');
