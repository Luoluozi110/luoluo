/**
 * A5 回归仿真：确认 NPC 三机制接入后，完整 playTurn 闭环不崩溃、
 * 全局平衡（分档分布/封笔率/胜率）未被机制 NPC 破坏，且机制 NPC 会被正常遇到与结算。
 * 规模较小（N=120），用于阶段 A 交付前的健康度检查；精确调参留阶段 E。
 */
import * as R from './feihuaqi-playable/js/engine/rules.js';
import { Game } from './feihuaqi-playable/js/engine/game.js';
import fs from 'node:fs';

const D = 'feihuaqi-playable/config/';
const base = {};
for (const n of ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies','npc-mechanics']) {
  try { base[n] = JSON.parse(fs.readFileSync(D+n+'.json','utf8')); } catch { base[n] = []; }
}
const board = base.board;
const byId = new Map();
for (const c of board.mainRing) byId.set(c.id, { ...c, ring:'main' });
const declared = new Map();
for (const c of (board.branchCells||[])) declared.set(c.id, c);
for (const [bid,br] of Object.entries(board.branches||{})) {
  br.id = bid; const BT=['ping','quiz','event','battle','landmark'];
  br.cells.forEach((cid,i)=>{ const d=declared.get(cid)||{}; byId.set(cid,{id:cid,type:d.type||BT[i]||'ping',name:d.name||`${br.landmark}·${i+1}`,branch:bid,branchIndex:i,ring:'branch'}); });
}
board.cellById=byId; board.gateOf={};
for (const [g,b] of Object.entries(board.branchGates||{})) board.gateOf[b]=Number(g);
board.laps=Number(board.laps)||2; board.ringSize=board.mainRing.length;
base.questions=(base.questions||[]).filter(q=>q.enabled!==false);
base.events=(base.events||[]).filter(e=>e.enabled!==false);
base.talentById=new Map((base.talents||[]).map(t=>[t.id,t]));

function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function makeUI(rand){ return {
  floatAttrs(){}, floatInspiration(){}, onState(){}, showDice(){}, movePiece(){}, toast(){},
  highlightCell(){}, showQuizResult(){}, showSky(){}, showLandmark(){}, skyExpired(){},
  showTalentGain(){}, showPalaceIntro(){}, async showResult(){}, async askReplaceTalent(){ return 0; },
  async askBranch(br,c,cost,insp){ return insp>=cost+8; },
  async showQuiz(q){ let idx=Math.floor(rand()*((q.options||[]).length||1)); return { index:idx, timedOut:false }; },
  async askScenic(cell, cost, insp){ return insp >= cost; },
  async showEvent(ev){ const ch=(ev.choices||[]).length; return ch?Math.floor(rand()*ch):0; },
  async runBattle(session){
    const a=session.playerAttrs; const allow=['shi','ci','lian'].filter(s=>session.canUseStyle(s));
    let style=allow[0],best=-1; for(const s of allow){const v=R.expectedScore(a,s); if(v>best){best=v;style=s;}}
    let manner=session.manners[0],mv=-Infinity; for(const m of session.manners){const v=session.affinityOf(m); if(v>mv){mv=v;manner=m;}}
    const dice=1+Math.floor(rand()*6);
    return session.resolve(style, manner, dice);
  }
};}

const MECH_IDS = new Set(['zhou_xiaoman','lin_qingzhai','fan_jieyuan','su_mingzhe','ouyang_han','yuwen_yuan','wang_shilang']);

(async () => {
  const N = 120;
  const scores = []; let fengbi=0, win=0, loss=0, draw=0, battles=0, mechBattles=0, mechWeakHits=0, mechSignHits=0, errors=0;
  const encountered = {};
  for (let i=0;i<N;i++){
    const rand = rng(9000+i);
    const ui = makeUI(rand);
    const g = new Game({...base}, ui, rand);
    g.start(base.schools[i % base.schools.length].id);
    let guard=0; let hasError=false;
    try {
      // 额外探针：在每个 runBattle 结束后统计本次对战是否机制 NPC
      const origRunBattle = ui.runBattle.bind(ui);
      ui.runBattle = async (session) => {
        const out = await origRunBattle(session);
        const id = session.npc && session.npc.id;
        if (MECH_IDS.has(id)) {
          mechBattles++;
          encountered[id] = (encountered[id]||0)+1;
          if (out.mech && out.mech.tri && out.mech.tri.level) mechSignHits++;
          if (out.mech && out.mech.wea && out.mech.wea.hit) mechWeakHits++;
        }
        return out;
      };
      while(!g.s.over && guard++<250){ await g.playTurn(); }
    } catch(e) { hasError=true; errors++; console.error('局', i, '异常:', e.message, e.stack); break; }
    if (hasError) continue;
    const sum = R.sixDimScore({ attrs:g.s.attrs, battle:g.s.battle, events:g.s.events,
      finish:{ reached:g.s.reachedEnd, inspirationLeft:g.s.inspiration, turns:g.s.turn, palaceSweep:g.s.palaceWins>=3 } }, base.grades);
    scores.push(sum.total);
    if (g.s.endReason==='fengbi') fengbi++;
    win+=g.s.battle.win; loss+=g.s.battle.loss; draw+=g.s.battle.draw;
    battles += g.s.battle.win+g.s.battle.loss+g.s.battle.draw;
  }
  scores.sort((a,b)=>a-b);
  const pct=(p)=>scores[Math.floor(p*(scores.length-1))];
  const mean=scores.reduce((s,x)=>s+x,0)/N;
  const sd=Math.sqrt(scores.reduce((s,x)=>s+(x-mean)**2,0)/N);
  const tiers={}; for(const s of scores){ const gr=R.gradeOf(s, base.grades.grades||base.grades.tiers); tiers[gr.name]=(tiers[gr.name]||0)+1; }
  console.log('=== 阶段 A 健康回归（N=120）===');
  console.log('无异常崩溃局数:', N-errors, '/', N);
  console.log('总论战:', battles, '| 胜率:', (win/(win+loss+draw||1)*100).toFixed(1)+'%');
  console.log('机制NPC交战场次:', mechBattles, '| 招牌触发:', mechSignHits, '| 破绽命中:', mechWeakHits);
  console.log('机制NPC分布:', JSON.stringify(encountered));
  console.log('分档分布:', JSON.stringify(Object.fromEntries(Object.entries(tiers).map(([k,v])=>[k,(v/N*100).toFixed(0)+'%']))));
  console.log('平均分:', Math.round(mean), '| sd:', Math.round(sd), '| p10:', pct(.1), 'p50:', pct(.5), 'p90:', pct(.9));
  console.log('封笔率:', (fengbi/N*100).toFixed(1)+'%');
  const healthy = errors===0 && mechBattles>20 && mechWeakHits>0 && mechSignHits>0;
  console.log('\n** 健康判定:', healthy ? 'PASS（闭环稳定，机制正常生效）' : 'FAIL');
  process.exit(healthy?0:1);
})();
