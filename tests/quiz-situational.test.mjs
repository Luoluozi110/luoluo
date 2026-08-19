#!/usr/bin/env node
/**
 * 柔性答题（情境化选择）回归
 * 依据《飞花棋 · 柔性答题方案与文档》第九节验收清单：
 *  1) 数据层：knowledge 题 optionActs 与 options 等长同序、answer 下标合法、无 {name} 占位
 *  2) 引擎层：判定仍是纯索引式——点正确下标为对，点错下标为错（game.js 未改）
 *  3) UI 层：有 scenario 显示情境而非原 stem、选项显示 optionActs；
 *            缺字段的旧题降级为 stem + options 原文（向后兼容）；
 *            答错时结果行回显「正确的那一件事」
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'file:///C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom/lib/api.js';
import { Game } from '../js/engine/game.js';

const CFG_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'config');
const load = n => JSON.parse(fs.readFileSync(path.join(CFG_DIR, `${n}.json`), 'utf8'));

/* ═══════════════════════ 1. 数据层校验 ═══════════════════════ */
const questions = load('questions');
const knowledge = questions.filter(q => q.type === 'knowledge');
const choice = questions.filter(q => q.type === 'choice');
assert.ok(knowledge.length >= 49, `knowledge 题应不少于 49 道，实为 ${knowledge.length}`);

let situ = 0;
for (const q of knowledge) {
  if (!q.scenario && !q.optionActs) continue;   // 允许尚未转写的旧题
  situ++;
  assert.ok(typeof q.scenario === 'string' && q.scenario.length >= 20,
    `${q.id} scenario 过短或缺失`);
  assert.ok(Array.isArray(q.optionActs), `${q.id} 有 scenario 就必须有 optionActs`);
  assert.equal(q.optionActs.length, q.options.length,
    `${q.id} optionActs(${q.optionActs.length}) 必须与 options(${q.options.length}) 等长`);
  assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length,
    `${q.id} answer 下标越界`);
  for (const [i, act] of q.optionActs.entries()) {
    assert.ok(typeof act === 'string' && act.trim().length >= 5,
      `${q.id} optionActs[${i}] 内容过短`);
    assert.ok(act.length <= 60, `${q.id} optionActs[${i}] 过长（${act.length} 字），会挤爆选项按钮`);
    assert.ok(!act.includes('{name}'), `${q.id} optionActs[${i}] 不得写死 {name} 占位`);
  }
  assert.ok(!q.scenario.includes('{name}'), `${q.id} scenario 不得写死 {name} 占位`);
  assert.ok(q.scenario.length <= 160, `${q.id} scenario 过长（${q.scenario.length} 字）`);
  // 原 stem 必须保留，供编辑与机器参考
  assert.ok(typeof q.stem === 'string' && q.stem.length > 0, `${q.id} stem 不可删除`);
}
assert.equal(situ, knowledge.length, `应全部 knowledge 题都已情境化，实为 ${situ}/${knowledge.length}`);
// choice（创作抉择）本次不碰
for (const q of choice) {
  assert.equal(q.scenario, undefined, `${q.id} 为 choice 题，本次不应注入 scenario`);
  assert.equal(q.optionActs, undefined, `${q.id} 为 choice 题，本次不应注入 optionActs`);
}

/* ═══════════════════════ 2. 引擎判定层 ═══════════════════════ */
function buildCfg() {
  const cfg = {};
  for (const n of ['attrs', 'inspiration', 'board', 'questions', 'events', 'talents', 'schools', 'affinity', 'npcs', 'sky', 'grades', 'album', 'synergies', 'npc-mechanics', 'talent-upgrade']) {
    try { cfg[n] = load(n); } catch (_) { cfg[n] = n === 'talent-upgrade' || n === 'npc-mechanics' ? {} : []; }
  }
  cfg.board.cellById = new Map((cfg.board.mainRing || []).map(c => [c.id, { ...c, ring: 'main' }]));
  cfg.board.laps = Number(cfg.board.laps) || 2;
  cfg.board.ringSize = cfg.board.mainRing.length;
  cfg.questions = (cfg.questions || []).filter(q => q.enabled !== false);
  cfg.events = (cfg.events || []).filter(e => e.enabled !== false);
  cfg.affinity.themeNames ||= {}; cfg.affinity.mannerNames ||= {}; cfg.affinity.matrix ||= {};
  cfg.talentById = new Map((cfg.talents || []).map(t => [t.id, t]));
  cfg.talentUpgradeById = new Map(Object.entries(cfg['talent-upgrade'] || {}));
  cfg['npc-mechanics'].signatureTemplates ||= {}; cfg['npc-mechanics'].weaknessTemplates ||= {};
  cfg['npc-mechanics'].intentTemplates ||= {}; cfg['npc-mechanics'].budget ||= {};
  return cfg;
}

/** 只留一道情境化题，令 doQuiz 必定抽到它 */
async function runQuiz(pickIndex) {
  const cfg = buildCfg();
  const target = JSON.parse(JSON.stringify(cfg.questions.find(q => q.id === 'Q0001')));
  cfg.questions = [target];
  const seen = {};
  const ui = {
    floatAttrs() {}, floatInspiration() {}, onState() {}, toast() {}, highlightCell() {},
    showSky() {}, skyExpired() {}, showTalentGain() {}, showPalaceIntro() {}, showDice() {},
    movePiece() {}, syncStageRing() {}, async showStageChange() {}, async showResult() {},
    async askReplaceTalent() { return 0; }, async askScenic() { return false; },
    async showEvent() { return 0; }, async runBattle() { return { win: true, score: 1, oppScore: 0 }; },
    async showQuiz(q) { seen.q = q; return { index: pickIndex, timedOut: false }; },
    async showQuizResult(q, ans, ok) { seen.ok = ok; seen.ans = ans; }
  };
  const g = new Game(cfg, ui, () => 0.1);   // rand<0.7 → 必抽 knowledge
  g.start('bowen', { name: '测' });
  const before = { right: g.s.quiz.right, insp: g.s.inspiration };
  await g.doQuiz({ id: 'T1', name: '考题格', type: 'quiz' });
  return { g, seen, before, target };
}

{ // 点正确下标（Q0001 answer=0）→ 判定为对
  const { g, seen, before, target } = await runQuiz(0);
  assert.ok(seen.q.scenario, '引擎传给 UI 的题目应带 scenario');
  assert.equal(seen.q.optionActs.length, seen.q.options.length, 'optionActs 随题目原样传递');
  assert.equal(seen.ok, true, '点击 answer 下标应判定为对');
  assert.equal(g.s.quiz.right, before.right + 1, '答对应计入正确数');
  assert.equal(target.answer, 0, 'Q0001 的 answer 下标不应被内容改造改动');
}
{ // 点错误下标 → 判定为错，并扣灵感
  const { g, seen, before } = await runQuiz(1);
  assert.equal(seen.ok, false, '点击非 answer 下标应判定为错');
  assert.equal(g.s.quiz.right, before.right, '答错不应计入正确数');
  assert.ok(g.s.inspiration < before.insp, '答错应按 inspiration.quizWrong 扣灵感');
}

/* ═══════════════════════ 3. UI 渲染层 ═══════════════════════ */
const dom = new JSDOM('<!doctype html><html><body><div id="layer"></div></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true
});
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
localStorage.setItem('fhq.audio.muted', '1');   // 无 AudioContext 环境下静音，避免副作用

const { Modals } = await import('../js/ui/modals.js');
const m = new Modals(document.querySelector('#layer'), { inspiration: { quizWrong: -2 } });
// close() 有 210ms 淡出延时，旧弹窗会短暂留在 DOM 里，故一律取「最新的那一个」
const last = sel => [...document.querySelectorAll(sel)].pop();
const lastAll = sel => {
  const box = last('.modal');
  return [...box.querySelectorAll(sel)];
};

// 3.1 情境化题：显示 scenario，不显示原 stem；选项显示 optionActs
const q1 = questions.find(q => q.id === 'Q0001');
const p1 = m.showQuiz(q1, { seconds: 30 });
const modal1 = last('.modal');
assert.ok(modal1, '题卡应已插入');
assert.ok(modal1.textContent.includes(q1.scenario), '题面应显示 scenario 全文');
assert.ok(!modal1.textContent.includes(q1.stem), `情境化题不应再显示原 stem：${q1.stem}`);
const btns1 = lastAll('.opt');
assert.equal(btns1.length, q1.options.length, '选项数应与 options 一致');
btns1.forEach((b, i) => {
  assert.ok(b.textContent.includes(q1.optionActs[i]),
    `第 ${i + 1} 个选项应显示 optionActs[${i}]，而非选项原文`);
  assert.equal(b.dataset.i, String(i), '按钮回传的下标必须仍是 options 的原下标');
});
// 模拟答错（点第 2 项，正确项为第 1 项）
btns1[1].click();
const ans1 = await p1;
assert.equal(ans1.index, 1, '点击应回传对应下标');

// 3.2 答错结果行：回显「正确的那一件事」
const rp = m.showQuizResult(q1, ans1, false);
const box = last('.analysis');
assert.ok(box, '结果解析框应已插入');
assert.ok(box.textContent.includes(q1.optionActs[q1.answer]),
  '结果行应回显 optionActs[answer]（正确动作）');
assert.ok(box.textContent.includes('当如是'), '情境化题的结果行改用「当如是」措辞');
assert.ok(box.textContent.includes(q1.analysis), '解析应原样展示');
assert.ok(lastAll('.opt.right').length === 1, '正确项应高亮');
assert.ok(lastAll('.opt.wrong').length === 1, '误选项应标错');
box.querySelector('[data-ok]').click();
await rp;

// 3.3 向后兼容：缺 scenario / optionActs 的旧题按原样渲染
const legacy = {
  id: 'QTEST', type: 'knowledge', stem: '裸题面：此句作者是？',
  difficulty: 1, category: 'shi', analysis: '（测试用）', enabled: true,
  options: ['甲', '乙', '丙'], answer: 2
};
const p2 = m.showQuiz(legacy, { seconds: 30 });
const modal2 = last('.modal');
assert.ok(modal2.textContent.includes(legacy.stem), '旧题仍显示 stem');
const btns2 = lastAll('.opt');
assert.equal(btns2.length, 3, '旧题选项数不变');
btns2.forEach((b, i) =>
  assert.ok(b.textContent.includes(legacy.options[i]), `旧题第 ${i + 1} 项显示选项原文`));
btns2[2].click();
const ans2 = await p2;
const rp2 = m.showQuizResult(legacy, ans2, true);
const box2 = last('.analysis');
assert.ok(box2.textContent.includes('答对了'), '旧题答对文案不变');
box2.querySelector('[data-ok]').click();
await rp2;

console.log(`柔性答题回归：${situ}/${knowledge.length} 题已情境化，索引判定不变，情境渲染与旧题降级、结果回显全部通过`);
dom.window.close();
