/**
 * 诊断低成本破绽的「利用胜率差」：对 wea_crushing_win / wea_base_dice_only /
 * wea_harmonious_manner / wea_style_manner_combo 四类 NPC，
 * 在 plan 策略下统计「命中破绽 vs 未命中破绽」的胜率，定位短板。
 */
import * as R from './feihuaqi-playable/js/engine/rules.js';
import { Game } from './feihuaqi-playable/js/engine/game.js';
import fs from 'node:fs';

const D = 'feihuaqi-playable/config/';
function loadBase() {
  const base = {};
  for (const n of ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies','npc-mechanics']) {
    try { base[n] = JSON.parse(fs.readFileSync(D + n + '.json', 'utf8')); } catch { base[n] = []; }
  }
  const board = base.board; const byId = new Map();
  for (const c of board.mainRing) byId.set(c.id, { ...c, ring: 'main' });
  base.questions = (base.questions||[]).filter(q=>q.enabled!==false);
  base.events=(base.events||[]).filter(e=>e.enabled!==false);
  base.talentById = new Map((base.talents||[]).map(t=>[t.id,t]));
  board.cellById = byId; board.gateOf={}; board.laps=Number(board.laps)||2; board.ringSize=board.mainRing.length;
  for (const [g,b] of Object.entries(board.branchGates||{})) board.gateOf[b]=Number(g);
  const declared = new Map(); for (const c of (board.branchCells||[])) declared.set(c.id,c);
  for (const [bid,br] of Object.entries(board.branches||{})) { const BT=['ping','quiz','event','battle','landmark']; br.cells.forEach((cid,i)=>{ const d=declared.get(cid)||{}; byId.set(cid,{id:cid,type:d.type||BT[i]||'ping',name:d.name||String(i+1),branch:bid,branchIndex:i,ring:'branch'}); }); }
  return base;
}
function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

const strategyRef = { current: 'planWeakness' };
function decide(strategy, session, rand) {
  const a = session.playerAttrs;
  const allow = ['shi','ci','lian'].filter(s=>true);
  const bestOf=()=>{ let b=allow[0],bv=-Infinity; for(const s of allow){const v=R.expectedScore(a,s); if(v>bv){bv=v;b=s;}} return b; };
  const bestManner=()=>{ let b=session.manners[0],bv=-Infinity; for(const m of session.manners){const v=session.affinityOf(m); if(v>bv){bv=v;b=m;}} return b; };
  const style=bestOf(), manner=bestManner();
  const mech=session.npc&&session.npc.mech; const w=mech&&mech.weakness; const sig=mech&&mech.signature&&(mech.signature.main||mech.signature);
  if(strategy==='simple'){ const dice=rand()<0.3?[1+Math.floor(rand()*6),1+Math.floor(rand()*6)]:[1+Math.floor(rand()*6)]; return {style,manner,dice}; }
  if(strategy==='planWeakness'){
    const path=(()=>{
      if(!w)return null;
      switch(w.template){
        case 'wea_base_dice_only': return {diceMode:'noExtra'};
        case 'wea_harmonious_manner': { const m=(w.manners||[]).find(x=>session.manners.includes(x)); return m?{manner:m} : null; }
        case 'wea_style_manner_combo': { const m=(w.manners||[]).find(x=>session.manners.includes(x)); if(m&&w.style) return {style:w.style,manner:m}; return null; }
        case 'wea_crushing_win': return {diceMode:'aggr'};
        default: return null;
      }
    })();
    if(path){
      let cs=path.style||style, cm=path.manner||manner, dice;
      if(path.diceMode==='noExtra') dice=[1+Math.floor(rand()*6)];
      else if(path.diceMode==='aggr') dice=[1+Math.floor(rand()*6),1+Math.floor(rand()*6),1+Math.floor(rand()*6)];
      else dice=[1+Math.floor(rand()*6)];
      return {style:cs,manner:cm,dice};
    }
    return {style,manner,dice:[1+Math.floor(rand()*6)]};
  }
  return {style,manner,dice:[1+Math.floor(rand()*6)]};
}
function notStyle(s){return ['shi','ci','lian'].filter(x=>x!==s);}
function makeGame(base, rand){
  const ui={ floatAttrs(){},floatInspiration(){},onState(){},showDice(){},movePiece(){},toast(){},highlightCell(){},showQuizResult(){},showSky(){},showLandmark(){},skyExpired(){},showTalentGain(){},showPalaceIntro(){},async showResult(){},async askReplaceTalent(){return 0;},async askBranch(){return true;},async showQuiz(q){return {index:0,timedOut:false};},async askScenic(){return true;},async showEvent(){return 0;},async runBattle(session){const mv=decide(strategyRef.current,session,rand); return session.resolve(mv.style,mv.manner,mv.dice);} };
  const g=new Game({...base},ui,rand); g.start(base.schools[0].id); return {g,ui};
}
async function runBattleOnce(g,npc,theme,isPalace){
  g.s.attrs=JSON.parse(JSON.stringify((npc&&npc.attrs)||{}));
  const session=g.createSession({npc,theme,isPalace});
  const mv=decide(strategyRef.current,session,g.rand);
  const res=session.resolve(mv.style,mv.manner,mv.dice);
  await g.settleBattle(session,res);
  return {session,res,mv};
}

(async()=>{
  const base=loadBase();
  const npcs=[]; for(const t of base.npcs) for(const n of (t.npcs||[])) if(n.mech) npcs.push({npc:n,isFinal:!!t.isFinal});
  const LOW=new Set(['wea_crushing_win','wea_base_dice_only','wea_harmonious_manner','wea_style_manner_combo']);
  const agg={};
  for(const {npc} of npcs){ const t=npc.mech.weakness.template; if(LOW.has(t)&&!agg[t]) agg[t]={hit:{w:0,t:0},miss:{w:0,t:0},sig:{t:0},games:0}; }
  strategyRef.current='planWeakness';
  let idx=0;
  for(const {npc,isFinal} of npcs){
    const t=npc.mech.weakness.template; if(!LOW.has(t)){idx++;continue;}
    for(let rep=0;rep<16;rep++){
      const rand=rng(20260815+idx*7+rep);
      const {g}=makeGame(base,rand);
      const theme=base.affinity.themes[rand()*base.affinity.themes.length|0];
      const {res}=await runBattleOnce(g,npc,theme,isFinal);
      const c=agg[t]; c.games++;
      if(res.mech&&res.mech.tri&&res.mech.tri.level) c.sig.t++;
      const hit=!!(res.mech&&res.mech.wea&&res.mech.wea.hit);
      if(hit){c.hit.t++; if(res.result==='win')c.hit.w++;}
      else {c.miss.t++; if(res.result==='win')c.miss.w++;}
    }
    idx++;
  }
  console.log('破绽模板 | 出手场 | 命中场 | 命中胜率 | 未命中场 | 未命中胜率 | 利用胜率差 | 招牌触发率');
  for(const [t,c] of Object.entries(agg)){
    const hw=c.hit.t?c.hit.w/c.hit.t*100:0, mw=c.miss.t?c.miss.w/c.miss.t*100:0;
    const diff=c.hit.t&&c.miss.t?hw-mw:0;
    console.log(`${t.padEnd(22)} | ${c.games} | ${c.hit.t} | ${hw.toFixed(1)}% | ${c.miss.t} | ${mw.toFixed(1)}% | ${diff.toFixed(1)}pp | ${(c.sig.t/c.games*100).toFixed(0)}%`);
  }
  process.exit(0);
})();
