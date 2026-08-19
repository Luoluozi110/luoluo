#!/usr/bin/env node
/*
 * 流派熟练度 · 平衡性仿真（Monte Carlo）
 * 用真实引擎驱动多局，对比 三派 × Lv1(裸局) vs Lv5(满级+9 主属性) 的：
 *   - 结算总分分布（median / p90 / max）
 *   - 通关率（reachedEnd）、文宗率、殿试金榜率
 *   - 属性 soft-cap 护栏是否让高分不失控（重点：Lv5 +9 不显著抬高右尾）
 * 用法：node sim_mastery_balance.mjs [N每档每等级]
 * 注：仅仿真，不修改任何 playable 文件。
 */
import fs from 'fs';
import * as R from './feihuaqi-playable/js/engine/rules.js';
import { Game, Reincarnate } from './feihuaqi-playable/js/engine/game.js';
import * as Album from './feihuaqi-playable/js/engine/album.js';

const D = 'feihuaqi-playable/config/';
const cfg = {};
for (const n of ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies','npc-mechanics','talent-upgrade']) {
  try { cfg[n] = JSON.parse(fs.readFileSync(D+n+'.json','utf8')); } catch { cfg[n] = []; }
}
const board = cfg.board;
const byId = new Map();
for (const c of board.mainRing) byId.set(c.id, { ...c, ring:'main' });
board.cellById = byId; board.laps = Number(board.laps)||2; board.ringSize = board.mainRing.length;
cfg.questions = (cfg.questions||[]).filter(q=>q.enabled!==false);
cfg.events = (cfg.events||[]).filter(e=>e.enabled!==false);
const af=cfg.affinity; af.themeNames=af.themeNames||{}; af.mannerNames=af.mannerNames||{}; af.matrix=af.matrix||{};
cfg.talentById = new Map((cfg.talents||[]).map(t=>[t.id,t]));
cfg.talentUpgradeById=new Map(Object.entries(cfg['talent-upgrade']||{}));

function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

function makeUI(rand, quizAcc){
  return {
    floatAttrs(){}, floatInspiration(){}, onState(){}, showDice(){}, movePiece(){}, toast(){},
    highlightCell(){}, showQuizResult(){}, showSky(){}, skyExpired(){}, showTalentGain(){}, showPalaceIntro(){},
    async showResult(){}, async askReplaceTalent(){ return 0; },
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

async function playOne(schoolId, xp, seed, quizAcc){
  Album.resetStore();
  let store = Album.emptyStore();
  store.mastery[schoolId] = Album.masteryEntry(xp);   // xp=0→Lv1, xp=340→Lv5
  Album.saveStore(store);
  Reincarnate._write(null);
  const rand = rng(seed);
  const ui = makeUI(rand, quizAcc);
  const g = new Game(cfg, ui, rand);
  g.push=()=>{};
  g.start(schoolId, {name:''});
  let guard=0;
  while(!g.s.over && guard++<200){ await g.playTurn(); }
  return g.s;
}

// 纯离线结算分（不再次 commitAlbum，避免 Album store 干扰）：复用 sixDimScore
function settleScore(s){
  return R.sixDimScore({
    attrs: s.attrs,
    battle: s.battle,
    events: s.events,
    finish: { reached: s.reachedEnd, inspirationLeft: s.inspiration, turns: s.turn, palaceSweep: s.palaceWins >= 3 }
  }, cfg.grades);
}

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const a = [...arr].sort((x,y)=>x-y);
  const i = Math.min(a.length-1, Math.floor(a.length*p));
  return a[i];
};

const N = Number(process.argv[2]) || 2500;
const QUIZ = Number(process.argv[3]) || 0.75;
const SCHOOLS = ['bowen','qishi','cizong_bi'];
const LV = [[0,'Lv1'],[340,'Lv5']];

(async()=>{
  console.log(`\n流派熟练度平衡仿真  N每档每等级=${N}  quizAcc=${QUIZ}`);
  console.log('对比：三派 Lv1(裸局) vs Lv5(主属性+9 + 机制增强)\n');
  const rows = [];
  for (const schoolId of SCHOOLS){
    const school = cfg.schools.find(s=>s.id===schoolId) || {name:schoolId};
    for (const [xp, lvName] of LV){
      const totals=[], counters={reached:0,wenzong:0,jinbang:0};
      const attrSum={bi:[],xue:[],si:[],shi:[],ci:[],lian:[]};
      for (let i=0;i<N;i++){
        const s = await playOne(schoolId, xp, 900000 + SCHOOLS.indexOf(schoolId)*10000000 + (xp?500000:0) + i, QUIZ);
        const scr = settleScore(s).total;
        totals.push(scr);
        if (s.reachedEnd) counters.reached++;
        if (scr >= 3800) counters.wenzong++;
        if (s.reachedEnd && s.palaceWins >= 3) counters.jinbang++;
        for (const k of ['bi','xue','si','shi','ci','lian']) attrSum[k].push(s.attrs[k]||0);
      }
      const avgAttr = Object.fromEntries(Object.entries(attrSum).map(([k,v])=>[k,(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1)]));
      const med = pct(totals,0.5), p90=pct(totals,0.9), p99=pct(totals,0.99), mx=pct(totals,1.0);
      rows.push({school:school.name, lv:lvName, med, p90, p99, mx,
        reach:(counters.reached/N*100).toFixed(1), wenz:(counters.wenzong/N*100).toFixed(1), jin:(counters.jinbang/N*100).toFixed(1), avgAttr});
      console.log(`  ${school.name}  ${lvName}:  总分中位 ${med}  p90 ${p90}  p99 ${p99}  峰值 ${mx}  | 通关 ${(counters.reached/N*100).toFixed(1)}%  文宗 ${(counters.wenzong/N*100).toFixed(1)}%  金榜 ${(counters.jinbang/N*100).toFixed(1)}%`);
      console.log(`      avg attrs bi/xue/si/shi/ci/lian = ${Object.values(avgAttr).join(' / ')}`);
    }
  }

  // 汇总对比：Lv5 vs Lv1 的增量
  console.log('\n=== Lv5 相对 Lv1 的位移（右尾是否失控看 p99/峰值 增长）===');
  for (const schoolId of SCHOOLS){
    const school = cfg.schools.find(s=>s.id===schoolId) || {name:schoolId};
    const l1 = rows.find(r=>r.school===school.name && r.lv==='Lv1');
    const l5 = rows.find(r=>r.school===school.name && r.lv==='Lv5');
    console.log(`  ${school.name}:  中位 ${l1.med}→${l5.med} (+${l5.med-l1.med})  p99 ${l1.p99}→${l5.p99} (+${l5.p99-l1.p99})  峰值 ${l1.mx}→${l5.mx} (+${l5.mx-l1.mx})  通关 ${l1.reach}→${l5.reach}  文宗 ${l1.wenz}→${l5.wenz}`);
  }
  console.log('\n判定：若 p99/峰值仅小幅上移（soft-cap 门槛 51/39）即证明 +9 不失控；若某派显著右移或一家独大则需回调。');
})();
