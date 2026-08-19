/**
 * 精确量化：每个 NPC 的破绽若要「值得规划」需要多高的破绽摆幅（关闭招牌的等效分）。
 * 模型：规划玩家从「最高文体(style=A)+最佳文风」切换到「触发破绽的组合(style=B)」，
 * 收益 = 破绽关闭招牌所削掉的分 + playerBonus；代价 = A 相对 B 的期望分差(含文风相性)。
 * 我们计算：要让 收益>=代价，破绽「关闭招牌」至少需提供多少分（以 NPC 期望总分%计）。
 * 这直接回答：AC-BAL-001 的 8-15% 摆幅预算够不够让规划领先。
 */
import * as R from './feihuaqi-playable/js/engine/rules.js';
import fs from 'node:fs';

const D = 'feihuaqi-playable/config/';
const base = {};
for (const n of ['npcs','npc-mechanics','affinity']) base[n] = JSON.parse(fs.readFileSync(D + n + '.json', 'utf8'));
const weaLib = base['npc-mechanics'].weaknessTemplates || {};
const af = base.affinity;
const MANNERS = af.manners || ['wanyue','haofang','zheli'];
const THEME = af.themes[0];

// 玩家镜像：与 NPC 同六维。文风收益 = 相性 pct（玩家最佳文风 pct）。
function playerTotals(a, npcMannerPickAff) {
  // 玩家用最高文体+最佳文风的期望总分（含相性 pct 乘算）
  const stys = ['shi','ci','lian'];
  const bestS = stys.map(s=>({s,v:R.expectedScore(a,s)})).sort((x,y)=>y.v-x.v);
  // 最佳文风（含 home/zeitgeist 省略，仅相性）
  const bestM = MANNERS.map(m=>({m,v:R.affinityValue(af.matrix,m,THEME)})).sort((x,y)=>y.v-x.v);
  const bMv = bestM[0].v; // 最佳文风 pct
  const affBestTotal = Math.round(bestS[0].v*(1+bMv));
  return { bestS, bestM, bMv, affBestTotal };
}

console.log('每个 NPC：要让「规划换打法」值得，破绽至少需关闭多少招牌分（以玩家期望总分%计）：');
console.log('tier      npc         最高文体总分   换破解文体      换后总分      破绽需≥(分)  破绽需≥(总分%)  当前破绽最高收益(分)  是否满足');
const afCache = {};
for (const t of base.npcs) for (const n of (t.npcs || [])) if (n.mech) {
  const a = n.attrs || { shi:10,ci:10,lian:10,bi:10,xue:10,si:10 };
  const stys = ['shi','ci','lian'];
  const scores = stys.map(s=>({s,v:R.expectedScore(a,s)})).sort((x,y)=>y.v-x.v);
  const best = scores[0];
  const bestAff = MANNERS.map(m=>R.affinityValue(af.matrix,m,THEME)).reduce((x,y)=>x>y?x:y, -Infinity);
  const bestMannerVal = Math.max(0, bestAff);
  const bestTotal = Math.round(best.v*(1+bestMannerVal));

  const wea = n.mech.weakness;
  const wt = wea && weaLib[wea.template];
  if (!wea || !wt) continue;

  // 计算触发破绽的最优可用组合及其期望总分（镜像下、含文风相性）
  // 找「可触发破绽」的 (s,m) 中总分最高者
  let breakEven = null;
  let bestTriggerTotal = -1, bestTriggerSig = 0;
  for (const s of stys) for (const m of MANNERS) {
    let hit = false, ret = 1;
    if (wea.template === 'wea_use_other_style') { hit = s !== wea.npcStyle; ret = (wea.fullClose && (wea.fullClose.includes(s)||wea.fullClose==='*')) ? 0 : ((wea.partialReduction && wea.partialReduction.retention!=null)?Number(wea.partialReduction.retention):(Number(wea.retention)!=null?Number(wea.retention):1)); }
    else if (wea.template === 'wea_harmonious_manner') { hit = (wea.manners||[]).includes(m); ret = Number(wea.retention)!=null?Number(wea.retention):1; }
    else if (wea.template === 'wea_style_manner_combo') { hit = (wea.style===s && (wea.manners||[]).includes(m)); ret = Number(wea.retention)!=null?Number(wea.retention):1; }
    else if (wea.template === 'wea_base_dice_only') { hit = true; ret = 0; }
    else if (wea.template === 'wea_switch_style') { hit = false; } // 需要跨场历史，单场算不可达
    else if (wea.template === 'wea_crushing_win') { hit = false; }  // 结果型，单场算不可达
    else if (wea.template === 'wea_cross_battle_shift') { hit = false; }
    if (isNaN(ret)) ret = 1;
    const maff = R.affinityValue(af.matrix, m, THEME);
    const total = Math.round(R.expectedScore(a,s)*(1+Math.max(0,maff)));
    if (hit && total > bestTriggerTotal) { bestTriggerTotal = total; bestTriggerSig = ret; }
  }
  // 破绽「关闭招牌」所需分值 = bestTotal - bestTriggerTotal（要填平的差距）
  const gap = bestTotal - bestTriggerTotal;
  // 招牌等效最大分（本 NPC 主招牌）
  const sig = n.mech.signature && (n.mech.signature.main||n.mech.signature);
  let sigVal = 0;
  if (sig) {
    if (['sig_style_mastery','sig_repeat_read','sig_copycat','sig_manner_theme'].includes(sig.template)) sigVal = best.v*(Number(sig.pct)||0);
    else if (sig.template==='sig_steady_pressure') sigVal = sig.floorPct!=null? best.v*(Number(sig.floorPct)||0) : (Number(sig.floor)||0);
  }
  // 当前破绽最大收益 = 招牌 × (1-ret) + playerBonus*bestTriggerTotal
  const curBenefit = sigVal*(1-bestTriggerSig) + (Number(wea.playerBonus)||0)*bestTriggerTotal;
  const needPct = bestTotal>0 ? gap/bestTotal*100 : 0;
  const curPct = bestTotal>0 ? curBenefit/bestTotal*100 : 0;
  const ok = curBenefit >= gap;
  breakEven = gap;

  const tier=(t.tier||'').padEnd(9), nm=(n.name||'').padEnd(11);
  const trS = (npcTotalTxt(bestTriggerTotal));
  console.log(`${tier} ${nm} ${String(bestTotal).padStart(7)}  ${String(bestTriggerTotal).padStart(7)}   ${String(bestTriggerTotal).padStart(7)}   ${String(gap).padStart(8)}    ${needPct.toFixed(1).padStart(7)}    ${curBenefit.toFixed(0).padStart(11)}    ${ok?'YES':'no '}`);
}
function npcTotalTxt(v){ return String(v); }
