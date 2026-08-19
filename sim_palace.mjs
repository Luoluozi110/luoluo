/**
 * 殿试专项仿真（#100+#101 合并）：用真实引擎无头跑多场殿试，
 * 测量 sig_palace_adapt（跨场适应层数→破绽收益阻尼）与 wea_cross_battle_shift（换策消层）的实际效果。
 *
 * 两种玩家行为对照：
 *   keep   —— 三场都同一文体/文风（不换策）→ 适应层应逐场叠加
 *   switch —— 每场换不同文体/文风（换策）→ wea_cross_battle_shift 应消层
 *
 * 输出：每场 palaceLayers、破绽命中、实际破绽 retention、胜负；三连胜率。
 */
import * as R from './feihuaqi-playable/js/engine/rules.js';
import { Game } from './feihuaqi-playable/js/engine/game.js';
import fs from 'node:fs';

const D = 'feihuaqi-playable/config/';
const base = {};
for (const n of ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies','npc-mechanics']) {
  try { base[n] = JSON.parse(fs.readFileSync(D + n + '.json', 'utf8')); } catch { base[n] = []; }
}
base.talentById = new Map((base.talents || []).map(t => [t.id, t]));
base.questions = (base.questions || []).filter(q => q.enabled !== false);
base.events = (base.events || []).filter(e => e.enabled !== false);

function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

// 与 game.js 保持一致：殿试跨场适应按整段殿试分桶
const PALACE_KEY = '__palace__';

let ZK = null, ZKTIER = null;
for (const t of base.npcs) for (const n of (t.npcs||[])) if (n.name === '王侍郎') { ZK = n; ZKTIER = t; }
if (!ZK) { console.log('未找到王侍郎'); process.exit(1); }
console.log('王侍郎 mech:', JSON.stringify(ZK.mech));

const STYLES = ['shi','ci','lian'];
const MANNERS = base.affinity.manners || ['wanyue','haofang','zheli'];

function makeUI(rand, behavior) {
  const cap = { lastSession: null, idx: 0 };
  cap.runBattle = async (session) => {
    cap.lastSession = session;
    const idx = cap.idx++;                  // 引擎内部自建 session 不携带 _battleIdx，改用闭包计数
    let style, manner;
    if (behavior === 'keep') { style = 'shi'; manner = 'wanyue'; }
    else { style = 'shi'; manner = (idx % 2 === 0) ? 'wanyue' : 'haofang'; }   // 换策：保留强势文体、轮换文风（仍触发 strategyChanged→消层），公平隔离「跨场适应」效果
    const dice = [1 + Math.floor(rand()*6), 1 + Math.floor(rand()*6)];
    return session.resolve(style, manner, dice);
  };
  return {
    floatAttrs(){}, floatInspiration(){}, onState(){}, showDice(){}, movePiece(){}, toast(){},
    highlightCell(){}, showQuizResult(){}, showSky(){}, showLandmark(){}, skyExpired(){},
    showTalentGain(){}, showPalaceIntro(){}, async showResult(){}, async askReplaceTalent(){return 0;},
    async askBranch(){return false;}, async showQuiz(){return {index:0,timedOut:false};},
    async askScenic(){return false;}, async showEvent(){return 0;},
    runBattle: cap.runBattle, _cap: cap
  };
}

async function runPalaceSeq(rand, behavior) {
  const ui = makeUI(rand, behavior);
  const g = new Game({...base}, ui, rand);
  g.start(base.schools[0].id);
  g.s.inspiration = base.inspiration.initial;
  g.s.phase = 'palace';
  // 殿试跨场适应配置（与 runPalace 一致，取自王侍郎 sig_palace_adapt）
  g.s.npcMech = { history: {}, palace: {} };
  g.s.npcMech.palaceAdapt = { maxLayers: 2, weaknessDampen: 0.25, minWeaknessRetention: 0.5 };
  g.s.npcMech.palace = { [PALACE_KEY]: { layers: 0 } };
  g.s.npcMech.palaceLast = null;
  g.s.attrs = JSON.parse(JSON.stringify(ZK.attrs || { shi: 12, ci: 12, lian: 12, bi: 12, xue: 12, si: 12 }));

  const foeId = (ZK.id || ZK.name);
  const baseAttrs = JSON.parse(JSON.stringify(g.s.attrs));   // 隔离「殿内属性雪球」，仅测跨场机制本身
  const log = [];
  for (let i = 0; i < 3; i++) {
    if (g.s.inspiration <= 0) break;
    const session = g.createSession({ npc: ZK, theme: (ZKTIER.themes||['yongwu'])[i], isPalace: true });
    session._battleIdx = i;
    const result = await g.doBattle({ npc: ZK, theme: (ZKTIER.themes||['yongwu'])[i], isPalace: true, label: '殿试'+i });
    g.s.attrs = JSON.parse(JSON.stringify(baseAttrs));        // 复位，避免胜场属性增益在殿试内滚雪球
    const lastSession = ui._cap.lastSession;
    const layers = (g.s.npcMech.palace[PALACE_KEY] || {}).layers ?? 0;
    const mechOut = (lastSession && lastSession._mechOut) || session._mechOut || {};
    const wea = mechOut.wea || {};
    log.push({ battle: i+1, result, layers, weaHit: !!wea.hit, weaRet: wea.retention, weaBonus: wea.playerBonus, weaTpl: wea.template, layerReduce: wea.layerReduce });
  }
  const wins = log.filter(l => l.result === 'win').length;
  return { log, sweep: wins };
}

(async () => {
  const REPS = 4000;
  for (const behavior of ['keep','switch']) {
    console.log(`\n===== 玩家行为: ${behavior} (${REPS} 局) =====`);
    let sweeps = 0, total = 0, winsSum = 0;
    let layerSum = 0, layerN = 0, b3BonusSum = 0, b3N = 0, layerReduceHits = 0, bonusSum = 0, bonusN = 0;
    const layerTrace = [];
    for (let rep = 0; rep < REPS; rep++) {
      const rand = rng(777 + rep * 13 + (behavior === 'switch' ? 99991 : 0));
      const r = await runPalaceSeq(rand, behavior);
      total++;
      if (r.sweep >= 3) sweeps++;
      winsSum += r.log.filter(l => l.result === 'win').length;
      for (const l of r.log) { layerSum += l.layers; layerN++; if (l.layerReduce) layerReduceHits++; if (l.weaBonus != null) { bonusSum += l.weaBonus; bonusN++; } }
      const b3 = r.log[2];
      if (b3) { b3BonusSum += (b3.weaBonus != null ? b3.weaBonus : 0); b3N++; }   // B3 场均破绽加分(越大=玩家破绽越有效)
      if (rep < 4) layerTrace.push(r.log.map(l => `B${l.battle}:${l.result}/L${l.layers}${l.weaHit?'(bon'+((l.weaBonus||0)*100).toFixed(1)+'%)':''}${l.layerReduce?('[-'+l.layerReduce+']'):''}`).join(' '));
    }
    console.log('场均胜场(共3):', (winsSum/total).toFixed(3));
    console.log('三连胜率:', (sweeps/total*100).toFixed(1) + '%');
    console.log('场均适应层数:', (layerSum/layerN).toFixed(3), '| 换策消层命中次数/总场:', layerReduceHits + '/' + layerN);
    console.log('场均破绽加分(越大越好):', (bonusSum/bonusN).toFixed(4), '| B3 场均破绽加分:', (b3BonusSum/b3N).toFixed(4));
    console.log('轨迹样本:');
    layerTrace.forEach(t => console.log('  ', t));
  }
})();
