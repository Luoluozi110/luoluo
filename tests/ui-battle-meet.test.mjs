/* ui-battle-meet.test.mjs —— NPC 相遇介绍「开始对决」确认按钮 jsdom 冒烟
 *
 * 验证：① 遭遇阶段渲染出确认按钮；点击后才放行进入 ② 审题（不再自动快跳）。
 * 用全局 jsdom window/document 模拟浏览器，动态 import BattleStage 跑一场假战斗。
 */
import { JSDOM } from 'file:///C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom/lib/api.js';

const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});
const { window } = dom;
global.window = window;
global.document = window.document;
global.requestAnimationFrame = window.requestAnimationFrame || (cb => setTimeout(cb, 16));
global.AudioContext = window.AudioContext; // jsdom 无，置 undefined 即可（audio 懒用）

let pass = 0, fail = 0;
const ok = (cond, name, extra) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${extra !== undefined ? `  [got: ${JSON.stringify(extra)}]` : ''}`); }
};

const { BattleStage } = await import('../js/ui/battle.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log('[1] 遭遇阶段渲染出「开始对决」确认按钮；点击后放行进入审题');
{
  const el = document.createElement('div');
  document.body.appendChild(el);
  const stage = new BattleStage(el, {});
  stage.seconds = 30;

  // 构造一个最小可运行到「审题渲染」的 session（非机制 NPC，跳过研判卡）
  const session = {
    label: '对决',
    playerName: '在下',
    playerAttrs: { shi: 10, ci: 10, lian: 10, fu: 5, qu: 5, shu: 5 },
    npc: { name: '康尔玉', title: '主考官', style: 'shi', attrs: { shi: 8 } }, // mech 缺失 → 无研判卡分支
    styleNames: {},
    mannerNames: {},
    topic: '《临江仙》',
    themeName: '怀古',
    themeNames: {},
    zeitgeist: null,
    schoolHomeName: null,
    homeBonus: 0,
    synergies: [],
    resolve: () => ({}),
  };

  // 启动 run()（异步），它会在遭遇阶段 -> 确认按钮处 await
  const pRun = stage.run(session);

  // run() 此刻同步执行到「挂确认按钮 + await new Promise」，因此按钮应已存在
  const btn0 = el.querySelector('.meet-confirm');
  ok(btn0 != null, '遭遇阶段已渲染「开始对决」确认按钮', btn0 && btn0.textContent);
  ok(btn0 && btn0.textContent === '开始对决 →', '按钮文案为「开始对决 →」', btn0 && btn0.textContent);
  ok(btn0 && el.querySelector('#btPanel').textContent.includes('康尔玉'), '介绍文案含 NPC 名「康尔玉」');

  // 未点击时不应推进到审题（#btTopic 仍为默认「—」）
  await sleep(60);
  const topicBefore = el.querySelector('#btTopic').textContent;
  ok(topicBefore === '—' || topicBefore === '', '未点击前不进入审题（第①阶段停留）', topicBefore);

  // 点击确认 → 放行进入审题
  btn0.click();
  await sleep(50);
  const topicAfter = el.querySelector('#btTopic').textContent;
  ok(topicAfter === '《临江仙》', '点击后放行进入①→②审题，题目已载入', topicAfter);
  const panelHtml = el.querySelector('#btPanel').innerHTML;
  ok(!panelHtml.includes('开始对决 →'), '进入审题后确认按钮已移除');
  ok(panelHtml.includes('② 审题'), '面板已切换到「② 审题」', panelHtml.slice(0, 30));

  // 收尾：run() 停在 pickStyle（选文体）pending，不影响断言；断开 el，防后续报错
  await pRun.catch(() => {}); // 不强制等待（pending），仅吞掉任何未捕获拒绝
  el.remove();
}

console.log('[2] 机制 NPC：研判卡渲染后再挂确认按钮，点击放行');
{
  const el = document.createElement('div');
  document.body.appendChild(el);
  const stage = new BattleStage(el, {});
  stage.seconds = 30;

  const session = {
    label: '对决',
    playerName: '在下',
    playerAttrs: { shi: 10, ci: 10, lian: 10, fu: 5, qu: 5, shu: 5 },
    npc: { name: '周小满', title: '察举生', style: 'ci', mech: { signature: { name: '如椽巨笔' }, weakness: { name: '起笔涩' } }, attrs: { ci: 8 } }, // 非空 mech → 触发研判卡
    intentLocked: { disclosure: 'full', text: '此人意在速战速决' },
    styleNames: {},
    mannerNames: { feng: '劲拔' },
    topic: '《望海潮》',
    themeName: '山水',
    themeNames: {},
    zeitgeist: null,
    schoolHomeName: null,
    homeBonus: 0,
    synergies: [],
    resolve: () => ({}),
  };

  const pRun = stage.run(session);
  const panel = el.querySelector('#btPanel');
  const btn = panel.querySelector('.meet-confirm');
  ok(panel.innerHTML.includes('研 判') || panel.innerHTML.includes('硏 判'), '机制 NPC 已渲染研判卡');
  ok(btn != null, '研判卡之后确认按钮仍出现');
  btn.click();
  await sleep(50);
  ok(el.querySelector('#btTopic').textContent === '《望海潮》', '点击后放行进入审题（机制 NPC 路径）');
  await pRun.catch(() => {});
  el.remove();
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
if (fail > 0) process.exit(1);
