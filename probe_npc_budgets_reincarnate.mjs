// 飞花棋·多 NPC 预算方案 × 裸局 / 跨局传承 的胜率矩阵探测
// 用法：node probe_npc_budgets_reincarnate.mjs
// 候选方案在代码里定义，对每个方案：等比例缩放当前 NPC 六维分布（保持偏科结构），
// 然后跑 sim_npc_tier_winrate_reincarnate 的裸局与 3 代 90% 传承两种模式。
import * as R from './feihuaqi-playable/js/engine/rules.js';
import { Game, Reincarnate } from './feihuaqi-playable/js/engine/game.js';
import fs from 'fs';

const D = 'feihuaqi-playable/config/';
const baseCfg = {};
for (const n of ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies','npc-mechanics']) {
  try { baseCfg[n] = JSON.parse(fs.readFileSync(D+n+'.json','utf8')); } catch { baseCfg[n] = []; }
}
const board = baseCfg.board;
const byId = new Map();
for (const c of board.mainRing) byId.set(c.id, { ...c, ring:'main' });
const declared = new Map();
for (const c of (board.branchCells||[])) declared.set(c.id, c);
for (const [bid,br] of Object.entries(board.branches||{})) {
  br.id = bid;
  const BT=['ping','quiz','event','battle','landmark'];
  br.cells.forEach((cid,i)=>{ const d=declared.get(cid)||{}; byId.set(cid,{id:cid,type:d.type||BT[i]||'ping',name:d.name||`${br.landmark}·${i+1}`,branch:bid,branchIndex:i,ring:'branch'}); });
}
board.cellById = byId; board.gateOf={};
for (const [g,b] of Object.entries(board.branchGates||{})) board.gateOf[b]=Number(g);
board.laps = Number(board.laps)||2; board.ringSize = board.mainRing.length;
baseCfg.questions = (baseCfg.questions||[]).filter(q=>q.enabled!==false);
baseCfg.events = (baseCfg.events||[]).filter(e=>e.enabled!==false);
const af=baseCfg.affinity; af.themeNames=af.themeNames||{}; af.mannerNames=af.mannerNames||{}; af.matrix=af.matrix||{};
baseCfg.talentById = new Map((baseCfg.talents||[]).map(t=>[t.id,t]));

function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

function makeUI(rand, quizAcc){
  return {
    floatAttrs(){}, floatInspiration(){}, onState(){}, showDice(){}, movePiece(){}, toast(){},
    highlightCell(){}, showQuizResult(){}, showSky(){}, skyExpired(){}, showBowenChoice: async ()=>'focus',
    showTalentGain(){}, showPalaceIntro(){}, async showResult(){},
    async askReplaceTalent(){ return 0; },
    async askScenic(cell, cost, insp){ return insp >= cost + 12; },
    async showQuiz(q){ const correct = q.type==='knowledge' ? q.answer : 0;
      if (rand() < quizAcc){ return { index: correct, timedOut:false }; }
      let idx = Math.floor(rand()*((q.options||[]).length||1)); return { index: idx, timedOut:false }; },
    async showEvent(ev){ const ch=(ev.choices||[]).length; return ch? Math.floor(rand()*ch):0; },
    async runBattle(session){
      const a = session.playerAttrs;
      const allow = ['shi','ci','lian'].filter(s=> session.canUseStyle(s));
      let style = allow[0], best=-1;
      for (const s of allow){ const v=R.expectedScore(a,s); if(v>best){best=v;style=s;} }
      let manner = session.manners[0], mv=-Infinity;
      for (const m of session.manners){ const v=session.affinityOf(m); if(v>mv){mv=v;manner=m;} }
      const dice = 1+Math.floor(rand()*6);
      return session.resolve(style, manner, dice);
    }
  };
}

// 缩放 NPC 数组到目标总和，保持偏科结构
function scaleNpcs(npcs, targetsByTierId){
  const out = JSON.parse(JSON.stringify(npcs));
  for (const t of out) {
    const target = targetsByTierId[t.id];
    if (!target) continue;
    for (const n of (t.npcs||[])) {
      const cur = Object.values(n.attrs||{}).reduce((a,b)=>a+Number(b||0),0);
      if (!cur) continue;
      let sum=0; const keys=Object.keys(n.attrs);
      const scaled={}; for (const k of keys){ scaled[k]=Math.floor((Number(n.attrs[k])||0)*target/cur); sum+=scaled[k]; }
      // 差额补到主属性（当前最高属性）
      const diff = target - sum;
      if (diff !== 0) {
        const mainKey = keys.reduce((a,b)=>scaled[a]>=scaled[b]?a:b);
        scaled[mainKey] += diff;
      }
      n.attrs = scaled;
    }
  }
  return out;
}

async function runScenario(npcs, N, quizAcc, reincarnateRatio, reincarnateIters){
  const cfg = { ...baseCfg, attrs: JSON.parse(JSON.stringify(baseCfg.attrs)), npcs };
  const total={w:0,l:0,d:0};
  const wins={}, losses={}, draws={};
  let prevAttrs = null;
  for (let iter=0; iter<reincarnateIters; iter++){
    const iterAttrRecords=[];
    for (let i=0;i<N;i++){
      const rand = rng(4000 + iter*100000 + i);
      const ui = makeUI(rand, quizAcc);
      const origRun = ui.runBattle;
      ui.runBattle = async function(session){
        const tid = (session.npc && session.npc.tierId) ? session.npc.tierId : (session.npc ? session.npc.id || 'unknown' : 'null');
        const isPalace = session.isPalace;
        const out = await origRun.call(this, session);
        const key = (isPalace? 'palace:' : '') + tid;
        if (out.result==='win'){ wins[key]=(wins[key]||0)+1; total.w++; }
        else if (out.result==='lose'){ losses[key]=(losses[key]||0)+1; total.l++; }
        else { draws[key]=(draws[key]||0)+1; total.d++; }
        return out;
      };
      const g = new Game(cfg, ui, rand);
      if (iter > 0 && prevAttrs && prevAttrs[i] && reincarnateRatio > 0) {
        const inherit = {}; for (const k of R.ATTR_KEYS) inherit[k] = Math.floor((Number(prevAttrs[i][k])||0)*reincarnateRatio);
        Reincarnate._write({ talentId:'T_REINC_TEST', talentName:'照我传灯', ratio:reincarnateRatio, attrs:inherit });
      } else {
        Reincarnate._write(null);
      }
      g.start(cfg.schools[i % cfg.schools.length].id);
      let guard=0; while(!g.s.over && guard++<200){ await g.playTurn(); }
      iterAttrRecords.push({ ...g.s.attrs });
    }
    prevAttrs = iterAttrRecords;
  }
  const perTier={};
  const keys = new Set([...Object.keys(wins),...Object.keys(losses),...Object.keys(draws)]);
  for (const k of keys) perTier[k] = { w:wins[k]||0, l:losses[k]||0, d:draws[k]||0 };
  return { total, perTier };
}

function rate(o){ const t=o.w+o.l+o.d; return t? o.w/t : 0; }
function extractRates(perTier){
  const out={};
  for (const k of Object.keys(perTier).sort()) if(!k.startsWith('palace:')) out[k]=rate(perTier[k]);
  const pw={w:0,l:0,d:0}; for(const k of Object.keys(perTier)) if(k.startsWith('palace:')){ pw.w+=perTier[k].w; pw.l+=perTier[k].l; pw.d+=perTier[k].d; }
  out.palace = rate(pw);
  return out;
}

function fmtPct(v){ return `${(v*100).toFixed(1)}%`; }

// 候选方案（第二轮，贴近「传承为主」目标：裸局殿试~28%、传承3代殿试~66%）
const scenarios = [
  { name:'E1', budgets:{juren:96,  jinshi:130, zhukaoguan:162} },
  { name:'E2', budgets:{juren:98,  jinshi:134, zhukaoguan:168} },
  { name:'E3', budgets:{juren:100, jinshi:138, zhukaoguan:174} },
  { name:'E4', budgets:{juren:102, jinshi:142, zhukaoguan:180} },
];

const N=1400, quizAcc=0.75, ratio=0.90, iters=3;
(async()=>{
  console.log(`探测参数 N=${N} quizAcc=${quizAcc} reincarnateRatio=${ratio} iters=${iters}\n`);
  const table=[];
  for (const sc of scenarios) {
    const npcs = scaleNpcs(baseCfg.npcs, sc.budgets);
    // 裸局
    const r0 = await runScenario(npcs, N, quizAcc, 0, 1);
    const bare = extractRates(r0.perTier);
    // 3代传承
    const r3 = await runScenario(npcs, N, quizAcc, ratio, iters);
    const re3 = extractRates(r3.perTier);
    table.push({ name:sc.name, budgets:sc.budgets, bare, re3 });
    console.log(`${sc.name}: 举人=${sc.budgets.juren} 进士=${sc.budgets.jinshi} 主考=${sc.budgets.zhukaoguan}`);
    console.log(`  裸局胜率 举人${fmtPct(bare.juren)} 进士${fmtPct(bare.jinshi)} 殿试${fmtPct(bare.palace)}`);
    console.log(`  3代传承 举人${fmtPct(re3.juren)} 进士${fmtPct(re3.jinshi)} 殿试${fmtPct(re3.palace)}`);
    console.log();
  }
  // 汇总表
  console.log('=== 胜率矩阵汇总 ===');
  console.log('| 方案 | 举人预算 | 进士预算 | 主考预算 | 裸局(举/进/殿) | 3代传承(举/进/殿) |');
  console.log('|------|----------|----------|----------|----------------|-------------------|');
  for (const row of table) {
    console.log(`| ${row.name} | ${row.budgets.juren} | ${row.budgets.jinshi} | ${row.budgets.zhukaoguan} | ${fmtPct(row.bare.juren)}/${fmtPct(row.bare.jinshi)}/${fmtPct(row.bare.palace)} | ${fmtPct(row.re3.juren)}/${fmtPct(row.re3.jinshi)}/${fmtPct(row.re3.palace)} |`);
  }
})();
