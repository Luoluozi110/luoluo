// 仿真「创作消耗灵感多掷灵感骰」功能对平衡的影响。
// 用法（可选参数）：node sim_extra_dice.mjs <npcMult> <pUse> <inspInit> <inspMax>
// 不传参数则自动扫描多组，输出对比表。
import * as R from './feihuaqi-playable/js/engine/rules.js';
import { Game } from './feihuaqi-playable/js/engine/game.js';
import fs from 'fs';

const D = 'feihuaqi-playable/config/';
const baseCfg = {};
for (const n of ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album']) {
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

function scaleAttrs(attrs, m){
  return Object.fromEntries(Object.entries(attrs||{}).map(([k,v])=>[k, Math.max(Number(v)||0, Math.round((Number(v)||0)*m))]));
}
function scaleNpcs(npcs, mult){
  if (!mult || mult === 1) return npcs;
  if (typeof mult === 'number') {
    return npcs.map(tier => ({ ...tier, npcs:(tier.npcs||[]).map(n=>({...n, attrs: scaleAttrs(n.attrs, mult)})) }));
  }
  // 分级：按 tier id 取倍率
  return npcs.map(tier => {
    const m = mult[tier.id] || 1;
    return { ...tier, npcs:(tier.npcs||[]).map(n=>({...n, attrs: scaleAttrs(n.attrs, m)})) };
  });
}

function makeUI(rand, quizAcc, pUse){
  return {
    floatAttrs(){}, floatInspiration(){}, onState(){}, showDice(){}, movePiece(){}, toast(){},
    highlightCell(){}, showQuizResult(){}, showSky(){}, showLandmark(){}, skyExpired(){},
    showTalentGain(){}, showPalaceIntro(){}, async showResult(){},
    async askReplaceTalent(){ return 0; },
    async askBranch(br, cell, cost, insp){ return insp >= cost+8; },
    async askScenic(cell, cost, insp){ return insp >= cost; },
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
      // 基础一枚灵感骰（免费）
      const pips = [1+Math.floor(rand()*6)];
      // 多掷：灵感可负担且本次愿意追加时，叠一枚（每枚 -3 灵感）
      let guard=0;
      while (session.inspiration >= 3 && guard++ < 12) {
        if (rand() < (pUse||0)) { if (!session.spendInspiration(3, '追加灵感骰')) break; pips.push(1+Math.floor(rand()*6)); }
        else break;
      }
      return session.resolve(style, manner, pips);
    }
  };
}

async function runGames(N, quizAcc, { npcMult=1, pUse=0, inspInit=null, inspMax=null }={}){
  let scores=[], fengbi=0, win=0, loss=0, draw=0, turns=[], battles=0, extraSum=0, extraCnt=0;
  const cfg2 = { ...baseCfg };
  cfg2.attrs = JSON.parse(JSON.stringify(baseCfg.attrs));
  cfg2.inspiration = { ...baseCfg.inspiration };
  if (inspInit != null) cfg2.inspiration.initial = inspInit;
  if (inspMax != null) cfg2.inspiration.max = inspMax;
  cfg2.npcs = scaleNpcs(baseCfg.npcs, npcMult);
  for (let i=0;i<N;i++){
    const rand = rng(7000+i);
    const g = new Game(cfg2, makeUI(rand, quizAcc, pUse), rand);
    g.start(baseCfg.schools[i % baseCfg.schools.length].id);
    let guard=0;
    while(!g.s.over && guard++<200){ await g.playTurn(); }
    const sum = R.sixDimScore({ attrs:g.s.attrs, battle:g.s.battle, events:g.s.events,
      finish:{ reached:g.s.reachedEnd, inspirationLeft:g.s.inspiration, turns:g.s.turn, palaceSweep:g.s.palaceWins>=3 } }, cfg2.grades);
    scores.push(sum.total);
    if (g.s.endReason==='fengbi') fengbi++;
    win+=g.s.battle.win; loss+=g.s.battle.loss; draw+=g.s.battle.draw;
    turns.push(g.s.turn); battles += g.s.battle.win+g.s.battle.loss+g.s.battle.draw;
  }
  scores.sort((a,b)=>a-b);
  const pct=(p)=>scores[Math.floor(p*(scores.length-1))];
  const mean = scores.reduce((s,x)=>s+x,0)/N;
  const sd = Math.sqrt(scores.reduce((s,x)=>s+(x-mean)**2,0)/N);
  const tiers={}; for(const s of scores){ const gr=R.gradeOf(s, cfg2.grades.grades||cfg2.grades.tiers); tiers[gr.name]=(tiers[gr.name]||0)+1; }
  return { N, mean:Math.round(mean), sd:Math.round(sd), p50:pct(.5), p90:pct(.9),
    fengbi:(fengbi/N*100).toFixed(1)+'%', winRate:(win/(win+loss+draw)*100).toFixed(1)+'%',
    avgTurns:Math.round(turns.reduce((s,x)=>s+x,0)/N), avgBattles:Math.round(battles/N),
    tiers:Object.fromEntries(Object.entries(tiers).map(([k,v])=>[k,(v/N*100).toFixed(0)+'%'])) };
}

const N=2000;
const quizAcc=0.75;
const args = process.argv.slice(2);
if (args.length >= 2) {
  const npcMult=Number(args[0])||1, pUse=Number(args[1])||0;
  const inspInit=args[2]!=null?Number(args[2]):null, inspMax=args[3]!=null?Number(args[3]):null;
  console.log(JSON.stringify(await runGames(N, quizAcc, { npcMult, pUse, inspInit, inspMax })));
} else {
  const scenarios = [
    { npcMult:1.00, pUse:0.0,  inspInit:20, inspMax:30, tag:'基准 NPC×1.0' },
    { npcMult:1.06, pUse:0.0,  inspInit:20, inspMax:30, tag:'NPC×1.06 关' },
    { npcMult:1.08, pUse:0.0,  inspInit:20, inspMax:30, tag:'NPC×1.08 关' },
    { npcMult:1.10, pUse:0.0,  inspInit:20, inspMax:30, tag:'NPC×1.10 关' },
    { npcMult:1.06, pUse:0.30, inspInit:28, inspMax:48, tag:'NPC×1.06·中用·28/48' },
    { npcMult:1.08, pUse:0.30, inspInit:28, inspMax:48, tag:'NPC×1.08·中用·28/48' },
    { npcMult:1.10, pUse:0.30, inspInit:28, inspMax:48, tag:'NPC×1.10·中用·28/48' },
  ];
  for (const sc of scenarios) {
    const r = await runGames(N, quizAcc, sc);
    console.log(sc.tag.padEnd(22), JSON.stringify(r));
  }
}
