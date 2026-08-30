// 文心羁绊验证：对照「羁绊开启」vs「羁绊关闭」，量化平衡与羁绊激活率。
import * as R from './feihuaqi-playable/js/engine/rules.js';
import { Game } from './feihuaqi-playable/js/engine/game.js';
import { normalizeConfig } from './feihuaqi-playable/js/engine/config.js';
import fs from 'fs';

const D = 'feihuaqi-playable/config/';
const base = {};
for (const n of ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies','npc-mechanics','talent-upgrade','narrative','sidequests','sidequest-talents','sidequest-npcs']) {
  try { base[n] = JSON.parse(fs.readFileSync(D+n+'.json','utf8')); } catch { base[n] = []; }
}
normalizeConfig(base);

function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

function makeUI(rand, quizAcc){
  return {
    floatAttrs(){}, floatInspiration(){}, onState(){}, showDice(){}, movePiece(){}, toast(){},
    highlightCell(){}, showQuizResult(){}, showSky(){}, showLandmark(){}, skyExpired(){},
    showTalentGain(){}, showPalaceIntro(){}, async showResult(){},
    async askReplaceTalent(){ return 0; },
    async chooseScenicTalent(candidates, meta){ return meta && String(meta.title || '').includes('战后文心') ? Math.floor(rand() * candidates.length) : -1; },
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

function cloneCfg(mode){
  const c = { ...base };
  c.attrs = JSON.parse(JSON.stringify(base.attrs));
  c.talentById = base.talentById;
  c.synergies = (mode === 'nosyn') ? [] : (base.synergies || []);
  return c;
}

async function runGames(N, quizAcc, mode){
  const cfg2 = cloneCfg(mode);
  const scores=[]; let fengbi=0, win=0, loss=0, draw=0, battles=0;
  const synEver = {}; const synEnd = {};   // 各羁绊「曾激活/终局激活」局数
  for (const sy of (base.synergies||[])) { synEver[sy.id]=0; synEnd[sy.id]=0; }
  let gamesWithSyn=0, maxActiveSum=0;
  for (let i=0;i<N;i++){
    const rand = rng(13000+i);
    const ui = makeUI(rand, quizAcc);
    const g = new Game(cfg2, ui, rand);
    g.start(base.schools[i % base.schools.length].id);
    const seenThisGame = new Set();
    let guard=0;
    while(!g.s.over && guard++<200){ await g.playTurn(); for (const sy of g.s.synergies) seenThisGame.add(sy.id); }
    if (seenThisGame.size) gamesWithSyn++;
    maxActiveSum += g.s.synergies.length;
    for (const id of seenThisGame) synEver[id]++;
    for (const sy of g.s.synergies) synEnd[sy.id]++;
    const sum = R.sixDimScore({ attrs:g.s.attrs, battle:g.s.battle, events:g.s.events,
      finish:{ reached:g.s.reachedEnd, inspirationLeft:g.s.inspiration, turns:g.s.turn, palaceSweep:g.s.palaceWins>=3 } }, cfg2.grades);
    scores.push(sum.total);
    if (g.s.endReason==='fengbi') fengbi++;
    win+=g.s.battle.win; loss+=g.s.battle.loss; draw+=g.s.battle.draw;
    battles += g.s.battle.win+g.s.battle.loss+g.s.battle.draw;
  }
  scores.sort((a,b)=>a-b);
  const pct=(p)=>scores[Math.floor(p*(scores.length-1))];
  const mean = scores.reduce((s,x)=>s+x,0)/N;
  const sd = Math.sqrt(scores.reduce((s,x)=>s+(x-mean)**2,0)/N);
  const tiers={}; for(const s of scores){ const gr=R.gradeOf(s, cfg2.grades.grades||cfg2.grades.tiers); tiers[gr.name]=(tiers[gr.name]||0)+1; }
  const wr = (win+loss+draw)? (win/(win+loss+draw)*100):0;
  return {
    mode, mean:Math.round(mean), sd:Math.round(sd), p10:pct(.1), p50:pct(.5), p90:pct(.9),
    fengbiRate:(fengbi/N*100).toFixed(1)+'%', winRate:wr.toFixed(1)+'%',
    tiers:Object.fromEntries(Object.entries(tiers).map(([k,v])=>[k,(v/N*100).toFixed(0)+'%'])),
    gamesWithSynPct:(gamesWithSyn/N*100).toFixed(0)+'%',
    avgMaxSyn:(maxActiveSum/N).toFixed(2),
    synEver:Object.fromEntries(Object.entries(synEver).map(([k,v])=>[k,(v/N*100).toFixed(0)+'%'])),
    synEnd:Object.fromEntries(Object.entries(synEnd).map(([k,v])=>[k,(v/N*100).toFixed(0)+'%']))
  };
}

const N=Math.max(100, Number(process.env.SIM_GAMES) || 3500);
(async()=>{
  console.log('=== 羁绊关闭(对照)  quizAcc=0.75 ===');
  console.log(JSON.stringify(await runGames(N,0.75,'nosyn'),null,0));
  console.log('=== 羁绊开启  quizAcc=0.75 ===');
  console.log(JSON.stringify(await runGames(N,0.75,'syn'),null,0));
  console.log('=== 羁绊开启  低熟练0.55 ===');
  console.log(JSON.stringify(await runGames(N,0.55,'syn'),null,0));
})();
