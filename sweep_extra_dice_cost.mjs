/**
 * 追加骰灵感成本扫描
 * 复用 sim_npc_mechanism.mjs 的核心逻辑，把 extraDiceCost 作为参数扫描，
 * 找让 aggressive 胜率回落、规划领先仍 ≥10pp 的目标值。
 */
import * as R from './feihuaqi-playable/js/engine/rules.js';
import { Game } from './feihuaqi-playable/js/engine/game.js';
import * as MH from './feihuaqi-playable/js/ui/mechHints.js';
import fs from 'node:fs';

const D = 'feihuaqi-playable/config/';
function loadBase() {
  const base = {};
  for (const n of ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies','npc-mechanics']) {
    try { base[n] = JSON.parse(fs.readFileSync(D + n + '.json', 'utf8')); } catch { base[n] = []; }
  }
  const board = base.board;
  const byId = new Map();
  for (const c of board.mainRing) byId.set(c.id, { ...c, ring:'main' });
  const declared = new Map();
  for (const c of (board.branchCells || [])) declared.set(c.id, c);
  for (const [bid, br] of Object.entries(board.branches || {})) {
    const BT = ['ping','quiz','event','battle','landmark'];
    br.cells.forEach((cid, i) => { const d = declared.get(cid) || {}; byId.set(cid, { id: cid, type: d.type || BT[i] || 'ping', name: d.name || br.landmark + '·' + (i + 1), branch: bid, branchIndex: i, ring: 'branch' }); });
  }
  board.cellById = byId; board.gateOf = {};
  for (const [g, b] of Object.entries(board.branchGates || {})) board.gateOf[b] = Number(g);
  board.laps = Number(board.laps) || 2; board.ringSize = board.mainRing.length;
  base.questions = (base.questions || []).filter(q => q.enabled !== false);
  base.events = (base.events || []).filter(e => e.enabled !== false);
  base.talentById = new Map((base.talents || []).map(t => [t.id, t]));
  return base;
}
const BASE = loadBase();

function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

const MANNERS = BASE.affinity.manners || ['wanyue','haofang','zheli'];
const notStyle = s => ['shi','ci','lian'].filter(x => x !== s);

function decide(strategy, session, rand, extraCost, cap) {
  const a = session.playerAttrs;
  const allow = ['shi','ci','lian'].filter(s => session.canUseStyle ? session.canUseStyle(s) : true);
  const bestOf = () => { let b=allow[0], bv=-Infinity; for (const s of allow){ const v=R.expectedScore(a,s); if(v>bv){bv=v;b=s;} } return b; };
  const bestManner = () => { let b=session.manners[0], bv=-Infinity; for (const m of session.manners){ const v=session.affinityOf(m); if(v>bv){bv=v;b=m;} } return b; };
  const style = bestOf();
  const manner = bestManner();
  const il = session.intentLocked;
  const mech = session.npc && session.npc.mech;
  const w = mech && mech.weakness;
  const npcSig = mech && mech.signature && (mech.signature.main || mech.signature);

  const rollMaybe = (maxDice) => {
    const d = [1 + Math.floor(rand()*6)];
    const limit = Math.min(maxDice, cap);
    while (d.length < limit && session.inspiration >= extraCost && session.spendInspiration(extraCost)) {
      d.push(1 + Math.floor(rand()*6));
    }
    return d;
  };

  const weaknessPath = () => {
    if (!w) return null;
    switch (w.template) {
      case 'wea_base_dice_only': return { diceMode: 'noExtra' };
      case 'wea_harmonious_manner': {
        const hitM = (w.manners || []).find(m => session.manners.includes(m));
        return hitM ? { manner: hitM, diceMode: 'base' } : null;
      }
      case 'wea_style_manner_combo': {
        const hitM = (w.manners || []).find(m => session.manners.includes(m));
        if (hitM && allow.includes(w.style)) return { style: w.style, manner: hitM, diceMode: 'base' };
        return null;
      }
      case 'wea_crushing_win': return { diceMode: 'aggr' };
      case 'wea_use_other_style': {
        const alt = allow.filter(s => s !== w.npcStyle);
        if (!alt.length) return null;
        const npcExp = R.expectedScore(a, style);
        const estSig = (() => {
          if (!npcSig) return 0;
          if (['sig_style_mastery','sig_repeat_read','sig_copycat'].includes(npcSig.template)) return npcExp * (Number(npcSig.pct) || 0);
          if (npcSig.template === 'sig_steady_pressure') { if (npcSig.floorPct != null) return npcExp * (Number(npcSig.floorPct) || 0); return Number(npcSig.floor) || 0; }
          return 0;
        })();
        const fullCloseNow = (s) => (w.fullClose && (w.fullClose.includes(s) || w.fullClose === '*'));
        let bestAlt = null, bestVal = -Infinity;
        for (const s of alt) {
          const r = fullCloseNow(s) ? 0 : (w.partialReduction && w.partialReduction.retention != null ? Number(w.partialReduction.retention) : Number(w.retention));
          const gain = estSig * (1 - r);
          const cost = R.expectedScore(a, style) - R.expectedScore(a, s);
          const val = gain - cost;
          if (val > bestVal) { bestVal = val; bestAlt = { s, gain, cost, val }; }
        }
        if (bestVal > 0) return { style: bestAlt.s, diceMode: 'base' };
        return null;
      }
      case 'wea_switch_style': return null;
      case 'wea_cross_battle_shift':
      case 'wea_counter_intent': return null;
      default: return null;
    }
  };

  if (strategy === 'simple') {
    const dice = rand() < 0.3 ? rollMaybe(2) : rollMaybe(1);
    return { style, manner, dice };
  }
  if (strategy === 'readIntent') {
    let chosen = style;
    const sigTpl = mech && mech.signature && (mech.signature.main || mech.signature);
    if (il && sigTpl && sigTpl.template === 'sig_style_mastery' && sigTpl.style === il.style) {
      const alt = notStyle(il.style).filter(s => allow.includes(s));
      if (alt.length) chosen = alt[0];
    }
    return { style: chosen, manner, dice: rollMaybe(1) };
  }
  if (strategy === 'planWeakness') {
    const path = weaknessPath();
    if (path) {
      let chosenStyle = path.style || style;
      let chosenManner = path.manner || manner;
      let dice;
      if (path.diceMode === 'noExtra') dice = rollMaybe(1);
      else if (path.diceMode === 'aggr') dice = rollMaybe(3);
      else dice = rollMaybe(1);
      return { style: chosenStyle, manner: chosenManner, dice };
    }
    return { style, manner, dice: rollMaybe(1) };
  }
  if (strategy === 'conservative') return { style, manner, dice: rollMaybe(1) };
  if (strategy === 'aggressive') return { style, manner, dice: rollMaybe(6) };
  return { style, manner, dice: rollMaybe(1) };
}

function makeGame(rand) {
  const ui = {
    floatAttrs(){}, floatInspiration(){}, onState(){}, showDice(){}, movePiece(){}, toast(){},
    highlightCell(){}, showQuizResult(){}, showSky(){}, showLandmark(){}, skyExpired(){},
    showTalentGain(){}, showPalaceIntro(){}, async showResult(){}, async askReplaceTalent(){return 0;},
    async askBranch(br,c,cost,insp){ return insp>=cost+8; },
    async showQuiz(q){ return { index:Math.floor(rand()*((q.options||[]).length||1)), timedOut:false }; },
    async askScenic(cell,cost,insp){ return insp>=cost; },
    async showEvent(ev){ const ch=(ev.choices||[]).length; return ch?Math.floor(rand()*ch):0; },
    async runBattle(session){ const mv=decide(strategyRef.current, session, rand, extraCostRef.current, capRef.current); return session.resolve(mv.style, mv.manner, mv.dice); }
  };
  const g = new Game({...BASE}, ui, rand);
  g.start(BASE.schools[Math.floor(rand()*BASE.schools.length)].id);
  return {g,ui};
}

const capRef = { current: 6 };

const strategyRef = { current:'simple' };
const extraCostRef = { current:3 };

async function runBattleOnce(g, npc, theme, isPalace) {
  g.s.attrs = JSON.parse(JSON.stringify((npc && npc.attrs) || {shi:10,ci:10,lian:10,bi:10,xue:10,si:10}));
  const session = g.createSession({ npc, theme, isPalace });
  const mv = decide(strategyRef.current, session, g.rand, extraCostRef.current, capRef.current);
  const res = session.resolve(mv.style, mv.manner, mv.dice);
  await g.settleBattle(session, res);
  return { session, res, mv };
}

async function runOneCost(extraCost, cap) {
  extraCostRef.current = extraCost;
  capRef.current = cap;
  const mechNPCs = [];
  for (const t of BASE.npcs) for (const n of (t.npcs||[])) if (n.mech) mechNPCs.push({ tier:t.tier, npc:n, isFinal:!!t.isFinal });
  const STRATEGIES = ['simple','readIntent','planWeakness','conservative','aggressive'];
  const agg = {};
  for (const s of STRATEGIES) agg[s] = { games:0, wins:0, sigHits:0, weakHits:0, maxAttrStyle:0, changedStyle:0 };
  const LOW_COST = new Set(['wea_crushing_win','wea_base_dice_only','wea_harmonious_manner']);
  const lc = {};
  for (const s of STRATEGIES) lc[s] = { games:0, wins:0, changedTactic:0 };

  const SEED = 20260815;
  const REPS_PER = 12;
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
        const theme = BASE.affinity.themes[Math.floor(rand()*BASE.affinity.themes.length)];
        const {session, res, mv} = await runBattleOnce(g, npc, theme, isFinal);
        bap(agg[strategy], res, session.playerAttrs, mv.style, strategy);
        if (lowCost){
          const A = lc[strategy]; A.games++; if (res.result==='win') A.wins++;
        }
        if (lowCost && strategy==='planWeakness'){
          const baseStyle = (() => { let b=null,_bv=-Infinity; for (const s of ['shi','ci','lian']) { const v=R.expectedScore(session.playerAttrs,s); if(v>_bv){_bv=v;b=s;} } return b; })();
          const baseManner = (() => { let b=null,_bv=-Infinity; for (const m of session.manners) { const v=session.affinityOf(m); if(v>_bv){_bv=v;b=m;} } return b; })();
          if (mv.style!==baseStyle || mv.manner!==baseManner || mv.dice.length!==1) lc[strategy].changedTactic++;
        }
        idx++;
      }
    }
  }
  const simple = agg.simple, plan = agg.planWeakness;
  const lcSimple = lc.simple, lcPlan = lc.planWeakness;
  const planLeadLc = (lcPlan.wins/(lcPlan.games||1) - lcSimple.wins/(lcSimple.games||1)) * 100;
  const planLeadAll = (plan.wins/(plan.games||1) - simple.wins/(simple.games||1)) * 100;
  const out = { cost: extraCost };
  for (const s of STRATEGIES) {
    const a = agg[s];
    out[s] = { win: a.wins/(a.games||1)*100, sigHit: a.sigHits/(a.games||1)*100, weakHit: a.weakHits/(a.games||1)*100, maxAttr: a.maxAttrStyle/(a.games||1)*100 };
  }
  out.planLeadLc = planLeadLc;
  out.planLeadAll = planLeadAll;
  out.changedTactic = lcPlan.changedTactic/(lcPlan.games||1)*100;
  out.ok = planLeadLc >= 10 && out.aggressive.win < out.planWeakness.win + 10;
  return out;
}

function bap(a, res, attrs, style, strategy){
  a.games++;
  if (res.result==='win') a.wins++;
  if (res.mech && res.mech.tri && res.mech.tri.level) a.sigHits++;
  if (res.mech && res.mech.wea && res.mech.wea.hit) a.weakHits++;
  const maxAttrKey = Object.keys(attrs).reduce((m,k)=> ['shi','ci','lian'].includes(k)?(attrs[k]> (m?attrs[m]:-Infinity)?k:m):m, null);
  if (style===maxAttrKey) a.maxAttrStyle++;
  if (strategy!=='simple' && style!==maxAttrKey) a.changedStyle++;
}

(async () => {
  const costs = [4,5,6,8,10,12,14];
  const caps = [2,3];
  console.log('cap\tcost\tsimple\tread\tplan\tcons\taggr\tplanLeadLc\tchangeTac\tok?');
  for (const cap of caps) {
    for (const c of costs) {
      const r = await runOneCost(c, cap);
      console.log([cap, c, r.simple.win.toFixed(1), r.readIntent.win.toFixed(1), r.planWeakness.win.toFixed(1), r.conservative.win.toFixed(1), r.aggressive.win.toFixed(1), r.planLeadLc.toFixed(1), r.changedTactic.toFixed(1), r.ok ? 'OK' : ''].join('\t'));
    }
  }
})();
