// 飞花棋·按档位统计玩家对阵 NPC 的胜率（用于「提高举人级别以上 NPC 强度」校准）
// 用法：node sim_npc_tier_winrate.mjs [N] [quizAcc]
// 输出：总体胜率 + 各档(tierId) 独立胜/平/负 与 对手预算。
import * as R from './feihuaqi-playable/js/engine/rules.js';
import { Game } from './feihuaqi-playable/js/engine/game.js';
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

async function run(N, quizAcc){
  const cfg2 = { ...cfg }; cfg2.attrs = JSON.parse(JSON.stringify(cfg.attrs));
  const total={w:0,l:0,d:0};
  const perTier={};
  for (let i=0;i<N;i++){
    const rand = rng(4000+i);
    const g = new Game(cfg2, makeUI(rand, quizAcc), rand);
    g.start(cfg.schools[i % cfg.schools.length].id);
    let guard=0;
    while(!g.s.over && guard++<200){ await g.playTurn(); }
    // 战斗中无法回溯 tierId；改为在 battle 时记录 → 通过 hook 到 resolve 不可靠。
    // 此处改为跟踪：收集所有已记录的对手（解析 s.battle 无法分档）。
    // 真正分档：在 g 之上包一层 event，监听 runBattle 调用。用 UI.runBattle 的 session.npc.tierId。
  }
  return { total, perTier };
}

// 因分档统计需要拦截 UI.runBattle，重写为直接计数
async function run2(N, quizAcc){
  const cfg2 = { ...cfg }; cfg2.attrs = JSON.parse(JSON.stringify(cfg.attrs));
  const total={w:0,l:0,d:0};
  const perTier={};
  const wins={},losses={},draws={};
  let debugCount=0;
  for (let i=0;i<N;i++){
    const rand = rng(4000+i);
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
    const g = new Game(cfg2, ui, rand);
    g.start(cfg.schools[i % cfg.schools.length].id);
    let guard=0;
    while(!g.s.over && guard++<200){ await g.playTurn(); }
  }
  const keys = new Set([...Object.keys(wins),...Object.keys(losses),...Object.keys(draws)]);
  for (const k of keys) perTier[k] = { w:wins[k]||0, l:losses[k]||0, d:draws[k]||0 };
  return { total, perTier };
}

// 预算表
function budgetMap(){
  const m={};
  for(const t of cfg.npcs||[]){ const s=(t.npcs||[]).reduce((sum,n)=>sum+Object.values(n.attrs||{}).reduce((a,b)=>a+Number(b||0),0),0);
    m[t.id]={ budget: t.npcs&&t.npcs.length? s/t.npcs.length : 0, npcs: (t.npcs||[]).length }; }
  return m;
}

const N = Number(process.argv[2]) || 3000;
const acc = Number(process.argv[3]) || 0.75;
(async()=>{
  const { total, perTier } = await run2(N, acc);
  const fmt=(o)=>{ const t=o.w+o.l+o.d; return `${(o.w/t*100).toFixed(1)}%  (${o.w}胜/${o.l}负/${o.d}平, n=${t}${t==0?'':` 玩家胜率`})`; };
  console.log(`quizAcc=${acc}  N=${N}`);
  console.log('=== 总体胜率 ===', (total.w/(total.w+total.l+total.d)*100).toFixed(1), '%  ', `(${total.w}/${total.l}/${total.d})`);
  console.log('=== 各档预算(平均六维和) ===', JSON.stringify(budgetMap(),null,0));
  console.log('=== 各档玩家胜率（非殿试）===');
  for (const k of Object.keys(perTier).sort()) if(!k.startsWith('palace:')) console.log(`  ${k}:  ${fmt(perTier[k])}`);
  console.log('=== 殿试（按档次名合并为 palace）===');
  const pw={w:0,l:0,d:0}; for(const k of Object.keys(perTier)) if(k.startsWith('palace:')){ pw.w+=perTier[k].w; pw.l+=perTier[k].l; pw.d+=perTier[k].d; }
  if(pw.w+pw.l+pw.d) console.log(`  palace: ${fmt(pw)}`);
})();
