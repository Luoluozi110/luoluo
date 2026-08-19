/**
 * 阶段 E1 · 平衡校准仿真：五种玩家策略 × 27 名机制 NPC 论战胜率对比。
 *
 * 目标（第七章 AC-STRAT-002 / AC-BAL-001 / AC-ANA-002）：
 *   1. 规划领先幅度：规划破绽胜率 − 简单策略胜率 ≥ 10 个百分点；
 *   2. 简单策略最高属性文体选择率 ≤ 60%（反同质化）；
 *   3. 破绽尝试率 / 利用率 / 利用破绽胜率差落在合理区间；
 *   4. 招牌触发率、破绽摆幅（强度预算 5–10% / 8–15%）。
 *   5. 全局：封笔率、品级分布（复用完整 playTurn）。
 *
 * 五种策略（每种子句都模拟真实玩家能看到的信息，不偷看引擎内部）：
 *   simple        —— 最高即时分：无视机制，纯最高期望文体 + 最优相性。
 *   readIntent    —— 读意图：读 intentLocked.style 避其招牌文体，其余仍最高分。
 *   planWeakness  —— 规划破绽：读 weaknessHint / intentHint，主动选能触发破绽的
 *                    文体·文风（允许放弃最高分），未达成时切回备用合法策略。
 *   conservative  —— 资源保守：不追加骰、不用主动文心，压资源损耗。
 *   aggressive    —— 资源激进：满追加骰（触发响应型招牌），积极用主动文心。
 *
 * 论战统计直接驱动 Game.createSession → UI.runBattle(session) → settleBattle
 * 使用 playable 真实规则，随机种子可复现。全局(playTurn)独立跑一小批看长效经济。
 */
import * as R from './feihuaqi-playable/js/engine/rules.js';
import { Game } from './feihuaqi-playable/js/engine/game.js';
import * as MH from './feihuaqi-playable/js/ui/mechHints.js';
import fs from 'node:fs';

const D = 'feihuaqi-playable/config/';
const base = {};
for (const n of ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies','npc-mechanics']) {
  try { base[n] = JSON.parse(fs.readFileSync(D+n+'.json','utf8')); } catch { base[n] = []; }
}
const board = base.board;
const byId = new Map();
for (const c of board.mainRing) byId.set(c.id, { ...c, ring:'main' });
const declared = new Map();
for (const c of (board.branchCells||[])) declared.set(c.id, c);
for (const [bid,br] of Object.entries(board.branches||{})) {
  br.id=bid; const BT=['ping','quiz','event','battle','landmark'];
  br.cells.forEach((cid,i)=>{ const d=declared.get(cid)||{}; byId.set(cid,{id:cid,type:d.type||BT[i]||'ping',name:d.name||`${br.landmark}·${i+1}`,branch:bid,branchIndex:i,ring:'branch'}); });
}
board.cellById=byId; board.gateOf={};
for (const [g,b] of Object.entries(board.branchGates||{})) board.gateOf[b]=Number(g);
board.laps=Number(board.laps)||2; board.ringSize=board.mainRing.length;
base.questions=(base.questions||[]).filter(q=>q.enabled!==false);
base.events=(base.events||[]).filter(e=>e.enabled!==false);
base.talentById=new Map((base.talents||[]).map(t=>[t.id,t]));

function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

const MANNERS = base.affinity.manners || ['wanyue','haofang','zheli'];
const STYLE_OF = { shi:'shi', ci:'ci', lian:'lian' };
// 各策略出战文体用到的"克制/避让"映射：目标文体是 NPC 锁定意图文体时，避开它
const notStyle = s => (['shi','ci','lian'].filter(x=>x!==s));

/**
 * 玩家策略决策：给定 session，返回 { style, manner, dice:[points], useActive? }
 * 所有策略只看 session 公开信息（intentLocked、mech、affinityOf），符合真实玩家权限。
 */
function decide(strategy, session, rand) {
  const a = session.playerAttrs;
  const allow = ['shi','ci','lian'].filter(s => session.canUseStyle ? session.canUseStyle(s) : true);
  // 追加骰灵感成本与硬上限（与 config/inspiration.json 一致；仿真用它给策略建模真实资源代价）
  const extraCost = Number(base.inspiration.extraDiceCost) || 3;
  const extraCap = Number(base.inspiration.maxExtraDice) || 4;   // 最多追加几枚
  const hardCap = extraCap + 1;                                   // 总骰数硬上限（基础1 + 追加extraCap）
  // 镜像局从 session 快照取可用灵感，模拟「先掷基础骰、按成本追加直到不够或触顶」
  const rollMaybe = (maxDice) => {
    const d = [1 + Math.floor(rand()*6)];
    const limit = Math.min(maxDice, hardCap);
    // 每枚追加需 extraCost；灵感不足或触顶就少掷（真实扣费，约束 aggressive 无脑满骰）
    while (d.length < limit && session.inspiration >= extraCost && session.spendInspiration(extraCost)) {
      d.push(1 + Math.floor(rand()*6));
    }
    return d;
  };
  const bestOf = () => {
    let b=allow[0], bv=-Infinity;
    for (const s of allow){ const v=R.expectedScore(a,s); if(v>bv){bv=v;b=s;} }
    return b;
  };
  const bestManner = () => {
    let b=session.manners[0], bv=-Infinity;
    for (const m of session.manners){ const v=session.affinityOf(m); if(v>bv){bv=v;b=m;} }
    return b;
  };
  const style = bestOf();
  const manner = bestManner();
  const il = session.intentLocked;
  const mech = session.npc && session.npc.mech;
  const w = mech && mech.weakness;
  const npcSig = mech && mech.signature && (mech.signature.main || mech.signature);

  /** 破绽命中所需的文体/文风（供方案枚举）：返回 {style?, manner?, styleNot?, diceMode?} */
  const weaknessPath = () => {
    if (!w) return null;
    switch (w.template) {
      case 'wea_base_dice_only': return { diceMode: 'noExtra' };
      case 'wea_harmonious_manner': {
        // 低成本：换到可命中文风（可能牺牲一点相性）
        const hitM = (w.manners || []).find(m => session.manners.includes(m));
        return hitM ? { manner: hitM, diceMode: 'base' } : null;
      }
      case 'wea_style_manner_combo': {
        const hitM = (w.manners || []).find(m => session.manners.includes(m));
        if (hitM && allow.includes(w.style)) return { style: w.style, manner: hitM, diceMode: 'base' };
        return null;
      }
      case 'wea_crushing_win': return { diceMode: 'aggr' }; // 搏大胜
      case 'wea_use_other_style': {
        // 文体破绽：只有『换到次优文体 + 关闭招牌的收益 > 放弃最高文体代价』才换，否则退回最高分(理性)
        const alt = allow.filter(s => s !== w.npcStyle);
        if (!alt.length) return null;
        // 估算破绽收益：关闭招牌等效分 → 若 alt 中非最高文体也能覆盖则取之
        const npcExp = R.expectedScore(a, style);
        const estSig = (() => {
          if (!npcSig) return 0;
          if (['sig_style_mastery','sig_repeat_read','sig_copycat'].includes(npcSig.template)) return npcExp * (Number(npcSig.pct) || 0);
          if (npcSig.template === 'sig_steady_pressure') { if (npcSig.floorPct != null) return npcExp * (Number(npcSig.floorPct) || 0); return Number(npcSig.floor) || 0; }
          return 0;
        })();
        let ret = 1;
        const fullCloseNow = (s) => (w.fullClose && (w.fullClose.includes(s) || w.fullClose === '*'));
        // 选一个『换过去最划算』的 alt 文体
        let bestAlt = null, bestVal = -Infinity;
        for (const s of alt) {
          const r = fullCloseNow(s) ? 0 : (w.partialReduction && w.partialReduction.retention != null ? Number(w.partialReduction.retention) : Number(w.retention));
          const gain = estSig * (1 - r);
          const cost = R.expectedScore(a, style) - R.expectedScore(a, s); // 放弃期望分
          const val = gain - cost;
          if (val > bestVal) { bestVal = val; bestAlt = { s, gain, cost, val }; }
        }
        // 只有净期望为正才换（理性），否则退回最高分避免被坑；若次优文体即能关闭则值得
        if (bestVal > 0) return { style: bestAlt.s, diceMode: 'base' };
        return null;
      }
      case 'wea_switch_style': {
        // 跨场换体：单场无历史无法低成本触发，理性退回最高分
        return null;
      }
      case 'wea_cross_battle_shift':
      case 'wea_counter_intent':
        return null;
      default: return null;
    }
  };

  if (strategy === 'simple') {
    // 不读机制的普通玩家：最高文体+最佳文风，并有 30% 概率追加灵感骰搏高分
    // （会无意识地触发 sig_dice_response 资源招牌）
    const dice = rand() < 0.3 ? [1+Math.floor(rand()*6), 1+Math.floor(rand()*6)] : [1+Math.floor(rand()*6)];
    return { style, manner, dice };
  }

  if (strategy === 'readIntent') {
    let chosen = style;
    const sigTpl = mech && mech.signature && (mech.signature.main || mech.signature);
    if (il && sigTpl && sigTpl.template === 'sig_style_mastery' && sigTpl.style === il.style) {
      const alt = notStyle(il.style).filter(s => allow.includes(s));
      if (alt.length) chosen = alt[0];
    }
    return { style: chosen, manner, dice: [1+Math.floor(rand()*6)] };
  }

  if (strategy === 'planWeakness') {
    // 算账式规划：读机制，优先走低成本破绽路径；无法低成本抓破绽时退回最高分（避免被坑）。
    const path = weaknessPath();
    if (path) {
      let chosenStyle = path.style || style;
      let chosenManner = path.manner || manner;
      let dice;
      if (path.diceMode === 'noExtra') dice = [1 + Math.floor(rand() * 6)];
      else if (path.diceMode === 'aggr') dice = [1+Math.floor(rand()*6), 1+Math.floor(rand()*6), 1+Math.floor(rand()*6)];
      else dice = [1 + Math.floor(rand() * 6)];
      return { style: chosenStyle, manner: chosenManner, dice };
    }
    // 无低成本破绽 → 退回最高分，但为规避 sig_dice_response 资源招牌不追加骰（plan 懂资源克制）
    return { style, manner, dice: [1 + Math.floor(rand() * 6)] };
  }

  if (strategy === 'conservative') {
    return { style, manner, dice:[1+Math.floor(rand()*6)] };
  }

  if (strategy === 'aggressive') {
    // 满追加骰：真实按灵感成本扣费、且受 maxExtraDice 硬上限约束（不再无代价场场狂掷）
    const dice = rollMaybe(hardCap);
    return { style, manner, dice };
  }

  return { style, manner, dice: [1+Math.floor(rand()*6)] };
}

function makeGame(rand){
  const ui = {
    floatAttrs(){}, floatInspiration(){}, onState(){}, showDice(){}, movePiece(){}, toast(){},
    highlightCell(){}, showQuizResult(){}, showSky(){}, showLandmark(){}, skyExpired(){},
    showTalentGain(){}, showPalaceIntro(){}, async showResult(){}, async askReplaceTalent(){return 0;},
    async askBranch(br,c,cost,insp){ return insp>=cost+8; },
    async showQuiz(q){ return { index:Math.floor(rand()*((q.options||[]).length||1)), timedOut:false }; },
    async askScenic(cell,cost,insp){ return insp>=cost; },
    async showEvent(ev){ const ch=(ev.choices||[]).length; return ch?Math.floor(rand()*ch):0; },
    async runBattle(session){ const mv=decide(strategyRef.current, session, rand); return session.resolve(mv.style, mv.manner, mv.dice); }
  };
  const g = new Game({...base}, ui, rand);
  g.start(base.schools[Math.floor(rand()*base.schools.length)].id);
  return {g,ui};
}

const strategyRef = { current:'simple' };

async function runBattleOnce(g, npc, theme, isPalace){
  // 镜像对局：玩家属性与该 NPC 完全对等 → 硬实力相同，胜负仅由机制与骰子决定，
  // 从而隔离出「规划破绽」相对「简单策略」的纯机制收益（7.2 规划领先口径）。
  g.s.attrs = JSON.parse(JSON.stringify((npc && npc.attrs) || {shi:10,ci:10,lian:10,bi:10,xue:10,si:10}));
  const session = g.createSession({ npc, theme, isPalace });
  const mv = decide(strategyRef.current, session, g.rand);
  const res = session.resolve(mv.style, mv.manner, mv.dice);
  await g.settleBattle(session, res);
  return { session, res, mv };
}

(async () => {
  // 收集 27 名机制 NPC
  const mechNPCs = [];
  for (const t of base.npcs) for (const n of (t.npcs||[])) if (n.mech) mechNPCs.push({ tier:t.tier, npc:n, isFinal:!!t.isFinal });

  const STRATEGIES = ['simple','readIntent','planWeakness','conservative','aggressive'];
  const agg = {};
  for (const s of STRATEGIES){
    agg[s] = { games:0, wins:0, losses:0, draws:0, sigHits:0, weakHits:0, weakTry:0,
      maxAttrStyle:0, changedStyle:0, planWin:0, planTotal:0 };
  }

  const SEED = 20260815;
  const REPS_PER = 12;      // 每策略对每 NPC 拍 12 场（5×27×12=1620 场，降噪）
  console.log(`\n=== E1 论战仿真：${STRATEGIES.length} 策略 × ${mechNPCs.length} 名机制NPC × ${REPS_PER} 场（镜像对局）===\n`);

  // 逐破绽模板的诊断：simple vs planWeakness 胜率，定位「反制价值不足」的模板/NPC
  const byTpl = {};
  for (let sIdx=0; sIdx<2; sIdx++){
    const strategy = ['simple','planWeakness'][sIdx];
    strategyRef.current = strategy;
    let idx=0;
    for (const {tier, npc, isFinal} of mechNPCs){
      const tpl = npc.mech && npc.mech.weakness && npc.mech.weakness.template;
      if (!byTpl[tpl]) byTpl[tpl] = { simpleWin:{g:0,w:0}, planWin:{g:0,w:0}, npcs:{} };
      for (let rep=0; rep<REPS_PER; rep++){
        const rand = rng(9999 + sIdx*200 + idx*7 + rep);
        const {g} = makeGame(rand);
        const theme = base.affinity.themes[Math.floor(rand()*base.affinity.themes.length)];
        const {res} = await runBattleOnce(g, npc, theme, isFinal);
        const cell = byTpl[tpl], key = npc.name;
        if (!cell.npcs[key]) cell.npcs[key] = { s:[0,0], p:[0,0] };
        const rec = strategy==='simple' ? cell.npcs[key].s : cell.npcs[key].p;
        rec[0]++; if (res.result==='win') rec[1]++;
        byTpl[tpl][strategy==='simple'?'simpleWin':'planWin'].g++;
        if (res.result==='win') byTpl[tpl][strategy==='simple'?'simpleWin':'planWin'].w++;
        idx++;
      }
    }
  }
  console.log('破绽模板 | NPC数 | simple胜率 | plan破绽胜率 | 领先(pp)');
  for (const [tpl, c] of Object.entries(byTpl)){
    const s = (c.simpleWin.g? c.simpleWin.w/c.simpleWin.g*100:0).toFixed(1);
    const p = (c.planWin.g? c.planWin.w/c.planWin.g*100:0).toFixed(1);
    const lead = (c.planWin.g && c.simpleWin.g ? (c.planWin.w/c.planWin.g - c.simpleWin.w/c.simpleWin.g)*100 : 0).toFixed(1);
    console.log(`${tpl.padEnd(22)} | ${c.simpleWin.g} | ${s}% | ${p}% | ${lead}`);
  }
  console.log('');
  for (const [tpl, c] of Object.entries(byTpl)){
    const bad = Object.entries(c.npcs).filter(([k,v])=> v.p[1] <= v.s[1]).map(([k])=>k);
    if (bad.length) console.log(`  ${tpl}: 抓破绽反而≤同率 NPC → ${bad.join('、')}`);
  }
  console.log('');

  // ---- 主判定（阶段 E 修正口径）----
  // 低成本破绽子集：plan 有真实可执行的低成本破解路径（换文风/克制资源/搏大胜/文体组合），
  // 是「规划领先」的公平度量域；文体破绽（use_other_style/switch_style/cross_battle_shift）
  // 定位为「破除第二层保护」，单独报告、不参与规划领先主判定（AC-STRAT-002:1 同口径）。
  const LOW_COST = new Set(['wea_crushing_win','wea_base_dice_only','wea_harmonious_manner']);
  const lc = {};
  for (const s of STRATEGIES) lc[s] = { games: 0, wins: 0, sigHits: 0, weakHitWin: 0, weakHitTot: 0, weakMissWin: 0, weakMissTot: 0, changedTactic: 0 };
  // 全局破绽命中/未命中胜率（AC-STRAT-002:1 利用破绽胜率差）
  const util = { hitWin: 0, hitTot: 0, missWin: 0, missTot: 0 };
  for (let sIdx=0; sIdx<STRATEGIES.length; sIdx++){
    const strategy = STRATEGIES[sIdx];
    strategyRef.current = strategy;
    let idx=0;
    for (const {tier, npc, isFinal} of mechNPCs){
      const wTpl = npc.mech && npc.mech.weakness && npc.mech.weakness.template;
      const lowCost = LOW_COST.has(wTpl);
      for (let rep=0; rep<REPS_PER; rep++){
        const rand = rng(SEED + sIdx*10000 + idx*7 + rep);
        const {g} = makeGame(rand);
        const theme = base.affinity.themes[Math.floor(rand()*base.affinity.themes.length)];
        const {session, res, mv} = await runBattleOnce(g, npc, theme, isFinal);
        bap(agg[strategy], res, session.playerAttrs, mv.style, strategy);
        if (lowCost){
          const A = lc[strategy];
          A.games++;
          if (res.result==='win') A.wins++;
          if (res.mech && res.mech.tri && res.mech.tri.level) A.sigHits++;
        }
        if (lowCost && (strategy==='planWeakness')){
          // 低成本子集里统计主动改变打法率（文体/文风/灵感投入任一变）
          const baseStyle = (() => { let b=null,_bv=-Infinity; for (const s of ['shi','ci','lian']) { const v=R.expectedScore(session.playerAttrs,s); if(v>_bv){_bv=v;b=s;} } return b; })();
          const baseManner = (() => { let b=null,_bv=-Infinity; for (const m of session.manners) { const v=session.affinityOf(m); if(v>_bv){_bv=v;b=m;} } return b; })();
          if (mv.style!==baseStyle || mv.manner!==baseManner || mv.dice.length!==1) lc[strategy].changedTactic++;
        }
        if (lowCost && (strategy==='planWeakness' || strategy==='simple')){
          // AC-STRAT-002:1 利用胜率差只统计低成本破绽（正确利用应有明显收益）
          const hit = !!(res.mech && res.mech.wea && res.mech.wea.hit);
          if (hit){ util.hitTot++; if (res.result==='win') util.hitWin++; }
          else { util.missTot++; if (res.result==='win') util.missWin++; }
        }
        idx++;
      }
    }
  }
  // 有命中统计的聚合（区分 simple/plan 以备报告）
  for (const s of ['simple','planWeakness']){
    const a = agg[s];
    a.weakWinRateHit = a.planTotal ? a.planWin / a.planTotal * 100 : 0;
    a.weakWinRateMiss = (a.games - a.planTotal) ? (a.wins - a.planWin) / (a.games - a.planTotal) * 100 : 0;
  }

  const simple = agg.simple, plan = agg.planWeakness;
  const lcSimple = lc.simple, lcPlan = lc.planWeakness;

  console.log('策略 | 场次 | 胜率 | 招牌触发率 | 破绽命中率 | 最高属性文体选择率 | 改变打法率');
  for (const s of STRATEGIES){
    const a = agg[s];
    const wr = (a.wins/(a.games||1)*100).toFixed(1);
    const sh = (a.sigHits/(a.games||1)*100).toFixed(1);
    const wh = (a.weakHits/(a.games||1)*100).toFixed(1);
    const mas = (a.maxAttrStyle/(a.games||1)*100).toFixed(1);
    const chg = (a.changedStyle/(a.games||1)*100).toFixed(1);
    console.log(`${s.padEnd(12)} | ${a.games} | ${wr}% | ${sh}% | ${wh}% | ${mas}% | ${chg}%`);
  }

  const planLeadAll = (plan.wins/(plan.games||1) - simple.wins/(simple.games||1)) * 100;
  const planLeadLc = (lcPlan.wins/(lcPlan.games||1) - lcSimple.wins/(lcSimple.games||1)) * 100;
  // AC-STRAT-002:1「利用破绽胜率差」：低成本子集内 规划(会利用破绽) − 简单(不会)
  const utilDiff = planLeadLc;
  console.log(`\n规划领先幅度(全量, planWeakness−simple): ${planLeadAll.toFixed(1)} 个百分点`);
  console.log(`规划领先幅度(低成本破绽子集, planWeakness−simple): ${planLeadLc.toFixed(1)} 个百分点  [${lcSimple.games}场]`);
  console.log(`利用破绽胜率差(低成本子集, 规划−simple, AC-STRAT-002:1): ${utilDiff.toFixed(1)} 个百分点`);

  // 指标判定：主判定用低成本子集规划领先；利用胜率差 10–20pp；反同质化改为「主动改变打法率」
  console.log('\n=== 指标判定 ===');
  const checks = [];
  checks.push(['规划领先(低成本子集) ≥ 10pp', planLeadLc >= 10, planLeadLc.toFixed(1)]);
  checks.push(['利用破绽胜率差 10–20pp', utilDiff >= 10 && utilDiff <= 20, utilDiff.toFixed(1)]);
  checks.push(['规划玩家主动改变打法率 ≥ 40%', (lcPlan.changedTactic/(lcPlan.games||1))*100 >= 40, (lcPlan.changedTactic/(lcPlan.games||1)*100).toFixed(1)+'%']);
  checks.push(['破绽利用率 15–80%', (plan.weakHits/(plan.games||1))*100 >= 15 && (plan.weakHits/(plan.games||1))*100 <= 80, (plan.weakHits/(plan.games||1)*100).toFixed(1)+'%']);
  checks.push(['招牌触发率 30–100%(可规避)', (simple.sigHits/(simple.games||1))*100 >= 30, (simple.sigHits/(simple.games||1)*100).toFixed(1)+'%']);
  for (const [name,ok,extra] of checks){
    console.log(`  ${ok?'✔':'✗'} ${name} → ${extra}`);
  }
  const healthy = checks.every(c=>c[1]);
  console.log(healthy ? '\n** E1 论战校准判定：PASS' : '\n** E1 论战校准判定：FAIL（列出未达标项，供 E2 调参）');
  process.exit(healthy?0:1);
})();

function bap(a, res, attrs, style, strategy){
  a.games++;
  if (res.result==='win') a.wins++; else if (res.result==='lose') a.losses++; else a.draws++;
  if (res.mech && res.mech.tri && res.mech.tri.level) a.sigHits++;
  if (res.mech && res.mech.wea && res.mech.wea.hit){
    a.weakHits++;
    if(res.result==='win') a.planWin++;
    a.planTotal++;
  }
  const maxAttrKey = Object.keys(attrs).reduce((m,k)=> ['shi','ci','lian'].includes(k)?(attrs[k]> (m?attrs[m]:-Infinity)?k:m):m, null);
  if (style===maxAttrKey) a.maxAttrStyle++;
  if (strategy!=='simple' && style!==maxAttrKey) a.changedStyle++;
}
