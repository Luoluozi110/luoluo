// 临时：枚举灵感初始值/上限增量，量化封笔率与胜率（真实引擎 N=2000，quizAcc=0.75）。
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
cfg.inspiration.stepDrainChance = 0.05;
cfg.inspiration.stepDrainAmount = 3;

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
  let fengbi=0, win=0, loss=0, draw=0, scores=[], turns=[];
  for (let i=0;i<N;i++){
    const rand = rng(7000+i);
    const g = new Game(cfg, makeUI(rand, quizAcc), rand);
    g.start(cfg.schools[i % cfg.schools.length].id);
    let guard=0; while(!g.s.over && guard++<300){ await g.playTurn(); }
    const sum = R.sixDimScore({ attrs:g.s.attrs, battle:g.s.battle, events:g.s.events,
      finish:{ reached:g.s.reachedEnd, inspirationLeft:g.s.inspiration, turns:g.s.turn, palaceSweep:g.s.palaceWins>=3 } }, cfg.grades);
    scores.push(sum.total);
    if (g.s.endReason==='fengbi') fengbi++;
    win+=g.s.battle.win; loss+=g.s.battle.loss; draw+=g.s.battle.draw; turns.push(g.s.turn);
  }
  const mean = Math.round(scores.reduce((s,x)=>s+x,0)/N);
  return { fengbiRate:(fengbi/N*100).toFixed(1)+'%', winRate:(win/(win+loss+draw)*100).toFixed(1)+'%',
    mean, avgTurns:Math.round(turns.reduce((s,x)=>s+x,0)/N) };
}

const N=2000;
const plans = [
  {initial:32,max:54,tag:'基线     '},
  {initial:38,max:60,tag:'A +6/+6 '},
  {initial:40,max:66,tag:'B +8/+12 '},
  {initial:42,max:72,tag:'C +10/+18'},
  {initial:44,max:78,tag:'D +12/+24'},
];
console.log('方案         init max   封笔率  胜率   均值  回合');
for (const p of plans){
  cfg.inspiration.initial = p.initial;
  cfg.inspiration.max = p.max;
  const r = await runGames(N, 0.75);
  console.log(`${p.tag}  ${String(p.initial).padStart(3)} ${String(p.max).padStart(3)}   ${r.fengbiRate.padStart(6)} ${r.winRate.padStart(6)} ${String(r.mean).padStart(5)} ${String(r.avgTurns).padStart(4)}`);
}
