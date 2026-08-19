/** sim_mech_hints_ui.mjs —— 阶段 B：battle.js 研判卡/定策提示/结算明细/殿试评语 DOM 冒烟
 *  用 jsdom 挂载真实 #battleStage，import 真实 BattleStage，直接调用各展示方法
 *  验证机制 UI 文案能正确落 DOM，且不触碰/损坏算分逻辑。 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, 'feihuaqi-playable');

// ---- 全局：jsdom 就位后再 import battle.js ----
const JSDOM_ABS = 'C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom/lib/api.js';
const { JSDOM } = await import(pathToFileURL(JSDOM_ABS).href);
const dom = new JSDOM(`<!DOCTYPE html><html><head><style></style></head><body><div id="battleStage"></div></body></html>`, { pretendToBeVisual: true });
global.document = dom.window.document;
global.window = dom.window;

const { BattleStage } = await import(pathToFileURL(join(root, 'js/ui/battle.js')).href);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log(`  ✗ ${msg}`); } };

const STYLE = { shi: '诗', ci: '词', lian: '联', bi: '笔', xue: '学', si: '思' };
const MANNER = { wanyue: '婉约', haofang: '豪放', zheli: '哲理', qingya: '清雅', chenyu: '沉郁', qili: '绮丽' };

/** 带 mech 的最小机制 NPC（王侍郎·跨场适应） */
const WANG = {
  name: '王侍郎', title: '礼部侍郎', id: 'wang_shilang', style: 'shi',
  attrs: { shi: 38, ci: 30, lian: 30, bi: 35, xue: 17, si: 19 },
  mech: {
    version: 1, complexity: 'cross_battle',
    signature: { name: '衡文察变', template: 'sig_palace_adapt', maxLayers: 2, perLayer: 1, weaknessDampen: 0.25, minWeaknessRetention: 0.50 },
    weakness: { name: '跨场换策', template: 'wea_cross_battle_shift', layerReduce: 1 },
    intent: { template: 'int_palace_adapt', style: 'shi', bias: 1.30, bottom: 0.75, description: '已根据上一场战况调整策略' }
  }
};

function makeSession(npc = WANG, palaceLayers = 2) {
  return {
    npc, isPalace: !!npc.mech, palaceLayers,
    mannerNames: MANNER, manners: Object.keys(MANNER),
    playerAttrs: { shi: 30, ci: 30, lian: 30, bi: 30, xue: 30, si: 30 },
    activeTalents: [], usedActive: [], inspiration: 5, spendInspiration: () => true,
    canUseStyle: () => true, styleHint: () => '', affinityOf: () => 0.05, momentumPre: () => 0,
    homeResolved: null, homeBonus: 0
  };
}

(async () => {
  const el = document.getElementById('battleStage');
  const bs = new BattleStage(el, { inspiration: { battleLoseExtra: -3 } });

  // ---- 1) 研判卡可直接渲染进 DOM（弱依赖） ----
  const mechCtx = { styleNames: STYLE, mannerNames: MANNER };
  el.innerHTML = '<div class="bt-panel" id="btPanel"></div>';
  const panel = el.querySelector('#btPanel');
  const { intentHint } = await import(pathToFileURL(join(root, 'js/ui/mechHints.js')).href);
  const hints = intentHint(WANG, { style: 'shi', manner: 'zheli', styleDisclosed: false, mannerDisclosed: false }, mechCtx);
  panel.innerHTML = hints.map(h =>
    `<div class="jt-card"><span class="jt-tag">${h.tag}</span><span class="jt-title">${h.title}</span><span class="jt-body">${h.body}</span></div>`).join('');
  ok(panel.querySelectorAll('.jt-card').length >= 2, '研判卡卡条 ≥2 且渲染入 DOM');

  // ---- 2) 定策破绽提示 ----
  const tipEl = document.createElement('div');
  tipEl.innerHTML = bs.weaknessTip({ npc: WANG, mannerNames: MANNER });
  ok(tipEl.querySelector('.jt-tip .jt-tag') !== null, '破绽提示含机章');
  ok(tipEl.textContent.includes('跨场换策'), '破绽提示引用破绽名');

  // ---- 3) 结算明细（机制 NPC） ----
  el.innerHTML = '<div class="bt-panel" id="btPanel"></div>';
  const p2 = el.querySelector('#btPanel');
  const outMech = {
    tri: { level: 'main', key: '衡文察变' },
    wea: { hit: true, reason: '跨场换策', shutdownLevel: 'partial', retention: 0.5 },
    mods: { pct: [{ source: 'npcSign', label: '招牌·衡文察变', value: 0.08 }], flat: [], playerBonusPct: 0.04, refundInsp: 1, infoBonus: 0, extraInspCost: 0 }
  };
  await bs.revealMech({ mech: outMech }, makeSession());
  ok(el.querySelector('.mech-result') !== null, '机制结算明细容器出现');
  ok(el.querySelectorAll('.mech-line').length >= 2, `结算明细行 ≥2（实际 ${el.querySelectorAll('.mech-line').length}）`);
  ok(el.innerHTML.includes('衡文察变') && el.innerHTML.includes('跨场换策'), '结算明细含招牌/破绽名');

  // ---- 4) 殿试场间评语 ----
  const r = bs.palaceVerdict({ result: 'win' }, makeSession(WANG, 2));
  ok(typeof r === 'string' && r.includes('王侍郎') || (typeof r === 'string' && r.includes('本官')), '殿试评语 win 文案出现');
  el.appendChild(Object.assign(document.createElement('div'), { className: 'palace-remark', textContent: r }));
  ok(el.querySelector('.palace-remark') !== null, '宫试评语 DOM 存在');

  // ---- 5) 非机制 NPC：无评语 / 无可渲染 ----
  const plain = { name: '陈砚秋', title: '村塾学子', style: 'ci', attrs: {} };
  ok(bs.palaceVerdict({ result: 'win' }, makeSession(plain)) === null, '非机制无殿试评语');
  const p3tip = bs.weaknessTip({ npc: plain, mannerNames: MANNER });
  ok(p3tip === '', '非机制无破绽提示');
  const noline = await bs.revealMech({ mech: null }, makeSession(plain));
  ok(true, '非机制 revealMech 无异常');

  console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
  process.exit(fail ? 1 : 0);
})();
