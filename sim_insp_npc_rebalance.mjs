import fs from 'fs';
import { Game } from './feihuaqi-playable/js/engine/game.js';
import * as Save from './feihuaqi-playable/js/engine/save.js';
import { RUN_SAVE_VERSION } from './feihuaqi-playable/js/engine/save.js';
import { talentEffectText } from './feihuaqi-playable/js/ui/modals.js';

const D='feihuaqi-playable/config/';
const cfg={};
for(const n of ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies']) cfg[n]=JSON.parse(fs.readFileSync(D+n+'.json','utf8'));
const board=cfg.board, byId=new Map(); for(const c of board.mainRing) byId.set(c.id,{...c,ring:'main'}); board.cellById=byId; board.gateOf={}; board.laps=Number(board.laps)||2; board.ringSize=board.mainRing.length;
cfg.questions=(cfg.questions||[]).filter(q=>q.enabled!==false); cfg.events=(cfg.events||[]).filter(e=>e.enabled!==false); cfg.affinity.themeNames ||= {}; cfg.affinity.mannerNames ||= {}; cfg.affinity.matrix ||= {}; cfg.talentById=new Map(cfg.talents.map(t=>[t.id,t]));
const ui={floatAttrs(){},floatInspiration(){},onState(){},toast(){},showTalentGain:async()=>{},askReplaceTalent:async()=>0};
let pass=0,fail=0; const ok=(c,n)=>{if(c){pass++;console.log('  ✓',n)}else{fail++;console.error('  ✗',n)}}; const eq=(a,b,n)=>ok(JSON.stringify(a)===JSON.stringify(b),`${n}（期望${JSON.stringify(b)}，实际${JSON.stringify(a)}）`);

console.log('\n[1] 灵感基线');
eq(cfg.inspiration.initial,60,'初始灵感=60'); eq(cfg.inspiration.max,80,'基础上限=80'); eq(cfg.inspiration.extraDiceCost,8,'追加骰成本仍为8'); eq(cfg.inspiration.maxExtraDice,2,'最多追加2枚不变');

console.log('\n[2] 新文心配置与限次/互斥');
for(const id of ['T030','T031','T032','T033']) { ok(cfg.talentById.has(id),`${id} 已配置`); ok(!talentEffectText(cfg.talentById.get(id)).includes('效果由配置定义'),`${id} UI文案已接线`); }
const g=new Game(cfg,ui,()=>0); g.start(cfg.schools[0].id); eq(g.s.inspiration,60,'新局灵感60'); eq(g.s.inspirationMax,80,'新局上限80');
const t30=cfg.talentById.get('T030'),t31=cfg.talentById.get('T031'),t32=cfg.talentById.get('T032'),t33=cfg.talentById.get('T033');
g.s.passive.push(t30); g.s.inspiration=20; for(let i=0;i<6;i++) g.triggerTalentLimited(t30,'test'); eq(g.s.inspiration,24,'活水源头总恢复封顶4'); eq(g.s.talentState.triggers.T030,4,'活水源头触发计数=4');
g.s.passive.push(t31); g.s.inspiration=8; for(let i=0;i<5;i++) g.triggerTalentLimited(t31,'test'); eq(g.s.inspiration,14,'枯木逢春总恢复封顶6'); eq(g.s.talentState.triggers.T031,3,'枯木逢春触发计数=3');
await g.grantTalent(t32,{silent:true}); eq(g.s.inspirationMax,86,'蓄水成渊上限+6'); await g.grantTalent(t33,{silent:true}); eq(g.s.inspirationMax,86,'互斥扩容不叠加'); eq(g.s.talentState.flags.inspiration_capacity,'T032','扩容互斥标记稳定');

console.log('\n[3] 条件掉落');
const c2={...cfg,talents:[t33],talentById:new Map([[t33.id,t33]])}; const g2=new Game(c2,ui,()=>0); g2.start(cfg.schools[0].id); g2.s.turn=20; g2.s.phase='lap1'; g2.s.battle.win=8; eq(g2.randomTalent(),null,'海纳百川第一圈不进池'); g2.s.phase='lap2'; eq(g2.randomTalent()?.id,'T033','海纳百川第二圈且5胜后进池'); g2.s.talentState.flags.inspiration_capacity='T032'; eq(g2.randomTalent(),null,'已有扩容标记后永久退池');

console.log('\n[4] NPC档位硬基线与低档保护');
const expected={tongsheng:[28,28,28,28,28,28],xiucai:[50,50,48,50,48,48],juren:[90,90,90,90,90,90],jinshi:[117,117,117,117,117,117],zhukaoguan:[148,148,148]};
for(const tier of cfg.npcs){const sums=(tier.npcs||[]).map(n=>Object.values(n.attrs).reduce((a,b)=>a+Number(b||0),0));eq(sums,expected[tier.id],`${tier.tier} 总预算`)}
const npc=id=>cfg.npcs.flatMap(t=>t.npcs||[]).find(n=>n.id===id); eq(npc('zhou_xiaoman').attrs,{shi:10,ci:4,lian:3,bi:4,xue:4,si:3},'童生周小满保持原值'); eq((npc('ouyang_han').mech.signature.main||npc('ouyang_han').mech.signature).cost,3,'欧阳翰文债耗神=3'); eq((npc('wang_shilang').mech.signature.main||npc('wang_shilang').mech.signature).weaknessDampen,.28,'王侍郎适应阻尼=28%');

console.log(`\n[5] v2→v${RUN_SAVE_VERSION}旧档迁移/钳制`);
const live=Save.serializeRun(g); eq(live.v,RUN_SAVE_VERSION,`新存档版本v${RUN_SAVE_VERSION}`);
const old=JSON.parse(JSON.stringify(live)); old.v=2; old.state.inspirationMax=48; old.state.inspiration=47; delete old.state.talentState; const res=Save.deserializeRun(old,cfg); ok(res.ok,'v2旧档可迁移'); eq(res.state.inspirationMax,80,'旧档基础上限抬至80'); eq(res.state.inspiration,47,'旧档当前灵感保留'); eq(res.state.talentState,{triggers:{},flags:{}},'旧档补空talentState');
const bad=JSON.parse(JSON.stringify(live)); bad.state.inspirationMax=72; bad.state.inspiration=999; const res2=Save.deserializeRun(bad,cfg); eq(res2.state.inspirationMax,80,'已有扩容上限保留'); eq(res2.state.inspiration,80,'超上限当前值钳制');

console.log(`\n结果：${pass} 通过 / ${fail} 失败`); if(fail) process.exit(1);
