// 飞花棋·传承(肉鸽多周目)玩家结算总分可达性探测
// 目的：确认在多周目传承叠加下，高品级分数线(尤其文宗 4250)对传承老兵是可企及的，
//       同时裸局(第一周目)下保持精英稀缺——即"评分系统同理更大胆"的可达性校验。
// 用法：node probe_grade_reincarnate.mjs [N] [quizAcc] [reincarnateRatio] [reincarnateIters] [文宗线]
import * as R from './feihuaqi-playable/js/engine/rules.js';
import { Game, Reincarnate } from './feihuaqi-playable/js/engine/game.js';
import fs from 'fs';

const D = 'feihuaqi-playable/config/';
const cfg = {};
for (const n of ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies','npc-mechanics']) {
  try { cfg[n] = JSON.parse(fs.readFileSync(D+n+'.json','utf8')); } catch { cfg[n] = []; }
}
const board = cfg.board;
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
cfg.questions = (cfg.questions||[]).filter(q=>q.enabled!==false);
cfg.events = (cfg.events||[]).filter(e=>e.enabled!==false);
const af=cfg.affinity; af.themeNames=af.themeNames||{}; af.mannerNames=af.mannerNames||{}; af.matrix=af.matrix||{};
cfg.talentById = new Map((cfg.talents||[]).map(t=>[t.id,t]));

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

async function run(N, quizAcc, ratio, iters){
  const cfg2 = { ...cfg }; cfg2.attrs = JSON.parse(JSON.stringify(cfg.attrs));
  const attrRecords=[];
  for (let iter=0; iter<iters; iter++){
    const iterRecords=[];
    for (let i=0;i<N;i++){
      const rand = rng(4000 + iter*100000 + i); // 与 sim_npc_tier_winrate_reincarnate 相同种子调度，传承才能正确叠加
      const ui = makeUI(rand, quizAcc);
      const g = new Game(cfg2, ui, rand);
      if (iter>0 && attrRecords[iter-1] && attrRecords[iter-1][i] && ratio>0){
        const prev = attrRecords[iter-1][i];
        const inherit = {};
        for (const k of R.ATTR_KEYS) inherit[k] = Math.floor((Number(prev[k])||0)*ratio);
        Reincarnate._write({ talentId:'T_REINC', talentName:'照我传灯', ratio, attrs:inherit });
      } else { Reincarnate._write(null); }
      g.start(cfg.schools[i % cfg.schools.length].id);
      let guard=0;
      while(!g.s.over && guard++<200){ await g.playTurn(); }
      const sum = R.sixDimScore({ attrs:g.s.attrs, battle:g.s.battle, events:g.s.events,
        finish:{ reached:g.s.reachedEnd, inspirationLeft:g.s.inspiration, turns:g.s.turn, palaceSweep:g.s.palaceWins>=3 } }, cfg2.grades);
      iterRecords.push({ total:sum.total, attrs:{...g.s.attrs} });
    }
    attrRecords.push(iterRecords);
  }
  return attrRecords;
}

const N = Number(process.argv[2]) || 1500;
const acc = Number(process.argv[3]) || 0.75;
const ratio = Number(process.argv[4]) || 0.9;
const iters = Number(process.argv[5]) || 3;
const bar = Number(process.argv[6]) || 4250;

const pct=(arr,p)=>arr[Math.max(0,Math.min(arr.length-1,Math.floor(p*(arr.length-1))))];
(async()=>{
  const recs = await run(N, acc, ratio, iters);
  for (let it=0; it<iters; it++){
    const arr = recs[it].map(r=>r.total).sort((a,b)=>a-b);
    const attrsAvg = {};
    for (const k of R.ATTR_KEYS) attrsAvg[k] = (recs[it].reduce((s,r)=>s+(Number(r.attrs[k])||0),0)/N).toFixed(1);
    const mean = arr.reduce((s,x)=>s+x,0)/N;
    const sd = Math.sqrt(arr.reduce((s,x)=>s+(x-mean)**2,0)/N);
    const overBar = arr.filter(x=>x>=bar).length;
    console.log(`第${it+1}代: 六维均值 ${JSON.stringify(attrsAvg)}`);
    console.log(`  总分 p10 ${pct(arr,.1)} p50 ${pct(arr,.5)} p90 ${pct(arr,.9)} p95 ${pct(arr,.95)} max ${arr[arr.length-1]}  mean ${Math.round(mean)} sd ${Math.round(sd)}`);
    console.log(`  ≥文宗线(${bar}) 达成率 ${(overBar/N*100).toFixed(1)}%`);
  }
})();
