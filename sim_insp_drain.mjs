// 灵感耗损调参：扫 stepDrainChance/stepDrainAmount，使标准局封笔率≈15%。
// 用法：node sim_insp_drain.mjs <chance> <amount> [quizAcc]
import * as R from './feihuaqi-playable/js/engine/rules.js';
import { Game } from './feihuaqi-playable/js/engine/game.js';
import fs from 'fs';

const D = 'feihuaqi-playable/config/';
const cfg = {};
for (const n of ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album']) {
  try { cfg[n] = JSON.parse(fs.readFileSync(D+n+'.json','utf8')); } catch { cfg[n] = []; }
}
const board = cfg.board;
const byId = new Map();
for (const c of board.mainRing) byId.set(c.id, { ...c, ring:'main' });
const declared = new Map();
for (const c of (board.branchCells||[])) declared.set(c.id, c);
for (const [bid,br] of Object.entries(board.branches||{})) {
  br.id = bid; const BT=['ping','quiz','event','battle','landmark'];
  br.cells.forEach((cid,i)=>{ const d=declared.get(cid)||{}; byId.set(cid,{id:cid,type:d.type||BT[i]||'ping',name:d.name||`${br.landmark}·${i+1}`,branch:bid,branchIndex:i,ring:'branch'}); });
}
board.cellById = byId; board.gateOf={};
for (const [g,b] of Object.entries(board.branchGates||{})) board.gateOf[b]=Number(g);
board.laps = Number(board.laps)||2; board.ringSize = board.mainRing.length;
cfg.questions = (cfg.questions||[]).filter(q=>q.enabled!==false);
cfg.events = (cfg.events||[]).filter(e=>e.enabled!==false);
const af=cfg.affinity; af.themeNames=af.themeNames||{}; af.mannerNames=af.mannerNames||{}; af.matrix=af.matrix||{};
cfg.talentById = new Map((cfg.talents||[]).map(t=>[t.id,t]));

function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function makeUI(rand, quizAcc){
  return {
    floatAttrs(){}, floatInspiration(){}, onState(){}, showDice(){}, movePiece(){}, toast(){},
    highlightCell(){}, showQuizResult(){}, showSky(){}, skyExpired(){},
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
async function runGames(N, quizAcc){
  let scores=[], fengbi=0, win=0, loss=0, draw=0, turns=[], battles=0, turnlimit=0, minInsp=[];
  for (let i=0;i<N;i++){
    const rand = rng(7000+i);
    const g = new Game(cfg, makeUI(rand, quizAcc), rand);
    g.start(cfg.schools[i % cfg.schools.length].id);
    let guard=0; while(!g.s.over && guard++<300){ await g.playTurn(); }
    const sum = R.sixDimScore({ attrs:g.s.attrs, battle:g.s.battle, events:g.s.events,
      finish:{ reached:g.s.reachedEnd, inspirationLeft:g.s.inspiration, turns:g.s.turn, palaceSweep:g.s.palaceWins>=3 } }, cfg.grades);
    scores.push(sum.total);
    if (g.s.endReason==='fengbi') fengbi++;
    if (g.s.endReason==='turnlimit') turnlimit++;
    win+=g.s.battle.win; loss+=g.s.battle.loss; draw+=g.s.battle.draw;
    turns.push(g.s.turn); battles += g.s.battle.win+g.s.battle.loss+g.s.battle.draw;
    minInsp.push(g.s.inspiration);
  }
  scores.sort((a,b)=>a-b);
  const mean = scores.reduce((s,x)=>s+x,0)/N;
  const tiers={}; for(const s of scores){ const gr=R.gradeOf(s, cfg.grades.grades); tiers[gr.name]=(tiers[gr.name]||0)+1; }
  return { N, mean:Math.round(mean), p50:scores[Math.floor(.5*(scores.length-1))],
    fengbiRate:(fengbi/N*100).toFixed(1)+'%', turnlimitRate:(turnlimit/N*100).toFixed(1)+'%',
    winRate:(win/(win+loss+draw)*100).toFixed(1)+'%',
    avgTurns:Math.round(turns.reduce((s,x)=>s+x,0)/N), avgBattles:Math.round(battles/N),
    tiers:Object.fromEntries(Object.entries(tiers).map(([k,v])=>[k,(v/N*100).toFixed(0)+'%'])) };
}

const N=2000;
const chance = process.argv[2]? Number(process.argv[2]) : 0.05;
const amount = process.argv[3]? Number(process.argv[3]) : 3;
const qa = process.argv[4]? Number(process.argv[4]) : 0.75;
cfg.inspiration.stepDrainChance = chance;
cfg.inspiration.stepDrainAmount = amount;
console.log(`=== stepDrainChance=${chance} stepDrainAmount=${amount} quizAcc=${qa} ===`);
console.log(JSON.stringify(await runGames(N,qa),null,0));
