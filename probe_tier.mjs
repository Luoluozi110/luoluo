import * as R from './feihuaqi-playable/js/engine/rules.js';
import { Game } from './feihuaqi-playable/js/engine/game.js';
import fs from 'fs';
const D='feihuaqi-playable/config/';
const cfg={};
for(const n of ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies','npc-mechanics']) try{cfg[n]=JSON.parse(fs.readFileSync(D+n+'.json','utf8'));}catch{cfg[n]=[];}
const board=cfg.board,byId=new Map(); for(const c of board.mainRing) byId.set(c.id,{...c,ring:'main'}); board.cellById=byId; board.laps=Number(board.laps)||2; board.ringSize=board.mainRing.length;
cfg.questions=(cfg.questions||[]).filter(q=>q.enabled!==false); cfg.events=(cfg.events||[]).filter(e=>e.enabled!==false); cfg.affinity.themeNames||={}; cfg.affinity.mannerNames||={}; cfg.affinity.matrix||={}; cfg.talentById=new Map(cfg.talents.map(t=>[t.id,t]));
function rng(s){return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
let seen=0;
const ui={floatAttrs(){},floatInspiration(){},onState(){},toast(){},showTalentGain(){},askReplaceTalent:async()=>0,showQuiz:async()=>({index:0,timedOut:false}),showEvent:async()=>0,
 runBattle:async(session)=>{
   if(seen++<3) console.log('SESSION npc keys:', Object.keys(session.npc), 'tierId=',session.npc.tierId);
   let style=session.canUseStyle('shi')?'shi':'ci'; let manner=session.manners[0];
   const dice=1+Math.floor(Math.random()*6); const out=session.resolve(style,manner,dice);
   if(seen<=4) console.log('OUT result=',out.result);
   return out;
 }};
const g=new Game(cfg,ui,rng(1)); g.start(cfg.schools[0].id);
g.s.pos=55; // 举人圈
let guard=0; while(!g.s.over && guard++<400){ await g.playTurn(); }
console.log('done, battles seen=',seen);
