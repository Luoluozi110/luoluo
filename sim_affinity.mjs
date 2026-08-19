// 相性2.0 验证仿真：对照「旧稀疏矩阵(旋钮归零)」vs「新相性2.0」，量化平衡与变化性。
import * as R from './feihuaqi-playable/js/engine/rules.js';
import { Game } from './feihuaqi-playable/js/engine/game.js';
import * as Album from './feihuaqi-playable/js/engine/album.js';
import fs from 'fs';

const D = 'feihuaqi-playable/config/';
const base = {};
for (const n of ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album']) {
  try { base[n] = JSON.parse(fs.readFileSync(D+n+'.json','utf8')); } catch { base[n] = []; }
}
// 原地归一化（保留 Map，供引擎直接消费）
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

function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

// 旧稀疏矩阵（旋钮归零、学派无 homeManner），作为对照基线
const OLD_MATRIX = {
  "haofang.biansai": 0.10, "wanyue.songbie": 0.10, "zheli.huaigu": 0.10,
  "wanyue.yongwu": 0.10, "zheli.shanshui": 0.10, "wanyue.jieling": 0.10,
  "haofang.huaigu": 0.05, "zheli.yongwu": 0.05, "haofang.shanshui": 0.05, "wanyue.shanshui": 0.05,
  "haofang.songbie": -0.05, "wanyue.biansai": -0.05, "zheli.jieling": -0.05
};

function makeUI(rand, quizAcc, holder, probe){
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
      if (probe && holder.g && holder.g._probe) holder.g._probe.record(out.manner, holder.g.s.affStreak.n);
      return out;
    }
  };
}

function cloneCfg(){
  // 浅拷贝保留 board/Map 等引用；仅深拷贝会被改写的 attrs
  const c = { ...base };
  c.attrs = JSON.parse(JSON.stringify(base.attrs));
  c.talentById = base.talentById;
  return c;
}

async function runGames(N, quizAcc, mode, probe){
  const cfg2 = cloneCfg();
  if (mode === 'old') {
    cfg2.affinity = { ...base.affinity, matrix: OLD_MATRIX,
      homeMannerBonus:0, homeAdaptiveBonus:0, zeitgeistThemeBonus:0, zeitgeistMannerBonus:0, momentumPer:0, momentumMax:5 };
    cfg2.schools = base.schools.map(s=>({ ...s, homeManner: undefined }));
  }
  const scores=[], turns=[]; let fengbi=0, win=0, loss=0, draw=0, battles=0;
  const dom=Object.fromEntries(((cfg2.affinity && cfg2.affinity.manners) || ['wanyue','haofang','zheli']).map(m => [m, 0])), zgSet=new Set();
  let maxStreakSum=0;
  for (let i=0;i<N;i++){
    const rand = rng(7000+i);
    const holder = { g: null };
    const ui = makeUI(rand, quizAcc, holder, probe);
    const g = new Game(cfg2, ui, rand);
    holder.g = g;
    g.start(base.schools[i % base.schools.length].id);
    const gp = probe ? { record(m,n){ this.counts[m]=(this.counts[m]||0)+1; if(n>this.max) this.max=n; }, counts:{}, max:0 } : null;
    if (gp) g._probe = gp;
    let guard=0;
    while(!g.s.over && guard++<200){ await g.playTurn(); }
    if (gp){ const cs=gp.counts; let dm=null,dv=-1; for(const m in cs) if(cs[m]>dv){dv=cs[m];dm=m;} if (dm && Object.prototype.hasOwnProperty.call(dom, dm)) dom[dm]++; maxStreakSum+=gp.max; }
    zgSet.add(g.s.zeitgeist.theme+'/'+g.s.zeitgeist.manner);
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
  return { mode, mean:Math.round(mean), sd:Math.round(sd), p10:pct(.1), p50:pct(.5), p90:pct(.9),
    fengbiRate:(fengbi/N*100).toFixed(1)+'%', winRate:wr.toFixed(1)+'%',
    avgTurns:Math.round(turns.reduce((s,x)=>s+x,0)/N), avgBattles:Math.round(battles/N),
    tiers:Object.fromEntries(Object.entries(tiers).map(([k,v])=>[k,(v/N*100).toFixed(0)+'%'])),
    dominantManner: Object.fromEntries(Object.entries(dom).map(([k,v])=>[k,(v/N*100).toFixed(0)+'%'])),
    avgMaxStreak:(maxStreakSum/N).toFixed(1), distinctZeitgeist:zgSet.size };
}

const N=2000;
(async()=>{
  console.log('=== 旧相性(稀疏矩阵, 旋钮归零)  quizAcc=0.75 ===');
  console.log(JSON.stringify(await runGames(N,0.75,'old',true),null,0));
  console.log('=== 新相性2.0(稠密矩阵+文风+风潮+气势)  quizAcc=0.75 ===');
  console.log(JSON.stringify(await runGames(N,0.75,'new',true),null,0));
  console.log('=== 新相性2.0  低熟练0.55 ===');
  console.log(JSON.stringify(await runGames(N,0.55,'new',true),null,0));
})();
