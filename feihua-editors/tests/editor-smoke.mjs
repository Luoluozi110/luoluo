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

// 把 <script src> 替换为内联脚本（jsdom 不主动加载本地资源），保持原有加载顺序
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const code = readFileSync(join(root, src), 'utf8');
  return `<script>\n${code}\n</script>`;
});

const dom = new JSDOM(html, {
  url: 'https://editor.local/',
  runScripts: 'dangerously',
  pretendToBeVisual: true
});
const { window } = dom;
const { document, localStorage } = window;

// 模拟已经使用过旧版编辑器的浏览器：localStorage 里有旧文心，唯独没有新发布的 T034 / TA08。
// 必须在 DOMContentLoaded 触发前写入，才能覆盖模块 init() 的真实加载路径。
const oldTalents = (window.GAME_TALENTS || []).filter(t => !['T034', 'TA08'].includes(t.id));
localStorage.setItem('feihua_editors_v1_talents', JSON.stringify(oldTalents));
// 同时模拟隐藏终圈上线前的编辑器缓存：三份旧数据都没有新增的系统字段。
const oldBoard = JSON.parse(JSON.stringify(window.GAME_BOARD || {}));
delete oldBoard.hiddenFinalRing;
localStorage.setItem('feihua_editors_v1_board', JSON.stringify(oldBoard));
const oldNpcs = (window.GAME_NPCS || []).filter(t => !t.isHiddenFinal);
localStorage.setItem('feihua_editors_v1_npcs', JSON.stringify(oldNpcs));
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

console.log('[2] 旧本地数据的官方文心补齐 + 编辑器列表渲染');
const t034 = window.TALENT.get().find(t => t.id === 'T034');
ok(!!t034 && t034.name === '照我传灯', '旧 localStorage 自动补齐 T034「照我传灯」');
const storedTalents = JSON.parse(localStorage.getItem('feihua_editors_v1_talents') || '[]');
ok(storedTalents.some(t => t.id === 'T034'), '补齐后的 T034 已持久化 localStorage');
const ta08 = window.TALENT.get().find(t => t.id === 'TA08');
ok(!!ta08 && ta08.name === '布局谋篇' && ta08.effect.type === 'planned_dice', '旧 localStorage 自动补齐 TA08「布局谋篇」');
ok(storedTalents.some(t => t.id === 'TA08'), '补齐后的 TA08 已持久化 localStorage');
const upgradeCount = window.TALENT.get().filter(t => t.upgrade).length;
ok(upgradeCount === Object.keys(window.GAME_TALENT_UPGRADE || {}).length && upgradeCount >= 40, '游戏升级配置已合并到编辑器文心', upgradeCount);
const t001 = window.TALENT.get().find(t => t.id === 'T001');
ok(!!t001 && t001.upgrade && t001.upgrade.maxLevel === 3 && t001.upgrade.levels.length === 2, '普通文心 T001 可升级且逐级效果完整');
const ta08Card = window.TALENT.get().find(t => t.id === 'TA08');
ok(!!ta08Card && ta08Card.cost === 5 && ta08Card.upgrade && ta08Card.upgrade.levels[0].cost === 5, '布局谋篇编辑器成本与升级配置完整');
ok(document.querySelectorAll('#afflist select.aff-cell').length === 36, '相性矩阵 36 格下拉', document.querySelectorAll('#afflist select.aff-cell').length);
ok(document.querySelectorAll('#synlist .q-card').length === 9, '羁绊列表 9 条', document.querySelectorAll('#synlist .q-card').length);
ok(document.querySelectorAll('#boardlist .board-card').length === 192 && window.BOARD.get().layout === 'concentric_spiral' && window.BOARD.get().mainRing.length === 192 && window.BOARD.get().rings.map(r => r.cells.length).join(',') === '72,64,56', '三圈地图列表 192 格（72/64/56）', document.querySelectorAll('#boardlist .board-card').length);
ok(document.querySelectorAll('#skylist .sky-card').length === 6, '天象列表 6 张', document.querySelectorAll('#skylist .sky-card').length);
ok(window.ALBUM.get().length === 12, '传世名篇默认 12 张', window.ALBUM.get().length);
ok(document.querySelectorAll('#albumlist .q-card').length === 12, '传世名篇列表 12 张', document.querySelectorAll('#albumlist .q-card').length);

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
  const nameInput = document.getElementById('sky-name');
  nameInput.value = '冒烟测试天象';
  fire(nameInput, 'input');
  const iconInput = document.getElementById('sky-icon');
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
