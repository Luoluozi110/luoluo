// 飞花棋 P1-1 + P1-3 验证仿真
// 隔离四个场景：baseline(专精150/答对不回灵) / P1-1(专精210) / P1-3(答对+1) / both
// 指标：分布百分位、品级达成率、封笔率、平均余灵、专精/三绝达成率
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
    highlightCell(){}, showQuizResult(){}, showSky(){}, showLandmark(){}, skyExpired(){},
    showTalentGain(){}, showPalaceIntro(){}, async showResult(){},
    async askReplaceTalent(){ return 0; },
    async askBranch(br, cell, cost, insp){ return insp >= cost+8; },
    async askScenic(cell, cost, insp){ return (insp||0) >= (cost||0); },
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

function buildCfg(specialistScore, quizInsp){
  const cfg2 = { ...cfg };
  cfg2.attrs = JSON.parse(JSON.stringify(cfg.attrs));
  cfg2.inspiration = JSON.parse(JSON.stringify(cfg.inspiration));
  cfg2.grades = JSON.parse(JSON.stringify(cfg.grades));
  const lp = cfg2.grades.dimensions.find(d=>d.key==='liupai');
  const sx = lp.tiers.find(t=>t.id==='shixian');
  if (sx) sx.score = specialistScore;           // 引擎只读 shixian.score → specialist.bonus
  cfg2.inspiration.quizCorrectInsp = quizInsp;  // 代码默认 ?? 0（关）；=1 开启
  return cfg2;
}

async function runScenario(name, specialistScore, quizInsp, N, quizAcc){
  const cfg2 = buildCfg(specialistScore, quizInsp);
  let scores=[], fengbi=0, inspLeft=[], spec=0, sanjue=0;
  for (let i=0;i<N;i++){
    const rand = rng(91000+i);
    const g = new Game(cfg2, makeUI(rand, quizAcc), rand);
    g.start(cfg.schools[i % cfg.schools.length].id);
    let guard=0;
    while(!g.s.over && guard++<200){ await g.playTurn(); }
    const sum = R.sixDimScore({ attrs:g.s.attrs, battle:g.s.battle, events:g.s.events,
      finish:{ reached:g.s.reachedEnd, inspirationLeft:g.s.inspiration, turns:g.s.turn, palaceSweep:g.s.palaceWins>=3 } }, cfg2.grades);
    scores.push(sum.total);
    if (g.s.endReason==='fengbi') fengbi++;
    inspLeft.push(g.s.inspiration);
    const cre=[g.s.attrs.shi||0, g.s.attrs.ci||0, g.s.attrs.lian||0];
    const wbs=g.s.battle.winsByStyle||{};
    if (cre.every(v=>v>=14)) sanjue++;
    let isSpec=false;
    for (let k=0;k<3;k++){ if (cre[k] > (cre[0]+cre[1]+cre[2]-cre[k]) && cre[k]>=30 && (wbs[['shi','ci','lian'][k]]||0)>=3) isSpec=true; }
    if (isSpec) spec++;
  }
  scores.sort((a,b)=>a-b);
  const pct=(p)=>scores[Math.max(0,Math.min(scores.length-1,Math.floor(p*(scores.length-1))))];
  const mean=scores.reduce((s,x)=>s+x,0)/N, sd=Math.sqrt(scores.reduce((s,x)=>s+(x-mean)**2,0)/N);
  const tiers={}; for(const s of scores){ const gr=R.gradeOf(s, cfg2.grades.grades||cfg2.grades.tiers); tiers[gr.name]=(tiers[gr.name]||0)+1; }
  const order=(cfg2.grades.grades||cfg2.grades.tiers).map(g=>g.name);
  const tierStr=order.map(n=>n+':'+((tiers[n]||0)/N*100).toFixed(0)+'%').join(' ');
  return { name, mean:Math.round(mean), sd:Math.round(sd), p10:pct(.1), p50:pct(.5), p90:pct(.9),
    fengbi:(fengbi/N*100).toFixed(1)+'%', avgInsp:Math.round(inspLeft.reduce((s,x)=>s+x,0)/N),
    spec:(spec/N*100).toFixed(1)+'%', sanjue:(sanjue/N*100).toFixed(1)+'%', tierStr, scores };
}

function pctAt(arr,p){ return arr[Math.max(0,Math.min(arr.length-1,Math.floor(p*(arr.length-1))))]; }
function rebandFit(scores){
  const CUTS=[0,0.04,0.12,0.26,0.42,0.58,0.74,0.87,0.95,1.0];
  const ids=["tongsheng","xiucai","juren","jinshi","tanhua","bangyan","zhuangyuan","hanlin","wenzong"];
  const cutScores=CUTS.map(c=>Math.round(pctAt(scores,c)/50)*50);
  const bands=[];
  for(let i=0;i<9;i++){ const lo=(i===0)?0:cutScores[i]; const hi=(i<8)?cutScores[i+1]-1:null; bands.push({id:ids[i],min:lo,max:hi}); }
  return bands;
}

const N=2000;
(async()=>{
  console.log('quizAcc=0.75, N='+N);
  const rows=[
    await runScenario('baseline(专精150/不回灵)', 150, 0, N, 0.75),
    await runScenario('P1-1 only(专精210)', 210, 0, N, 0.75),
    await runScenario('P1-3 only(答对+1)', 150, 1, N, 0.75),
    await runScenario('BOTH(专精210+答对+1)', 210, 1, N, 0.75),
  ];
  console.log('场景'.padEnd(26), 'mean  sd   p10   p50   p90  封笔  余灵  专精   三绝');
  for(const r of rows){
    console.log(r.name.padEnd(24),
      String(r.mean).padStart(4), String(r.sd).padStart(4), String(r.p10).padStart(5), String(r.p50).padStart(5), String(r.p90).padStart(5),
      String(r.fengbi).padStart(5), String(r.avgInsp).padStart(4), String(r.spec).padStart(5), String(r.sanjue).padStart(5));
  }
  console.log('');
  for(const r of rows){ console.log(r.name); console.log('  '+r.tierStr); }

  // 基于 BOTH 分布重拟合带宽（P1-1+P1-3 改变了分布，须重拟合，否则文宗过载）
  const both = rows[3].scores;
  console.log('=== BOTH 分布百分位 ===');
  console.log('p04',pctAt(both,.04),'p12',pctAt(both,.12),'p26',pctAt(both,.26),'p42',pctAt(both,.42),
    'p50',pctAt(both,.5),'p58',pctAt(both,.58),'p74',pctAt(both,.74),'p87',pctAt(both,.87),'p95',pctAt(both,.95),'p99',pctAt(both,.99));
  const bands = rebandFit(both);
  console.log('=== 提议重拟合带宽(BOTH分布) ===');
  console.log(JSON.stringify(bands));
  const tiers={}; for(const s of both){ const gr=R.gradeOf(s, bands); tiers[gr.id]=(tiers[gr.id]||0)+1; }
  const nmById=Object.fromEntries((cfg.grades.grades||cfg.grades.tiers).map(g=>[g.id,g.name]));
  console.log('=== 重拟合后 BOTH 达成率 ===');
  console.log(Object.fromEntries(bands.map(b=>[nmById[b.id],((tiers[b.id]||0)/both.length*100).toFixed(1)+'%'])));
})();
