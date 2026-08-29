/* 编辑器无头冒烟测试：真实载入 index.html + 全部脚本（jsdom），
 * 验证 7 个模块初始化、相性/羁绊/地图三个编辑器的渲染与「编辑→保存→localStorage 持久化」链路。
 * 回归目标：affinity bind() 的 affBtnAdd 空引用曾导致 SYNERGY/BOARD 永不初始化。 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const { JSDOM } = require('C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let html = readFileSync(join(root, 'index.html'), 'utf8');

// 契约由静态 <script src="../feihuaqi-playable/js/engine/config-contract.js"> 提供，
// 随下方内联步骤载入真契约；document.write 回退路径仅服务线上扁平布局，测试不涉及。

// 把 <script src> 替换为内联脚本（jsdom 不主动加载本地资源），保持原有加载顺序
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const code = readFileSync(join(root, src.split('?')[0]), 'utf8');
  return `<script>\n${code}\n</script>`;
});

const dom = new JSDOM(html, {
  url: 'https://editor.local/',
  runScripts: 'dangerously',
  pretendToBeVisual: true
});
const { window } = dom;
const { document, localStorage } = window;

// 模拟已经使用过旧版编辑器的浏览器：localStorage 里没有后续发布的官方文心。
// 必须在 DOMContentLoaded 触发前写入，才能覆盖模块 init() 的真实加载路径。
const oldTalents = (window.GAME_TALENTS || []).filter(t => !['T034', 'T035', 'T036', 'T037', 'T038', 'T039', 'T040', 'TA08'].includes(t.id));
localStorage.setItem('feihua_editors_v1_talents', JSON.stringify(oldTalents));
// 同时模拟隐藏终圈上线前的编辑器缓存：三份旧数据都没有新增的系统字段。
const oldBoard = JSON.parse(JSON.stringify(window.GAME_BOARD || {}));
delete oldBoard.hiddenFinalRing;
localStorage.setItem('feihua_editors_v1_board', JSON.stringify(oldBoard));
const oldNpcs = (window.GAME_NPCS || []).filter(t => !t.isHiddenFinal);
localStorage.setItem('feihua_editors_v1_npcs', JSON.stringify(oldNpcs));
// 模拟用户当前遇到的历史题库缓存：第 70 题第三项在同一双向轴上同时保存了两个端点。
const oldQuestions = JSON.parse(JSON.stringify(window.GAME_QUESTIONS || []));
if (oldQuestions[69]?.type === 'choice' && oldQuestions[69].options?.[2]) {
  oldQuestions[69].options[2].inkTags = ['逐名', '求真'];
}
localStorage.setItem('feihua_editors_v1_qbank', JSON.stringify(oldQuestions));
const oldNarrative = JSON.parse(JSON.stringify(window.GAME_NARRATIVE || {}));
delete oldNarrative.hiddenFinal;
localStorage.setItem('feihua_editors_v1_copy_narrative', JSON.stringify(oldNarrative));

// JSDOM 的 DOMContentLoaded 在构造返回后异步触发，等待其完成再断言
await new Promise(resolve => {
  if (document.readyState !== 'loading') return resolve();
  window.addEventListener('DOMContentLoaded', resolve, { once: true });
});

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra != null ? `（${extra}）` : '')); }
}
const fire = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }));
const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

console.log('[1] 十个模块全部初始化（_ready）');
ok(!!window.FeihuaConfigContract && typeof window.FeihuaConfigContract.assertProject === 'function', '配置契约在编辑器初始化前已加载');
for (const name of ['QB', 'ADV', 'TALENT', 'NPC', 'AFFINITY', 'SYNERGY', 'BOARD', 'SKY', 'ALBUM', 'COPY']) {
  ok(window[name] && window[name]._ready === true, name + '._ready');
}

console.log('[1.1] 旧编辑器缓存自动补齐隐藏终圈系统内容');
{
  const hiddenBoard = window.BOARD.get().hiddenFinalRing;
  const hiddenTier = window.NPC.get().find(t => t.isHiddenFinal);
  const hiddenCopy = window.COPY.get().narrative.hiddenFinal;
  ok(hiddenBoard && hiddenBoard.cells.length === 12, '旧地图缓存补齐 12 格 hiddenFinalRing');
  ok(hiddenTier && hiddenTier.npcs[0].name === '陈之微', '旧 NPC 缓存补齐陈之微隐藏档');
  ok((document.querySelector('#npclist')?.textContent || '').includes('陈之微'), 'NPC 编辑器列表显示隐藏 NPC 陈之微');
  ok(hiddenCopy && hiddenCopy.invite.text && hiddenCopy.victory.text && hiddenCopy.defeat.text, '旧文案缓存补齐邀请/胜利/失败文案');
  ok(JSON.parse(localStorage.getItem('feihua_editors_v1_board') || '{}').hiddenFinalRing != null, '补齐后的隐藏地图已持久化');
  ok(JSON.parse(localStorage.getItem('feihua_editors_v1_npcs') || '[]').some(t => t.isHiddenFinal), '补齐后的隐藏 NPC 已持久化');
  ok(JSON.parse(localStorage.getItem('feihua_editors_v1_copy_narrative') || '{}').hiddenFinal != null, '补齐后的隐藏文案已持久化');
  let project = null;
  try { project = window.Common.buildProject(); } catch (_) { /* 由断言给出明确失败 */ }
  ok(!!project, '旧缓存迁移后可通过工程配置契约并发布');
}

console.log('[1.2] 旧 NPC 缓存回填新增对手与 v2 三机制');
{
  const newIds = ['shen_sui_feng', 'xie_lian_cheng', 'gu_qing_shang', 'cui_wu_jiu'];
  const legacy = window.NPC.exportRaw();
  legacy.forEach(t => { t.npcs = t.npcs.filter(n => !newIds.includes(n.id)); });
  const liMoTong = legacy.flatMap(t => t.npcs).find(n => n.id === 'li_mo_tong');
  if (liMoTong && liMoTong.mech) liMoTong.mech.version = 1;
  window.NPC.importData(legacy, true);
  const migrated = window.NPC.exportRaw().flatMap(t => t.npcs);
  ok(newIds.every(id => migrated.some(n => n.id === id)), '旧缓存缺失的 4 名新增 NPC 自动回填');
  const migratedLi = migrated.find(n => n.id === 'li_mo_tong');
  ok(migratedLi?.mech?.version === 2 && migratedLi.mech.signature.template === 'sig_zeitgeist_surf', '旧版李墨童机制自动升级为 v2');
  const cached = JSON.parse(localStorage.getItem('feihua_editors_v1_npcs') || '[]').flatMap(t => t.npcs || []);
  ok(newIds.every(id => cached.some(n => n.id === id)), '回填后的新增 NPC 持久化 localStorage');
  window.NPC.importData(window.GAME_NPCS, true);
}

console.log('[1.25] 启动时修复旧题库同轴墨痕，并立即持久化为可发布数据');
{
  const repaired = window.QB.get()[69]?.options?.[2]?.inkTags || [];
  const axes = repaired.map(tag => [['逐名', '求真'], ['守法', '出新'], ['与人', '独行'], ['惜身', '燃笔']]
    .findIndex(axis => axis.includes(tag)));
  ok(repaired.length === 2 && new Set(axes).size === 2, '启动时自动修复 questions[69].options[2] 的同轴墨痕', repaired.join('、'));
  const cached = JSON.parse(localStorage.getItem('feihua_editors_v1_qbank') || '[]');
  const cachedTags = cached[69]?.options?.[2]?.inkTags || [];
  ok(cachedTags.length === 2 && new Set(cachedTags.map(tag => [['逐名', '求真'], ['守法', '出新'], ['与人', '独行'], ['惜身', '燃笔']]
    .findIndex(axis => axis.includes(tag)))).size === 2, '修复后的墨痕立即写回 localStorage', cachedTags.join('、'));
  let project = null;
  try { project = window.Common.buildProject(); } catch (_) { /* 由断言给出明确失败 */ }
  ok(!!project, '启动迁移后工程配置契约通过，可直接发布');
}

console.log('[1.5] 题库：柔性知识题读取 → 编辑 → 动态增删选项 → 保存往返');
{
  const original = window.GAME_QUESTIONS[0];
  const q0 = window.QB.get()[0];
  ok(!!q0.scenario && Array.isArray(q0.optionActs), '默认题库保留 scenario / optionActs');
  ok(q0.optionActs.length === q0.options.length, '行动文案与标准选项等长');
  click(document.querySelector('#qlist [data-edit="0"]'));
  ok(document.getElementById('edOverlay').classList.contains('show'), '柔性知识题编辑弹窗打开');
  const scenario = document.getElementById('ed-scenario');
  ok(scenario.value === original.scenario, '情境文本正确预填');
  ok(document.querySelectorAll('#ed-options .opt-act').length === original.options.length, '每个选项都有行动文案输入框');

  const changedScenario = '暮色渐沉，你与同窗在客舟中谈及旧诗。远处钟声穿过江面而来，他请你从几位诗人中认出写下此境之人。';
  const changedAct = '答他此句出自张继笔下';
  scenario.value = changedScenario; fire(scenario, 'input');
  const firstAct = document.querySelector('#ed-options .opt-act');
  firstAct.value = changedAct; fire(firstAct, 'input');
  click(document.getElementById('ed-addopt'));
  ok(document.getElementById('ed-scenario').value === changedScenario, '添加选项不丢失已编辑情境');
  ok(document.querySelector('#ed-options .opt-act').value === changedAct, '添加选项不丢失已编辑行动文案');
  const last = document.querySelectorAll('#ed-options .opt-row').length - 1;
  click(document.querySelector(`#ed-options [data-delopt="${last}"]`));
  click(document.getElementById('edSave'));
  ok(window.QB.get()[0].scenario === changedScenario, '保存后 scenario 写入 state');
  ok(window.QB.get()[0].optionActs[0] === changedAct, '保存后 optionActs 写入 state');
  const savedQ = JSON.parse(localStorage.getItem('feihua_editors_v1_qbank') || '[]');
  ok(savedQ[0].scenario === changedScenario && savedQ[0].optionActs[0] === changedAct, '柔性字段持久化 localStorage');
  window.QB.importData(window.GAME_QUESTIONS, true);
}

console.log('[1.6] 创作抉择：墨痕字段迁移 → 编辑 → 保存往返');
{
  const choiceIndex = window.QB.get().findIndex(q => q.type === 'choice');
  const choice = window.QB.get()[choiceIndex];
  ok(choiceIndex >= 0, '题库中存在创作抉择题');
  ok(choice && choice.options.every(o => o.studyTarget && o.resultText && Array.isArray(o.inkTags) && o.inkTags.length >= 1), '旧 attr 题目自动补齐修习方向、即时反馈与墨痕');
  click(document.querySelector(`#qlist [data-edit="${choiceIndex}"]`));
  ok(document.querySelectorAll('#ed-options .opt-study-target').length === choice.options.length, '创作抉择编辑器显示修习方向下拉');
  ok(document.querySelectorAll('#ed-options .ink-tag-toggle').length === choice.options.length * 8, '创作抉择编辑器显示固定倾向标签按钮');
  ok(document.querySelectorAll('#ed-options .opt-ink-tags').length === 0, '创作抉择编辑器不再使用自由文本倾向输入');
  ok(document.querySelectorAll('#ed-options .opt-result').length === choice.options.length, '创作抉择编辑器显示即时反馈输入');
  const target = document.querySelector('#ed-options .opt-study-target');
  target.value = 'si'; fire(target, 'change');
  let selectedInk;
  while ((selectedInk = document.querySelector('#ed-options .opt-row[data-i="0"] .ink-tag-toggle.is-selected'))) click(selectedInk);
  const chooseInk = tag => click(document.querySelector(`#ed-options .opt-row[data-i="0"] .ink-tag-toggle[data-ink-tag="${tag}"]`));
  chooseInk('求真'); chooseInk('出新');
  const result = document.querySelector('#ed-options .opt-result');
  result.value = '你先追问缘由，再把所得写成一段新的起笔。'; fire(result, 'input');
  click(document.getElementById('edSave'));
  const savedChoice = window.QB.get()[choiceIndex].options[0];
  ok(savedChoice.studyTarget === 'si' && savedChoice.inkTags.join(',') === '求真,出新' && savedChoice.resultText.includes('追问缘由'), '创作抉择的修习与墨痕字段写入 state');
  const savedChoices = JSON.parse(localStorage.getItem('feihua_editors_v1_qbank') || '[]');
  ok(savedChoices[choiceIndex].options[0].resultText.includes('追问缘由'), '创作抉择字段持久化 localStorage');
  window.QB.importData(window.GAME_QUESTIONS, true);
}

console.log('[1.65] 创作抉择：同轴旧墨痕自动补齐为两条不同轴，允许发布');
{
  const broken = JSON.parse(JSON.stringify(window.GAME_QUESTIONS));
  const q = broken[69];
  q.options[2].inkTags = ['逐名', '求真']; // 同一双向轴的两个端点，模拟旧缓存
  window.QB.importData(broken, true);
  const repaired = window.QB.get()[69].options[2].inkTags;
  const axes = repaired.map(tag => [['逐名', '求真'], ['守法', '出新'], ['与人', '独行'], ['惜身', '燃笔']]
    .findIndex(axis => axis.includes(tag)));
  ok(repaired.length === 2 && new Set(axes).size === 2, '同轴旧墨痕补齐为两条不同双向轴的有效端点', repaired.join('、'));
  let project = null;
  try { project = window.Common.buildProject(); } catch (_) { /* 由断言给出明确失败 */ }
  ok(!!project, '修复后的旧题库可通过工程配置契约并发布');
  window.QB.importData(window.GAME_QUESTIONS, true);
}

console.log('[1.7] 奇遇：属性收益可见 → 可编辑 → 预览与保存往返');
{
  const eventIndex = window.ADV.get().findIndex(e => e.kind === 'direct' && e.effect && e.effect.attrs && Object.keys(e.effect.attrs).length);
  const source = window.ADV.get()[eventIndex];
  ok(eventIndex >= 0, '存在带属性奖励的直接奇遇');
  if (source) {
    const [attrKey, initialValue] = Object.entries(source.effect.attrs)[0];
    const attrNames = { shi: '诗力', ci: '词力', lian: '联力', bi: '笔力', xue: '学力', si: '思力' };
    const nextValue = Number(initialValue) >= 5 ? Number(initialValue) - 1 : Number(initialValue) + 1;
    ok(window.Common.effectBrief(source.effect).includes(`${attrNames[attrKey]} +${initialValue}`), '奇遇列表摘要显示属性收益');
    click(document.querySelector(`#evlist [data-edit="${eventIndex}"]`));
    ok(document.getElementById('evOverlay').classList.contains('show'), '属性奇遇编辑弹窗打开');
    ok(document.getElementById('ev-result').value === source.resultText, '直接奇遇结算回声正确回填');
    const rows = document.querySelectorAll('#evEffectBox .eff-attr');
    ok(rows.length === Object.keys(source.effect.attrs).length, '已配置属性完整回填为可编辑行', rows.length);
    const row = Array.from(rows).find(x => x.querySelector('.eff-attr-k').value === attrKey);
    const valueInput = row && row.querySelector('.eff-attr-v');
    ok(!!valueInput && Number(valueInput.value) === Number(initialValue), '属性增量正确预填到数值输入框');
    if (valueInput) {
      valueInput.value = String(nextValue); fire(valueInput, 'input');
      const resultInput = document.getElementById('ev-result');
      resultInput.value = '冒烟测试：纸上新墨渐干，这次奇遇已有回声。'; fire(resultInput, 'input');
      click(document.getElementById('evPreviewBtn'));
      ok(document.getElementById('evPreviewBody').textContent.includes(`${attrNames[attrKey]} +${nextValue}`), '奇遇预览显示编辑后的属性收益');
      ok(document.getElementById('evPreviewBody').textContent.includes('这次奇遇已有回声'), '奇遇预览显示编辑后的结算回声');
      click(document.getElementById('evPreviewClose'));
      click(document.getElementById('evSave'));
      ok(window.ADV.get()[eventIndex].effect.attrs[attrKey] === nextValue, '编辑后的属性增量写入奇遇 state');
      ok(window.ADV.get()[eventIndex].resultText.includes('这次奇遇已有回声'), '直接奇遇回声写入 state');
      const savedEvents = JSON.parse(localStorage.getItem('feihua_editors_v1_events') || '[]');
      ok(savedEvents[eventIndex].effect.attrs[attrKey] === nextValue, '编辑后的属性增量持久化 localStorage');
      ok(savedEvents[eventIndex].resultText.includes('这次奇遇已有回声'), '直接奇遇回声持久化 localStorage');
    }
  }
  window.ADV.importData(window.GAME_EVENTS, true);
}

console.log('[1.8] 奇遇：选择与挑战回声在编辑器中完整往返');
{
  const choiceIndex = window.ADV.get().findIndex(e => e.kind === 'choice');
  const choice = window.ADV.get()[choiceIndex];
  window.ADV.openEditor(choiceIndex);
  const choiceResults = document.querySelectorAll('#evChoices .ev-choice-result');
  ok(choiceResults.length === choice.choices.length, '每个奇遇选项都有回声编辑框');
  ok(choiceResults[0].value === choice.choices[0].resultText, '选择回声未被规范化过程丢弃');
  click(document.getElementById('evCancel'));

  const challengeIndex = window.ADV.get().findIndex(e => e.kind === 'challenge');
  const challenge = window.ADV.get()[challengeIndex];
  window.ADV.openEditor(challengeIndex);
  ok(document.getElementById('evWinText').value === challenge.challenge.winText, '挑战全胜回声正确回填');
  ok(document.getElementById('evFailText').value === challenge.challenge.failText, '挑战未胜回声正确回填');
  click(document.getElementById('evPreviewBtn'));
  ok(document.getElementById('evPreviewBody').textContent.includes(challenge.challenge.winText), '挑战预览显示全胜回声');
  ok(document.getElementById('evPreviewBody').textContent.includes(challenge.challenge.failText), '挑战预览显示未胜回声');
  click(document.getElementById('evPreviewClose'));
  click(document.getElementById('evCancel'));
}

console.log('[2] 旧本地数据的官方文心补齐 + 编辑器列表渲染');
const t034 = window.TALENT.get().find(t => t.id === 'T034');
ok(!!t034 && t034.name === '照我传灯', '旧 localStorage 自动补齐 T034「照我传灯」');
const storedTalents = JSON.parse(localStorage.getItem('feihua_editors_v1_talents') || '[]');
ok(storedTalents.some(t => t.id === 'T034'), '补齐后的 T034 已持久化 localStorage');
const ta08 = window.TALENT.get().find(t => t.id === 'TA08');
ok(!!ta08 && ta08.name === '布局谋篇' && ta08.effect.type === 'planned_dice', '旧 localStorage 自动补齐 TA08「布局谋篇」');
ok(storedTalents.some(t => t.id === 'TA08'), '补齐后的 TA08 已持久化 localStorage');
const diceWenxin = ['T035', 'T036', 'T037', 'T038', 'T039', 'T040'].map(id => window.TALENT.get().find(t => t.id === id));
ok(diceWenxin.every(Boolean), '旧 localStorage 自动补齐 6 枚新版文心');
ok(diceWenxin.some(t => t.effect.type === 'dice_pattern') && diceWenxin.some(t => t.effect.type === 'manuscript_pct'), '新版骰组与稿本效果在编辑器中保持类型');
const upgradeCount = window.TALENT.get().filter(t => t.upgrade).length;
// 官方种子 = 主文心 + 支线文心，故升级配置键数须两侧相加（支线文心带自己的 upgrades）。
const upgradeKeys = Object.keys(window.GAME_TALENT_UPGRADE || {}).length
  + Object.keys(window.GAME_SIDEQUEST_TALENT_UPGRADE || {}).length;
ok(upgradeCount === upgradeKeys && upgradeCount >= 40, '游戏升级配置已合并到编辑器文心（含支线文心）', upgradeCount);
const t001 = window.TALENT.get().find(t => t.id === 'T001');
ok(!!t001 && t001.upgrade && t001.upgrade.maxLevel === 3 && t001.upgrade.levels.length === 2, '普通文心 T001 可升级且逐级效果完整');
const ta08Card = window.TALENT.get().find(t => t.id === 'TA08');
ok(!!ta08Card && ta08Card.cost === 5 && ta08Card.upgrade && ta08Card.upgrade.levels[0].cost === 5, '布局谋篇编辑器成本与升级配置完整');
ok(document.querySelectorAll('#afflist select.aff-cell').length === 36, '相性矩阵 36 格下拉', document.querySelectorAll('#afflist select.aff-cell').length);
ok(document.querySelectorAll('#synlist .q-card').length === 17, '羁绊列表 17 条', document.querySelectorAll('#synlist .q-card').length);
ok(document.querySelectorAll('#boardlist .board-card').length === 192 && window.BOARD.get().layout === 'concentric_spiral' && window.BOARD.get().mainRing.length === 192 && window.BOARD.get().rings.map(r => r.cells.length).join(',') === '72,64,56', '三圈地图列表 192 格（72/64/56）', document.querySelectorAll('#boardlist .board-card').length);
ok(document.querySelectorAll('#skylist .sky-card').length === 6, '天象列表 6 张', document.querySelectorAll('#skylist .sky-card').length);
ok(window.ALBUM.get().length === 12, '传世名篇默认 12 张', window.ALBUM.get().length);
ok(document.querySelectorAll('#albumlist .q-card').length === 12, '传世名篇列表 12 张', document.querySelectorAll('#albumlist .q-card').length);

console.log('[2.1] 新版骰组效果：字段可编辑并完整往返');
{
  const idx = window.TALENT.get().findIndex(t => t.id === 'T039');
  click(document.querySelector(`#tallist [data-edit="${idx}"]`));
  const pattern = document.querySelector('#tal-eff-dyn .tal-pattern');
  const reward = document.querySelector('#tal-eff-dyn .tal-reward-type');
  const pct = document.querySelector('#tal-eff-dyn .tal-value-pct');
  ok(pattern && pattern.value === 'pair', '同声相应正确回填“出现同点”条件');
  ok(reward && reward.value === 'inspiration', '同声相应正确回填灵感后续收益');
  if (pct) { pct.value = '9'; fire(pct, 'input'); }
  click(document.getElementById('talSave'));
  const saved = window.TALENT.get().find(t => t.id === 'T039');
  ok(saved && saved.effect.pattern === 'pair' && saved.effect.value === 0.09, '骰组条件与百分比修改写回 state');
  ok(saved && saved.effect.reward && saved.effect.reward.type === 'inspiration' && saved.effect.reward.value === 1, '后续收益未被保存过程丢弃');
}

console.log('[3] 相性：改矩阵格 → 状态 + localStorage 同步');
{
  const sel = document.querySelector('#afflist select.aff-cell');
  const key = sel.dataset.m + '.' + sel.dataset.t;
  sel.value = 'bad';
  fire(sel, 'change');
  ok(window.AFFINITY.get().matrix[key] === -0.08, '矩阵值写入 state');
  const saved = JSON.parse(localStorage.getItem('feihua_editors_v1_affinity'));
  ok(saved.matrix[key] === -0.08, '矩阵值持久化 localStorage');
}

console.log('[4] 羁绊：编辑改名 → 保存 → state + localStorage');
{
  click(document.querySelector('#synlist [data-edit="0"]'));
  ok(document.getElementById('synOverlay').classList.contains('show'), '编辑弹窗打开');
  const nameInput = document.getElementById('syn-name');
  nameInput.value = '冒烟测试羁绊名';
  fire(nameInput, 'input');
  click(document.getElementById('synSave'));
  ok(window.SYNERGY.get()[0].name === '冒烟测试羁绊名', '羁绊名写入 state', window.SYNERGY.get()[0].name);
  const saved = JSON.parse(localStorage.getItem('feihua_editors_v1_synergies'));
  ok(saved[0].name === '冒烟测试羁绊名', '羁绊名持久化 localStorage');
}

console.log('[5] 地图：编辑格子名 → 保存 → state + localStorage');
{
  click(document.querySelector('#boardlist [data-edit="0"]'));
  ok(document.getElementById('boardOverlay').classList.contains('show'), '格子编辑弹窗打开');
  const nameInput = document.getElementById('board-cell-name');
  nameInput.value = '冒烟测试格';
  fire(nameInput, 'input');
  click(document.getElementById('boardSave'));
  const cell0 = window.BOARD.get().mainRing.find(c => c.id === 0);
  ok(cell0.name === '冒烟测试格', '格子名写入 state', cell0.name);
  const saved = JSON.parse(localStorage.getItem('feihua_editors_v1_board'));
  ok(saved.mainRing.find(c => c.id === 0).name === '冒烟测试格', '格子名持久化 localStorage');
}

console.log('[5.1] 地图：隐藏终圈路径编辑 → 结构锁定 → 工程配置可发布');
{
  click(document.getElementById('boardBtnHidden'));
  ok(document.getElementById('boardHiddenOverlay').classList.contains('show'), '隐藏终圈编辑弹窗打开');
  ok(document.querySelectorAll('#boardHiddenCells [data-hidden-index]').length === 12, '隐藏终圈默认显示 12 格路径');
  const nameInput = document.getElementById('board-hidden-name');
  nameInput.value = '冒烟测试·桃源终圈';
  fire(nameInput, 'input');
  click(document.getElementById('boardHiddenAdd'));
  ok(document.querySelectorAll('#boardHiddenCells [data-hidden-index]').length === 13, '可在终点前新增一格路径');
  click(document.getElementById('boardHiddenSave'));
  const hidden = window.BOARD.get().hiddenFinalRing;
  ok(hidden.name === '冒烟测试·桃源终圈' && hidden.cells.length === 13, '隐藏终圈名称与路径长度写入 state');
  ok(hidden.startCellId === hidden.cells[0].id && hidden.battleCellId === hidden.cells.at(-1).id, '入口与终点标识随路径自动保持正确');
  ok(hidden.cells.slice(0, -1).every(c => c.type === 'secret_path') && hidden.cells.at(-1).type === 'battle', '仅终点保持论战格，其余为仪式路径');
  let project = null;
  try { project = window.Common.buildProject(); } catch (_) { /* 由断言给出明确失败 */ }
  ok(project && project.board.hiddenFinalRing.cells.length === 13, '编辑后的隐藏终圈仍可通过工程配置契约');
  window.BOARD.importData(window.GAME_BOARD, true);
}

console.log('[6] NPC：机制对手编辑 → id/mech 保留 → 保存 → state + localStorage');
{
  // 第 0 档第 0 名（周小满，含 mech）
  const editBtn = document.querySelector('#npclist [data-edit-npc="0:0"]');
  ok(editBtn != null, 'NPC 列表渲染（第0档首个对手可见）', editBtn ? '' : '未找到编辑按钮');
  if (editBtn) {
    click(editBtn);
    ok(document.getElementById('npcOverlay').classList.contains('show'), 'NPC 编辑弹窗打开');
    const idInput = document.getElementById('npc-id');
    const mechTa = document.getElementById('npc-mech');
    ok(idInput != null && mechTa != null, '稳定ID输入框 + 三机制文本域存在');
    ok(mechTa.value.includes('sig_style_mastery'), '机制文本域预填成功（含招牌模板）', mechTa ? mechTa.value.slice(0, 60) : '');
    ok(idInput.value === 'zhou_xiaoman', '稳定ID预填为 zhou_xiaoman', idInput.value);
    // 改 id + 微调 mech，保存
    idInput.value = 'zhou_xiaoman_v2';
    fire(idInput, 'input');
    const tx = JSON.parse(mechTa.value);
    tx.signature.pct = 0.07;
    mechTa.value = JSON.stringify(tx, null, 2);
    fire(mechTa, 'input');
    click(document.getElementById('npcSave'));
    const npc0 = window.NPC.exportRaw()[0].npcs[0];
    ok(npc0.id === 'zhou_xiaoman_v2', '保存后 id 写入 state', npc0.id);
    ok(npc0.mech && npc0.mech.signature && npc0.mech.signature.template === 'sig_style_mastery', '保存后 mech 保留');
    ok(npc0.mech.signature.pct === 0.07, '保存后 mech 参数更新（pct=0.07）', npc0.mech.signature.pct);
    const saved = JSON.parse(localStorage.getItem('feihua_editors_v1_npcs'));
    ok(saved && saved[0].npcs[0].mech && saved[0].npcs[0].mech.signature.pct === 0.07, 'mech 持久化 localStorage');
    // 还原（写回原 id/pct，避免污染后续默认）
    const restore = window.NPC.exportRaw();
    restore[0].npcs[0].id = 'zhou_xiaoman';
    restore[0].npcs[0].mech.signature.pct = 0.06;
    window.NPC.importData(restore, true);
  }
}

console.log('[6.5] NPC：三机制选项编辑 → 模板与参数同步 JSON');
{
  const editBtn = document.querySelector('#npclist [data-edit-npc="0:0"]');
  ok(editBtn != null, 'NPC 机制选项编辑入口可打开');
  if (editBtn) {
    click(editBtn);
    const box = document.getElementById('npcMechOptions');
    const sig = box && box.querySelector('[data-mech-kind="signature"] select[data-mech-field="template"]');
    ok(!!box && !!sig, '招牌机制选项面板存在');
    if (sig) {
      sig.value = 'sig_repeat_read';
      fire(sig, 'change');
      ok(JSON.parse(document.getElementById('npc-mech').value).signature.template === 'sig_repeat_read', '下拉切换招牌模板同步 JSON');
      ok(box.querySelector('[data-mech-kind="signature"] [data-mech-field="pct"]') != null, '模板切换后参数控件出现');
    }
    click(document.getElementById('npcCancel'));
    const seedRes = readFileSync(join(root, 'assets/js/seed-npcs.js'), 'utf8')
      .replace(/^[\s\S]*?window\.GAME_NPCS\s*=\s*/, '').replace(/;\s*$/, '');
    window.NPC.importData(JSON.parse(seedRes), true);
    ok(window.NPC.exportRaw()[0].npcs[0].mech.signature.template === 'sig_style_mastery', '机制选项测试后恢复种子');
  }
}

console.log('[7] NPC：非法机制 JSON 应被拦截（不能保存且不崩溃）');
{
  const editBtn = document.querySelector('#npclist [data-edit-npc="0:0"]');
  if (editBtn) {
    click(editBtn);
    const mechTa = document.getElementById('npc-mech');
    const savedBefore = JSON.stringify(window.NPC.exportRaw()[0].npcs[0].mech);
    mechTa.value = '{ not valid json';
    fire(mechTa, 'input');
    click(document.getElementById('npcSave'));
    ok(document.getElementById('npcOverlay').classList.contains('show'), '非法 JSON 保存被拦截（弹窗未关闭）');
    ok(JSON.stringify(window.NPC.exportRaw()[0].npcs[0].mech) === savedBefore, '非法 JSON 未污染存档');
    // 还原为种子配置（重置测试改动）
    click(document.getElementById('npcCancel'));
    const seedRes = readFileSync(join(root, 'assets/js/seed-npcs.js'), 'utf8')
      .replace(/^[\s\S]*?window\.GAME_NPCS\s*=\s*/, '').replace(/;\s*$/, '');
    window.NPC.importData(JSON.parse(seedRes), true);
    ok(window.NPC.exportRaw()[0].npcs[0].id === 'zhou_xiaoman', '重置回种子数据（zhou_xiaoman）', window.NPC.exportRaw()[0].npcs[0].id);
  }
}

console.log('[7.5] NPC：出战权重字段编辑往返 + 0 校验');
{
  function openFirstNpc() {
    const btn = document.querySelector('#npclist [data-edit-npc="0:0"]');
    if (btn) click(btn);
    return btn != null;
  }
  // 打开第 0 档第 0 名（周小满）
  const opened = openFirstNpc();
  ok(opened, 'NPC 列表渲染（第0档首个对手可见）');
  if (opened) {
    const wIn = document.getElementById('npc-weight');
    ok(wIn != null, 'NPC 编辑弹窗含「出战权重」输入框');
    // 填一个高权重，保存
    wIn.value = '600';
    fire(wIn, 'input'); fire(wIn, 'change');
    click(document.getElementById('npcSave'));
    let npc0 = window.NPC.exportRaw()[0].npcs[0];
    ok(npc0.weight === 600, '保存后 weight=600 写入 state', npc0.weight);
    const saved = JSON.parse(localStorage.getItem('feihua_editors_v1_npcs'));
    ok(saved && saved[0].npcs[0].weight === 600, '权重持久化 localStorage', saved && saved[0].npcs[0].weight);
    // 改 0 = 本阶段不出战（重新打开，获取新按钮引用）
    ok(openFirstNpc(), '再次打开 NPC 编辑弹窗');
    let w2 = document.getElementById('npc-weight');
    ok(w2.value === '600', '弹窗预填上次权重 600', w2.value);
    w2.value = '0';
    fire(w2, 'input'); fire(w2, 'change');
    click(document.getElementById('npcSave'));
    npc0 = window.NPC.exportRaw()[0].npcs[0];
    ok(npc0.weight === 0, 'weight=0（不出战）保留为 0', npc0.weight);
    // 清空 → 视为默认（回退 undefined）
    ok(openFirstNpc(), '第三次打开 NPC 编辑弹窗');
    const w3 = document.getElementById('npc-weight');
    w3.value = '';
    fire(w3, 'input'); fire(w3, 'change');
    click(document.getElementById('npcSave'));
    npc0 = window.NPC.exportRaw()[0].npcs[0];
    ok(npc0.weight == null, '清空权重 → undefined（引擎按默认 100）', JSON.stringify(npc0.weight));
    // 还原为种子（不留脏数据）
    const seedRes = readFileSync(join(root, 'assets/js/seed-npcs.js'), 'utf8')
      .replace(/^[\s\S]*?window\.GAME_NPCS\s*=\s*/, '').replace(/;\s*$/, '');
    window.NPC.importData(JSON.parse(seedRes), true);
  } else {
    ok(false, 'NPC 列表渲染（未找到编辑按钮，跳过权重用例）');
  }
}

console.log('[7.55] NPC：新增/旧缓存自动补齐稳定 ID，确保可被游戏唯一追踪');
{
  const legacy = window.NPC.exportRaw();
  const oldKang = legacy.flatMap(tier => tier.npcs).find(npc => npc.name === '康尔玉');
  if (oldKang) oldKang.id = '';
  window.NPC.importData(legacy, true);
  const repairedKang = window.NPC.exportRaw().flatMap(tier => tier.npcs).find(npc => npc.name === '康尔玉');
  ok(repairedKang?.id === 'kang_er_yu', '旧缓存的康尔玉按名称恢复官方稳定 ID', repairedKang?.id);

  const add = document.querySelector('#npclist [data-add-npc="0"]');
  ok(!!add, '新增对手入口存在');
  if (add) {
    click(add);
    const id = document.getElementById('npc-id');
    const name = document.getElementById('npc-name');
    ok(/^npc_[a-z0-9_-]+_\d+$/.test(id.value), '新增对手预填自动稳定 ID', id.value);
    name.value = 'ID 回归对手'; fire(name, 'input');
    id.value = ''; fire(id, 'input'); // 验证手动清空仍会在保存时补齐
    click(document.getElementById('npcSave'));
    const created = window.NPC.exportRaw()[0].npcs.find(npc => npc.name === 'ID 回归对手');
    ok(!!created?.id && /^npc_[a-z0-9_-]+_\d+$/.test(created.id), '清空 ID 后保存仍自动生成稳定 ID', created?.id);
    const ids = window.NPC.exportRaw().flatMap(tier => tier.npcs).map(npc => npc.id);
    ok(new Set(ids).size === ids.length, '编辑器内 NPC ID 保持全局唯一');
  }
  window.NPC.importData(window.GAME_NPCS, true);
}

console.log('[7.6] NPC：本阶段必遇条件可视化编辑 + 保存往返');
{
  const tiers = window.NPC.exportRaw();
  let kang = null;
  tiers.some((tier, ti) => tier.npcs.some((npc, ni) => {
    if (npc.id === 'kang_er_yu') { kang = { ti, ni, npc }; return true; }
    return false;
  }));
  ok(!!kang, '种子数据包含康尔玉');
  if (kang) {
    const btn = document.querySelector(`[data-edit-npc="${kang.ti}:${kang.ni}"]`);
    ok(!!btn, '康尔玉编辑入口存在');
    if (btn) {
      click(btn);
      const enabled = document.getElementById('npc-palace-force-enabled');
      const primary = document.getElementById('npc-palace-primary');
      const min = document.getElementById('npc-palace-min-exclusive');
      ok(enabled && enabled.checked, '殿试必遇开关正确回填');
      ok(primary && primary.value === 'lian', '主属性回填为联力');
      ok(min && min.value === '35', '阈值回填为 35');
      ok(document.querySelector('[data-palace-compare="shi"]')?.checked && document.querySelector('[data-palace-compare="ci"]')?.checked, '诗力/词力严格高于条件正确回填');
      click(document.getElementById('npcSave'));
      const savedKang = window.NPC.exportRaw()[kang.ti].npcs[kang.ni];
      ok(savedKang.stageForcedWhen && savedKang.stageForcedWhen.primary === 'lian', '保存后通用本阶段条件保留');
      ok(savedKang.palaceForcedWhen && savedKang.palaceForcedWhen.primary === 'lian', '保存后主属性条件保留');
      ok(savedKang.palaceForcedWhen.minExclusive === 35, '保存后阈值条件保留');
      ok(JSON.stringify(savedKang.palaceForcedWhen.strictlyHigherThan) === JSON.stringify(['shi', 'ci']), '保存后严格高于条件保留');
      const saved = JSON.parse(localStorage.getItem('feihua_editors_v1_npcs'));
      ok(saved[kang.ti].npcs[kang.ni].palaceForcedWhen.minExclusive === 35, '殿试必遇条件持久化 localStorage');
      const seedRes = readFileSync(join(root, 'assets/js/seed-npcs.js'), 'utf8')
        .replace(/^[\s\S]*?window\.GAME_NPCS\s*=\s*/, '').replace(/;\s*$/, '');
      window.NPC.importData(JSON.parse(seedRes), true);
    }
  }
}

console.log('[8] 文心 ↔ 奇遇双向关联：建立 / 重复 / 冲突 / 取消 / 持久化');
{
  const tid = 'T034';
  const ev = window.ADV.get().find(e => e.kind === 'direct' && e.effect && !e.effect.talent);
  ok(!!ev, '找到可关联的直接奖励奇遇');
  if (ev) {
    let r = window.ADV.linkTalent(tid, ev.id, 'direct');
    ok(r.ok && r.code === 'LINKED', '文心侧建立关联成功', r.message);
    ok(ev.effect.talent === tid, '奇遇侧立即显示 T034 关联');
    ok(window.ADV.listTalentLinks(tid).some(x => x.eventId === ev.id && x.target === 'direct'), '文心侧来源列表立即包含该奇遇');
    const saved = JSON.parse(localStorage.getItem('feihua_editors_v1_events'));
    ok(saved.some(x => x.id === ev.id && x.effect && x.effect.talent === tid), '关联结果持久化 localStorage');
    r = window.ADV.linkTalent(tid, ev.id, 'direct');
    ok(!r.ok && r.code === 'DUPLICATE', '重复关联被拒绝');
    r = window.ADV.linkTalent('T001', ev.id, 'direct');
    ok(!r.ok && r.code === 'CONFLICT', '已有不同文心时拒绝覆盖');
    r = window.ADV.unlinkTalent(tid, ev.id, 'direct');
    ok(r.ok && r.code === 'UNLINKED' && !ev.effect.talent, '取消关联成功且两侧同步');
    r = window.ADV.unlinkTalent(tid, ev.id, 'direct');
    ok(!r.ok && r.code === 'NOT_LINKED', '重复取消关联被拒绝');
    r = window.ADV.linkTalent(tid, 'NO_SUCH_EVENT', 'direct');
    ok(!r.ok && r.code === 'INVALID_TARGET', '无效奇遇引用被拒绝');
    const wasReady = window.ADV._ready;
    window.ADV._ready = false;
    r = window.ADV.linkTalent(tid, ev.id, 'direct');
    ok(!r.ok && r.code === 'PERMISSION_DENIED', '未初始化/无权限时拒绝操作');
    window.ADV._ready = wasReady;
  }
  const tIndex = window.TALENT.get().findIndex(t => t.id === tid);
  const editBtn = document.querySelector(`#tallist [data-edit="${tIndex}"]`);
  ok(!!editBtn, '文心列表存在 T034 编辑入口');
  if (editBtn) {
    click(editBtn);
    ok(document.getElementById('talOverlay').classList.contains('show'), '关联操作位于文心编辑弹窗');
    ok(document.getElementById('talLinksBox').innerHTML.includes('关联奇遇编辑器'), '编辑弹窗显示关联奇遇面板');
    click(document.getElementById('talPreviewBtn'));
    ok(!document.getElementById('talPreviewBody').querySelector('[data-link-talent]'), '预览弹窗不再提供关联操作');
    click(document.getElementById('talPreviewClose'));
    click(document.getElementById('talCancel'));
  }
}

console.log('[9] 数据管理面板（含 board 总览）不崩溃');
{
  window.Common.showManagement();
  ok(document.getElementById('mgmtBody').innerHTML.includes('地图（主环 / 区段）'), '总览含地图区块');
  ok(document.getElementById('mgmtBody').innerHTML.includes('主环格数'), '地图统计渲染');
}

console.log('[10] 传世名篇：编辑名称 → 保存 → state + localStorage');
{
  const btn = document.querySelector('#albumlist [data-album-edit="0"]');
  ok(!!btn, '传世名篇编辑入口存在');
  if (btn) {
    click(btn);
    const name = document.getElementById('album-name');
    name.value = '冒烟测试名篇'; fire(name, 'input');
    click(document.getElementById('albumSave'));
    ok(window.ALBUM.get()[0].name === '冒烟测试名篇', '名篇名称写入 state');
    const saved = JSON.parse(localStorage.getItem('feihua_editors_v1_album'));
    ok(saved[0].name === '冒烟测试名篇', '名篇持久化 localStorage');
    const restored = window.ALBUM.exportRaw(); restored[0].name = '仰天大笑'; window.ALBUM.importData(restored, true);
  }
}

console.log('[11] 天象：编辑名称 + 图标 → 保存 → state + localStorage');
{
  click(document.querySelector('#skylist [data-edit="0"]'));
  ok(document.getElementById('skyOverlay').classList.contains('show'), '天象编辑弹窗打开');
  ok(window.IconLibrary && window.IconLibrary.groups.some(g => g.id === 'sky'), '内容图标库已加载并包含天象分组');
  ok(window.IconLibrary.groups.find(g => g.id === 'sky').items.length >= 18, '天象图标库至少提供 18 个可选图标');
  ok(document.querySelectorAll('#sky-iconPicker .icon-picker-btn').length >= 25, '天象编辑器渲染天象与内容扩展图标');
  const nameInput = document.getElementById('sky-name');
  nameInput.value = '冒烟测试天象';
  fire(nameInput, 'input');
  const iconInput = document.getElementById('sky-icon');
  const sunIcon = [...document.querySelectorAll('#sky-iconPicker .icon-picker-btn')].find(button => button.dataset.iconValue === '☀️');
  ok(!!sunIcon, '天象图标库包含晴日图标');
  if (sunIcon) { click(sunIcon); ok(iconInput.value === '☀️', '点击图标库会回填天象 icon'); }
  iconInput.value = '🌟';
  fire(iconInput, 'input');
  click(document.getElementById('skySave'));
  ok(window.SKY.get()[0].name === '冒烟测试天象', '天象名写入 state', window.SKY.get()[0].name);
  ok(window.SKY.get()[0].icon === '🌟', '天象图标写入 state', window.SKY.get()[0].icon);
  const saved = JSON.parse(localStorage.getItem('feihua_editors_v1_sky'));
  ok(saved[0].name === '冒烟测试天象', '天象名持久化 localStorage');
  ok(saved[0].icon === '🌟', '天象图标持久化 localStorage');
  // 还原（避免污染默认种子）
  const seedRes = readFileSync(join(root, 'assets/js/seed-sky.js'), 'utf8')
    .replace(/^[\s\S]*?window\.GAME_SKY\s*=\s*/, '').replace(/;\s*$/, '');
  window.SKY.importData(JSON.parse(seedRes), true);
  ok(window.SKY.get()[0].name === '月圆之夜', '重置回种子数据（月圆之夜）', window.SKY.get()[0].name);
}

console.log('[12] 叙事文案编辑器：初始化 / 列表渲染 / 内联编辑 → state + localStorage / 导出');
{
  const copy = window.COPY;
  ok(!!copy && copy._ready === true, 'COPY 模块已初始化');
  ok(copy.get().schools.length === 3, '流派文案默认 3 条', copy.get().schools.length);
  ok(Object.keys(copy.get().grades.comments || {}).length === 6, '维度评语默认 6 条', Object.keys(copy.get().grades.comments || {}).length);
  ok(document.querySelectorAll('#copylist .q-card').length >= 18, '文案卡片渲染（流派3+评语6+段位9+评分≥？）', document.querySelectorAll('#copylist .q-card').length);

  // 内联编辑：流派「博闻」的 flavor 字段
  const ta = document.querySelector('#copylist textarea[data-path="schools.0.flavor"]');
  ok(ta != null, '流派 flavor 文本域存在');
  if (ta) {
    ta.value = '冒烟测试·沉浸叙事';
    fire(ta, 'input');
    // 等待自动保存防抖（400ms）
    await new Promise(r => setTimeout(r, 500));
    ok(copy.get().schools[0].flavor === '冒烟测试·沉浸叙事', '流派 flavor 写入 state', copy.get().schools[0].flavor);
    const saved = JSON.parse(localStorage.getItem('feihua_editors_v1_copy_schools') || '[]');
    ok(saved[0] && saved[0].flavor === '冒烟测试·沉浸叙事', '流派 flavor 持久化 localStorage');
    // 导出 schools.json 应含该改动，且保留 mechanics（不破坏数值）
    const exported = copy.exportSchoolsRaw();
    ok(exported[0].flavor === '冒烟测试·沉浸叙事', '导出 schools.json 含改动');
    ok(exported[0].schoolMechanics && exported[0].schoolMechanics.type === 'bowen', '导出保留 schoolMechanics（未破坏机制）', exported[0].schoolMechanics && exported[0].schoolMechanics.type);
    ok(exported[0].motto && exported[0].desc, '导出保留 motto/desc 等其他文案字段');
    // 还原（避免污染默认种子）
    copy.importData({ schools: window.GAME_SCHOOLS }, true);
    ok(copy.get().schools[0].flavor === window.GAME_SCHOOLS[0].flavor, '重置回种子（flavor 还原）', copy.get().schools[0].flavor);
  }

  // 段位评语内联编辑
  const ct = document.querySelector('#copylist textarea[data-path="grades.comments.wencai"]');
  ok(ct != null, '文采分评语文本域存在');
  if (ct) {
    ct.value = '冒烟测试·文采评语';
    fire(ct, 'input');
    await new Promise(r => setTimeout(r, 500));
    ok(copy.get().grades.comments.wencai === '冒烟测试·文采评语', '维度评语写入 state', copy.get().grades.comments.wencai);
    const savedG = JSON.parse(localStorage.getItem('feihua_editors_v1_copy_grades') || '{}');
    ok(savedG.comments && savedG.comments.wencai === '冒烟测试·文采评语', '维度评语持久化 localStorage');
    // 导出 grades.json 保留维度公式/门槛（未破坏数值）
    const exg = copy.exportGradesRaw();
    ok(exg.dimensions && exg.dimensions[0].formula && exg.dimensions[0].coeff, '导出 grades.json 保留维度公式/系数');
    ok(Array.isArray(exg.grades) && exg.grades.length === 9, '导出 grades.json 保留 9 个段位档');
    const seedGrades = window.GAME_GRADES;
    copy.importData({ grades: seedGrades }, true);
    ok(copy.get().grades.comments.wencai === seedGrades.comments.wencai, '段位评语重置回种子');
  }

  // 叙事弹窗文案（narrative）：默认 5 组 + 内联编辑 → state + localStorage + 导出保留结构
  {
    const N = copy.get().narrative || {};
    ok(!!(N.prologue && N.zeitgeist && N.stageChange && N.lap2Intro && N.hiddenFinal), '叙事弹窗默认含 5 组（含隐藏终圈）', Object.keys(N).join('/'));
    ok(document.querySelectorAll('#copylist textarea[data-path^="narrative."]').length >= 30, '叙事弹窗字段渲染（含隐藏终圈）', document.querySelectorAll('#copylist textarea[data-path^="narrative."]').length);
    const hiddenText = document.querySelector('#copylist textarea[data-path="narrative.hiddenFinal.victory.text"]');
    ok(hiddenText != null, '隐藏终圈胜利文案文本域存在');
    if (hiddenText) {
      hiddenText.value = '冒烟测试·桃源终章';
      fire(hiddenText, 'input');
      await new Promise(r => setTimeout(r, 500));
      ok(copy.get().narrative.hiddenFinal.victory.text === '冒烟测试·桃源终章', '隐藏终圈胜利文案写入 state');
      ok(copy.exportNarrativeRaw().hiddenFinal.victory.text === '冒烟测试·桃源终章', '导出 narrative.json 含隐藏终圈改动');
      copy.importData({ narrative: window.GAME_NARRATIVE }, true);
    }
    const np = document.querySelector('#copylist textarea[data-path="narrative.prologue.text"]');
    ok(np != null, '开局序章正文文本域存在');
    if (np) {
      np.value = '冒烟测试·序章正文';
      fire(np, 'input');
      await new Promise(r => setTimeout(r, 500));
      ok(copy.get().narrative.prologue.text === '冒烟测试·序章正文', '序章正文写入 state', copy.get().narrative.prologue.text);
      const savedN = JSON.parse(localStorage.getItem('feihua_editors_v1_copy_narrative') || '{}');
      ok(savedN.prologue && savedN.prologue.text === '冒烟测试·序章正文', '序章正文持久化 localStorage');
      const exn = copy.exportNarrativeRaw();
      ok(exn.prologue.text === '冒烟测试·序章正文', '导出 narrative.json 含改动');
      ok(exn.stageChange && exn.stageChange.names && exn.stageChange.names.jinshi === '进士', '导出保留 stageChange.names 结构（未破坏机制映射）', exn.stageChange && exn.stageChange.names && exn.stageChange.names.jinshi);
      ok(exn.stageChange.titleTpl && exn.stageChange.titleTpl.includes('{name}'), '导出保留 {name} 占位模板');
      const seedN = window.GAME_NARRATIVE;
      copy.importData({ narrative: seedN }, true);
      ok(copy.get().narrative.prologue.text === seedN.prologue.text, '叙事弹窗重置回种子');
    }
  }
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
