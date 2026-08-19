// 文风扩充验证：对照「3文风旧矩阵」vs「6文风新体系」，量化平衡与变化性。
import * as R from './feihuaqi-playable/js/engine/rules.js';
import { Game } from './feihuaqi-playable/js/engine/game.js';
import fs from 'fs';

const D = 'feihuaqi-playable/config/';
const base = {};
for (const n of ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album']) {
  try { base[n] = JSON.parse(fs.readFileSync(D+n+'.json','utf8')); } catch { base[n] = []; }
}
const board = base.board;
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
base.questions = (base.questions||[]).filter(q=>q.enabled!==false);
base.events = (base.events||[]).filter(e=>e.enabled!==false);
const a0=base.affinity; a0.themeNames=a0.themeNames||{}; a0.mannerNames=a0.mannerNames||{}; a0.matrix=a0.matrix||{};
base.talentById = new Map((base.talents||[]).map(t=>[t.id,t]));

// 3文风旧矩阵（扩充前）。仅作对照基线，量化「变化性」提升。
const OLD3_MATRIX = {
  "wanyue.yongwu": 0.12, "haofang.yongwu": -0.08, "zheli.yongwu": 0.06,
  "wanyue.songbie": 0.12, "haofang.songbie": 0.06, "zheli.songbie": -0.08,
  "wanyue.shanshui": 0.06, "haofang.shanshui": 0.12, "zheli.shanshui": -0.08,
  "wanyue.biansai": -0.08, "haofang.biansai": 0.12, "zheli.biansai": 0.06,
  "wanyue.huaigu": 0.06, "haofang.huaigu": 0.06, "zheli.huaigu": 0.12,
  "wanyue.jieling": -0.08, "haofang.jieling": 0.06, "zheli.jieling": 0.12
};
const OLD3_MANNERS = ['wanyue','haofang','zheli'];
const OLD3_SCHOOLS = base.schools.map(s=>{
  const m = { shixian:'haofang', cizong:'wanyue', liansheng:'zheli', tongru:'adaptive', qishi:'haofang' }[s.id];
  return { ...s, homeManner: m };
});

function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

function makeUI(rand, quizAcc, holder, pickCounter, streakTrack){
  let cur = 0, curM = null;
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
      const out = session.resolve(style, manner, dice);
      if (pickCounter) pickCounter[manner] = (pickCounter[manner]||0)+1;  // 每场实际选用风格
      // 追踪同风格连胜峰值（与引擎气势层口径一致：胜且同风格+1，败/换风格清零）
      if (out.result === 'win') { if (manner === curM) cur++; else { cur = 1; curM = manner; } }
      else { cur = 0; curM = null; }
      if (streakTrack) streakTrack.max = Math.max(streakTrack.max, cur);
      return out;
    }
  };
}

function cloneCfg(){
  const c = { ...base };
  c.attrs = JSON.parse(JSON.stringify(base.attrs));
  c.talentById = base.talentById;
  return c;
}

async function runGames(N, quizAcc, mode){
  const cfg2 = cloneCfg();
  if (mode === 'old3') {
    cfg2.affinity = { ...base.affinity, manners: OLD3_MANNERS, matrix: OLD3_MATRIX };
    cfg2.schools = OLD3_SCHOOLS;
  }
  const ALL_MANNERS = (mode==='old3') ? OLD3_MANNERS : base.affinity.manners;
  const scores=[], turns=[]; let fengbi=0, win=0, loss=0, draw=0, battles=0;
  const pickCounter = {}; ALL_MANNERS.forEach(m=>pickCounter[m]=0);
  const zgSet=new Set(); let maxStreakSum=0;
  for (let i=0;i<N;i++){
    const rand = rng(9000+i);
    const holder = { g:null };
    const streakTrack = { max: 0 };
    const ui = makeUI(rand, quizAcc, holder, pickCounter, streakTrack);
    const g = new Game(cfg2, ui, rand);
    holder.g = g;
    g.start(base.schools[i % base.schools.length].id);
    let guard=0;
    while(!g.s.over && guard++<200){ await g.playTurn(); }
    zgSet.add(g.s.zeitgeist.theme+'/'+g.s.zeitgeist.manner);
    maxStreakSum += streakTrack.max;
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
  const wr = (win+loss+draw)? (win/(win+loss+draw)*100):0;
  const totalPicks = ALL_MANNERS.reduce((s,m)=>s+pickCounter[m],0)||1;
  const pickDist = Object.fromEntries(ALL_MANNERS.map(m=>[m,(pickCounter[m]/totalPicks*100).toFixed(0)+'%']));
  const lowest = ALL_MANNERS.reduce((a,m)=> pickCounter[m]<pickCounter[a]?m:a, ALL_MANNERS[0]);
  return {
    mode, mean:Math.round(mean), sd:Math.round(sd), p10:pct(.1), p50:pct(.5), p90:pct(.9),
    fengbiRate:(fengbi/N*100).toFixed(1)+'%', winRate:wr.toFixed(1)+'%',
    avgTurns:Math.round(turns.reduce((s,x)=>s+x,0)/N), avgBattles:Math.round(battles/N),
    tiers:Object.fromEntries(Object.entries(tiers).map(([k,v])=>[k,(v/N*100).toFixed(0)+'%'])),
    pickDist, lowestPickedManner: lowest+'('+(pickCounter[lowest]/totalPicks*100).toFixed(0)+'%)',
    avgMaxStreak:(maxStreakSum/N).toFixed(1), distinctZeitgeist: zgSet.size,
    mannerCount: ALL_MANNERS.length
  };
}

const N=2000;
(async()=>{
  console.log('=== 3文风旧矩阵(对照基线)  quizAcc=0.75 ===');
  console.log(JSON.stringify(await runGames(N,0.75,'old3'),null,0));
  console.log('=== 6文风新体系  quizAcc=0.75 ===');
  console.log(JSON.stringify(await runGames(N,0.75,'new'),null,0));
  console.log('=== 6文风新体系  低熟练0.55 ===');
  console.log(JSON.stringify(await runGames(N,0.55,'new'),null,0));
})();
