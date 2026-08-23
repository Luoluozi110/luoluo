/* 文心升级编辑器回归：真实载入 index.html + 全部脚本（jsdom），
 * 端到端驱动「新增文心 → 勾选可升级 → 选品质 rare → 保存 → 导出 talent-upgrade.json」，
 * 捕获导出 JSON，并用游戏引擎 leveledTalent / upgradeTalent 的真实取值契约逐条校验。
 * 同时验证「导入 talent-upgrade.json 回填」的往返一致性。 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const { JSDOM } = require('C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let html = readFileSync(join(root, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const code = readFileSync(join(root, src.split('?')[0]), 'utf8');
  return `<script>\n${code}\n</script>`;
});

const dom = new JSDOM(html, { url: 'https://editor.local/', runScripts: 'dangerously', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
// jsdom 未实现 URL.createObjectURL；导出时仅用于构造 <a download>，与 JSON 内容无关，打桩即可
window.URL.createObjectURL = () => 'blob:stub';
window.URL.revokeObjectURL = () => {};
await new Promise(res => {
  if (document.readyState !== 'loading') return res();
  window.addEventListener('DOMContentLoaded', res, { once: true });
});

let pass = 0, fail = 0;
const ok = (c, n, e) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (e != null ? `（${e}）` : '')); } };
const fire = (el, t) => el.dispatchEvent(new window.Event(t, { bubbles: true }));
const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

// 捕获 Blob 内容（exportUpgrade 用 new Blob([JSON.stringify(out)])）
let captured = null;
window.Blob = class { constructor(parts) { captured = parts.join(''); } };

// ---- [1] 模块就绪 ----
console.log('[1] 文心模块就绪');
ok(window.TALENT && window.TALENT._ready === true, 'TALENT._ready');

// ---- [2] 注入一枚合法基础文心 ----
console.log('[2] 注入基础文心 T_UP_TEST');
const base = { id: 'T_UP_TEST', name: '冒烟升级文心', kind: 'passive', text: '用于升级冒烟测试',
  effect: { type: 'on_win_bonus', style: 'shi', value: 2 } };
window.TALENT.importData([base], true);
ok(window.TALENT.get().some(t => t.id === 'T_UP_TEST'), '已载入 T_UP_TEST');

// ---- [3] 打开编辑 → 勾选可升级 → 选品质 rare → 保存 ----
console.log('[3] UI 驱动：勾选可升级 + 选品质 rare(满级 4) + 保存');
click(document.querySelector('#tallist [data-edit="0"]'));
ok(document.getElementById('talOverlay').classList.contains('show'), '编辑弹窗打开');
const upOn = document.getElementById('tal-upgrade-on');
upOn.checked = true; fire(upOn, 'change');
ok(!!window.TALENT.get()[0], '弹窗状态存在');
const qSel = document.getElementById('tal-quality');
ok(qSel != null, '品质下拉已渲染');
qSel.value = 'rare'; fire(qSel, 'change');
click(document.getElementById('talSave'));
const saved = window.TALENT.get()[0];
ok(saved.upgrade != null, '已写入 upgrade');
ok(saved.upgrade && saved.upgrade.quality === 'rare', '品质 = rare');
ok(saved.upgrade && saved.upgrade.maxLevel === 4, 'maxLevel 自动 = 4（rare 档）', saved.upgrade && saved.upgrade.maxLevel);
ok(saved.upgrade && saved.upgrade.upCost.length === 3, 'upCost 项数 = maxLevel-1 = 3', saved.upgrade && saved.upgrade.upCost.length);
ok(saved.upgrade && saved.upgrade.levels.length === 3, '逐级 levels 项数 = maxLevel-1 = 3（Lv1 不存，导出时回填）', saved.upgrade && saved.upgrade.levels.length);

// ---- [3.5] 回归：全新/无升级文心「勾选可升级」后，逐级效果编辑器应立刻可见并可编辑 ----
console.log('[3.5] 回归：无升级文心勾选升级 → 逐级效果编辑器立即可见可编辑');
{
  // 重置为基础文心（不含 upgrade）
  window.TALENT.importData([JSON.parse(JSON.stringify(base))], true);
  click(document.querySelector('#tallist [data-edit="0"]'));
  document.getElementById('tal-upgrade-on').checked = true;
  fire(document.getElementById('tal-upgrade-on'), 'change');
  const maxLv = Number(document.getElementById('tal-maxlevel').value || 3);
  const lvBlocks = document.querySelectorAll('#talUpgradeLevels .lvl-eff').length;
  ok(lvBlocks === maxLv - 1,
     '逐级效果编辑器数量 = maxLevel-1（' + (maxLv - 1) + '），立即可见（修复「levels 未初始化补全」）',
     lvBlocks);
  const firstType = document.querySelector('#talUpgradeLevels [data-lvl="0"] .tal-eff-type');
  ok(!!firstType, 'Lv2 效果类型下拉已渲染');
  // 切类型 + 改值并保存，验证该级效果真实可编辑落库
  if (firstType) { firstType.value = 'insp_on_win'; fire(firstType, 'change'); }
  const lv2v = document.querySelector('#talUpgradeLevels [data-lvl="0"] .lvl-eff-dyn .tal-value');
  if (lv2v) { lv2v.value = '6'; fire(lv2v, 'input'); fire(lv2v, 'change'); }
  click(document.getElementById('talSave'));
  const s3 = window.TALENT.get().find(x => x.id === 'T_UP_TEST');
  ok(s3 && s3.upgrade && s3.upgrade.levels[0].effect.type === 'insp_on_win'
     && Number(s3.upgrade.levels[0].effect.value) === 6,
     'Lv2 效果可编辑并持久化（type=insp_on_win, value=6）',
     s3 && s3.upgrade && JSON.stringify(s3.upgrade.levels[0].effect));
  // 恢复为升级数据以便后续导出校验（重新走一遍 [3] 的升级流程）
  window.TALENT.importData([JSON.parse(JSON.stringify(base))], true);
  click(document.querySelector('#tallist [data-edit="0"]'));
  document.getElementById('tal-upgrade-on').checked = true;
  fire(document.getElementById('tal-upgrade-on'), 'change');
  const q2 = document.getElementById('tal-quality'); q2.value = 'rare'; fire(q2, 'change');
  click(document.getElementById('talSave'));
}

// ---- [3.6] 回归：品质切换（common→legend）后逐级效果编辑器随 maxLevel 补全 ----
console.log('[3.6] 回归：品质切换 common→legend 后逐级编辑器随 maxLevel 补全');
{
  window.TALENT.importData([JSON.parse(JSON.stringify(base))], true);
  click(document.querySelector('#tallist [data-edit="0"]'));
  const on = document.getElementById('tal-upgrade-on');
  on.checked = true; fire(on, 'change');
// 品质切换会整体重渲染升级面板（select 被替换），故每次都需重新查询元素
const setQ = v => { const sel = document.getElementById('tal-quality'); sel.value = v; fire(sel, 'change'); };
setQ('common');
const blocksCommon = document.querySelectorAll('#talUpgradeLevels .lvl-eff').length;
ok(blocksCommon === 2, 'common(maxLevel=3) 逐级效果块数 = 2', blocksCommon);
setQ('legend');
  const blocksLegend = document.querySelectorAll('#talUpgradeLevels .lvl-eff').length;
  ok(blocksLegend === 5, 'legend(maxLevel=6) 逐级效果块数 = 5（修复「高品质只能编辑前两级」）', blocksLegend);
  click(document.getElementById('talSave'));
  const sv = window.TALENT.get().find(x => x.id === 'T_UP_TEST');
  ok(sv && sv.upgrade && sv.upgrade.levels.length === 5,
     '保存后 levels 项数 = maxLevel-1 = 5（levels 随品质补全）',
     sv && sv.upgrade && sv.upgrade.levels.length);
}

// ---- [3.7] 回归：改逐级效果数值/类型后，样式预览文案及时同步 ----
console.log('[3.7] 回归：逐级效果修改后样式预览文案同步');
{
  // 编辑刚保存的 legend 文心，改 Lv2 数值与类型，观察样式面板预览文本
  click(document.querySelector('#tallist [data-edit="0"]'));
  const lv2v = document.querySelector('#talUpgradeLevels [data-lvl="0"] .lvl-eff-dyn .tal-value');
  ok(!!lv2v, 'Lv2 数值输入框存在');
  if (lv2v) { lv2v.value = '9'; fire(lv2v, 'input'); fire(lv2v, 'change'); }
  const prev1 = document.getElementById('talStylePrev-1');
  ok(prev1 && prev1.textContent.includes('+9'),
     '改 Lv2 value=9 后样式预览含「+9」（修复「文案不同步」）',
     prev1 && prev1.textContent);
  const lv2t = document.querySelector('#talUpgradeLevels [data-lvl="0"] .tal-eff-type');
  if (lv2t) { lv2t.value = 'dice_plus'; fire(lv2t, 'change'); }
  const prev1b = document.getElementById('talStylePrev-1');
  ok(prev1b && prev1b.textContent.includes('灵感骰'),
     '改 Lv2 类型为 dice_plus 后预览刷新为「灵感骰…」（类型切换同步）',
     prev1b && prev1b.textContent);
  // 基础效果数值修改也应同步 Lv1 预览（talStylePrev-0）
  const baseV = document.querySelector('#tal-eff-dyn .tal-value');
  if (baseV) { baseV.value = '7'; fire(baseV, 'input'); fire(baseV, 'change'); }
  const prev0 = document.getElementById('talStylePrev-0');
  ok(prev0 && prev0.textContent.includes('+7'),
     '改基础效果 value=7 后 Lv1 样式预览含「+7」',
     prev0 && prev0.textContent);
  // 恢复 [4] 所需的 rare 升级状态
  window.TALENT.importData([JSON.parse(JSON.stringify(base))], true);
  click(document.querySelector('#tallist [data-edit="0"]'));
  document.getElementById('tal-upgrade-on').checked = true;
  fire(document.getElementById('tal-upgrade-on'), 'change');
  const q3 = document.getElementById('tal-quality'); q3.value = 'rare'; fire(q3, 'change');
  click(document.getElementById('talSave'));
}

// ---- [4] 导出 talent-upgrade.json 并捕获 ----
console.log('[4] 导出并捕获 talent-upgrade.json');
click(document.getElementById('talBtnExportUpgrade'));
ok(captured != null, '导出产生 JSON 文本');
const json = captured ? JSON.parse(captured) : null;
ok(json && json.T_UP_TEST != null, '导出含 T_UP_TEST');
const up = json && json.T_UP_TEST;
ok(up && up.maxLevel === 4, '导出 maxLevel = 4');
ok(up && up.upCost.length === 3, '导出 upCost 长度 = 3');
ok(up && up.levels.length === 4, '导出 levels 长度 = maxLevel = 4（含 Lv1）', up && up.levels.length);

// ---- [5] 用引擎契约逐条校验（与 game.js leveledTalent / upgradeTalent 完全一致） ----
console.log('[5] 引擎契约校验（leveledTalent / upgradeTalent）');
ok(up && JSON.stringify(up.levels[0].effect) === JSON.stringify(base.effect),
   'Lv1 恒等于基础 effect（消除「改基础不生效」陷阱）',
   up && JSON.stringify(up.levels[0].effect) + ' vs ' + JSON.stringify(base.effect));
// leveledTalent(talent, level) => up.levels[level-1].effect
let lvlOk = true;
for (let L = 1; L <= up.maxLevel; L++) {
  if (JSON.stringify(up.levels[L - 1].effect) == null) lvlOk = false;
}
ok(lvlOk, 'levels[level-1] 对 1..maxLevel 均可索引（leveledTalent 取值不越界）');
// upgradeTalent：从 L 升到 L+1 的成本 = upCost[L-1]，新效果 = levels[L].effect
let upOk = true;
for (let L = 1; L < up.maxLevel; L++) {
  const cost = up.upCost[L - 1];      // 升到 L+1 的成本
  const newEff = up.levels[(L + 1) - 1].effect; // 新等级效果
  if (cost == null || newEff == null) upOk = false;
}
ok(upOk, 'upCost[level-1] 与 levels[level] 配对完整（upgradeTalent 取值契约）');

// ---- [6] 导入回填往返一致性 ----
console.log('[6] 导入 talent-upgrade.json 回填往返');
// 重置为无升级的基础文心
window.TALENT.importData([JSON.parse(JSON.stringify(base))], true);
ok(window.TALENT.get()[0].upgrade == null, '重置后 upgrade 为空');
window.TALENT.importUpgrade({ T_UP_TEST: up }, true);
const restored = window.TALENT.get()[0];
ok(restored.upgrade != null, '回填后含 upgrade');
ok(restored.upgrade && restored.upgrade.quality === 'rare', '回填 quality 一致');
ok(restored.upgrade && restored.upgrade.maxLevel === 4, '回填 maxLevel 一致');
ok(restored.upgrade && restored.upgrade.upCost.length === 3, '回填 upCost 长度一致');
ok(restored.upgrade && restored.upgrade.levels.length === 3, '回填 levels 长度一致（去 Lv1）');
// 再导出一次，结构应幂等
captured = null;
click(document.getElementById('talBtnExportUpgrade'));
const json2 = captured ? JSON.parse(captured) : null;
ok(json2 && JSON.stringify(json2.T_UP_TEST) === JSON.stringify(up), '导入→再导出结构幂等（往返无损）');

// ---- [7] 合并工程契约：文心目录与升级表必须一同导出 ----
console.log('[7] 合并工程包含 talent-upgrade');
// 恢复完整官方目录并附加测试文心，使严格引用校验能验证真实发布形态，而不是残缺的单模块夹具。
window.TALENT.importData([
  ...window.GAME_TALENTS.map(t => JSON.parse(JSON.stringify(t))),
  JSON.parse(JSON.stringify(restored))
], true);
window.TALENT.importUpgrade({ ...window.GAME_TALENT_UPGRADE, T_UP_TEST: up }, true);
captured = null;
window.Common.showManagement();
click(document.getElementById('mgmtExport'));
const project = captured ? JSON.parse(captured) : null;
ok(project && Array.isArray(project.talents), '工程文件包含 talents');
ok(project && project['talent-upgrade'] && project['talent-upgrade'].T_UP_TEST,
   '工程文件包含 talent-upgrade，避免云端等级/effect/cost 来源分裂');
ok(project && JSON.stringify(project['talent-upgrade'].T_UP_TEST) === JSON.stringify(up),
   '工程内升级表与独立导出结构一致');

// ---- [8] 云端发布契约：必须与手动导出的工程对象逐字段一致 ----
console.log('[8] 云端发布与手动导出共用完整工程契约');
const cloudProject = window.CloudSync && window.CloudSync.buildProject();
ok(cloudProject && JSON.stringify(cloudProject) === JSON.stringify(project),
   '云端发布对象与手动导出对象完全一致');
for (const key of ['talent-upgrade', 'schools', 'grades', 'narrative']) {
  ok(cloudProject && Object.prototype.hasOwnProperty.call(cloudProject, key),
     `云端发布对象包含 ${key}`);
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
