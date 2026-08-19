// 飞花棋·品级带宽重拟合仿真 (P1-2)
// 目的：
//  (1) 取"默认配置 + 基准答题率0.75"下的真实总分分布（P0 已生效）
//  (2) 按目标百分位切分，反推九档分数线
//  (3) 对比【当前失效带宽】与【提议带宽】的九档达成率
//  (4) 验证低答题率 0.55 玩家在提议带宽下的落点
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

async function collect(N, quizAcc){
  let scores=[];
  const cfg2 = { ...cfg };
  cfg2.attrs = JSON.parse(JSON.stringify(cfg.attrs));
  for (let i=0;i<N;i++){
    const rand = rng(7000+i);
    const g = new Game(cfg2, makeUI(rand, quizAcc), rand);
    g.start(cfg.schools[i % cfg.schools.length].id);
    let guard=0;
    while(!g.s.over && guard++<200){ await g.playTurn(); }
    const sum = R.sixDimScore({ attrs:g.s.attrs, battle:g.s.battle, events:g.s.events,
      finish:{ reached:g.s.reachedEnd, inspirationLeft:g.s.inspiration, turns:g.s.turn, palaceSweep:g.s.palaceWins>=3 } }, cfg2.grades);
    scores.push(sum.total);
  }
  return scores;
}

const pct=(arr,p)=>arr[Math.max(0,Math.min(arr.length-1,Math.floor(p*(arr.length-1))))];
function tierRates(scores, grades){
  const tiers={}; for(const s of scores){ const gr=R.gradeOf(s, grades); tiers[gr.name]=(tiers[gr.name]||0)+1; }
  const N=scores.length; const order=grades.map(g=>g.name);
  return Object.fromEntries(order.map(n=>[n,((tiers[n]||0)/N*100).toFixed(1)+'%']));
}

// 目标百分位切分（自底向上 9 档，保证顶端稀缺、底端托底）
const CUTS = [0, 0.04, 0.12, 0.26, 0.42, 0.58, 0.74, 0.87, 0.95, 1.0];
const NAMES = ["童生","秀才","举人","进士","探花","榜眼","状元","翰林","文宗"];

const N=3000;
(async()=>{
  const s75 = await collect(N,0.75);
  s75.sort((a,b)=>a-b);
  console.log('=== 0.75 分布百分位 ===');
  console.log('min',s75[0],'p04',pct(s75,.04),'p12',pct(s75,.12),'p26',pct(s75,.26),
    'p42',pct(s75,.42),'p50',pct(s75,.5),'p58',pct(s75,.58),'p74',pct(s75,.74),
    'p87',pct(s75,.87),'p95',pct(s75,.95),'p99',pct(s75,.99),'max',s75[s75.length-1]);
  const mean=s75.reduce((s,x)=>s+x,0)/N, sd=Math.sqrt(s75.reduce((s,x)=>s+(x-mean)**2,0)/N);
  console.log('mean',Math.round(mean),'sd',Math.round(sd));

  // 由切分点反推带宽（min 取下界向下取整到 50，max 取上界向上取整到 50）
  // 三派重构 + NPC 回调后新一轮重校准：0.75 中位 3523，旧线(文宗≥3188)塌缩至 79.8% 文宗。
  // 新带宽按 0.75 分布自底向上 20/35/50/62/72/82/90/95 百分位切分，文宗取 top 5% 精英档。
  const ids=["tongsheng","xiucai","juren","jinshi","tanhua","bangyan","zhuangyuan","hanlin","wenzong"];
  // E3 NPC 强度(100/138/174)下"评分更大胆"重校准：0.75 中位 3346(sd 427)，传承模拟不显著抬高得分。
  // 整条阶梯相对 v2.1 整体上移一档，对齐新中位形成底部托底、顶部稀缺的下降钟形；
  // 文宗压到 0.75 top~2% 精英档（≥4300），比 v2.1(≥4200) 更严。
  const proposed=[
    {id:"tongsheng",name:"童生",min:0,max:2999},
    {id:"xiucai",name:"秀才",min:3000,max:3199},
    {id:"juren",name:"举人",min:3200,max:3399},
    {id:"jinshi",name:"进士",min:3400,max:3599},
    {id:"tanhua",name:"探花",min:3600,max:3799},
    {id:"bangyan",name:"榜眼",min:3800,max:3999},
    {id:"zhuangyuan",name:"状元",min:4000,max:4149},
    {id:"hanlin",name:"翰林",min:4150,max:4299},
    {id:"wenzong",name:"文宗",min:4300,max:null},
  ];
  console.log('=== 最终提议带宽（0.75 拟合 + 顶端微调）===');
  console.log(JSON.stringify(proposed));

  console.log('=== 当前带宽 0.75 达成率 ===');
  console.log(JSON.stringify(tierRates(s75, cfg.grades.grades||cfg.grades.tiers)));
  console.log('=== 提议带宽 0.75 达成率（预期贴近目标切分）===');
  console.log(JSON.stringify(tierRates(s75, proposed)));

  const s55 = await collect(N,0.55);
  s55.sort((a,b)=>a-b);
  console.log('=== 0.55 分布百分位 ===');
  console.log('min',s55[0],'p04',pct(s55,.04),'p12',pct(s55,.12),'p26',pct(s55,.26),
    'p42',pct(s55,.42),'p50',pct(s55,.5),'p58',pct(s55,.58),'p74',pct(s55,.74),
    'p87',pct(s55,.87),'p95',pct(s55,.95),'p99',pct(s55,.99),'max',s55[s55.length-1]);
  console.log('=== 提议带宽 0.55 达成率（新手应明显沉底）===');
  console.log(JSON.stringify(tierRates(s55, proposed)));

  // 混合人口（60% 0.75 熟练 + 40% 0.55 新手），更贴近真实玩家构成
  const mixed = s75.concat(s55.map(v=>v)); // 等权；下方按权重重采样
  const mixedW=[];
  for(let i=0;i<N;i++) mixedW.push(s75[i]);
  for(let i=0;i<Math.floor(N*0.67);i++) mixedW.push(s55[i]); // 0.75:0.55 ≈ 60:40
  mixedW.sort((a,b)=>a-b);
  console.log('=== 混合人口(0.75:0.55≈60:40) 百分位 ===');
  console.log('p04',pct(mixedW,.04),'p12',pct(mixedW,.12),'p26',pct(mixedW,.26),
    'p42',pct(mixedW,.42),'p50',pct(mixedW,.5),'p58',pct(mixedW,.58),'p74',pct(mixedW,.74),
    'p87',pct(mixedW,.87),'p95',pct(mixedW,.95),'p99',pct(mixedW,.99));

  const cutM = CUTS.map(c=>Math.round(pct(mixedW,c)/50)*50);
  const proposedMix=[];
  for(let i=0;i<9;i++){
    let lo=(i===0)?0:cutM[i];
    let hi=(i<8)?cutM[i+1]-1:null;
    proposedMix.push({ id:ids[i], name:NAMES[i], min:lo, max:hi });
  }
  console.log('=== 提议带宽(混合人口拟合) ===');
  console.log(JSON.stringify(proposedMix));
  console.log('--- 混合带宽 @0.75 达成率 ---');
  console.log(JSON.stringify(tierRates(s75, proposedMix)));
  console.log('--- 混合带宽 @0.55 达成率（应明显沉底）---');
  console.log(JSON.stringify(tierRates(s55, proposedMix)));
  console.log('--- 混合带宽 @混合人口 达成率（应贴近目标切分）---');
  console.log(JSON.stringify(tierRates(mixedW, proposedMix)));
})();
