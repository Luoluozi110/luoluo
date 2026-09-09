import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game } from '../js/engine/game.js';
import { normalizeConfig, validateConfig, validateProject, applyProjectOverride } from '../js/engine/config.js';
import { serializeRun, deserializeRun, RUN_SAVE_VERSION } from '../js/engine/save.js';
import { Reincarnate, REINCARNATE_KEY } from '../js/engine/reincarnate.js';
import { SCALE, normalizeNumericRates } from '../js/engine/numeric.js';
import * as Album from '../js/engine/album.js';
import * as R from '../js/engine/rules.js';
const read = file => JSON.parse(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const project = () => read('feihua-content.json');
const ui = new Proxy({async askReplaceTalent(){return 0;}}, {get:(o,k)=>o[k]||(()=>{})});
const foe = {id:'v3_test',name:'验算者',attrs:{shi:8,ci:8,lian:8,bi:8,xue:8,si:8}};
function game(school='bowen') {Reincarnate.reset();const g=new Game(normalizeConfig(project()),ui,()=>0.5);g.applyLoadout=()=>{};g.start(school,{tutorial:true});return g;}
function equip(g,ids){g.s.passive=ids.map(id=>g.leveledTalent(g.cfg.talentById.get(id),1)).filter(Boolean);g.s.active=[];}
function resolve(g,pips=[4],style='shi',theme='yongwu'){const s=g.createSession({npc:foe,label:'v3',theme});return [s,g.resolveBattle(s,style,'wanyue',pips)];}

test('cloud config is valid, integer units and ratios stay distinct',()=>{
 const p=project();assert.equal(validateConfig(p).ok,true);assert.equal(validateProject(p).ok,true);
 assert.equal(p.numericVersion,3);assert.equal(p.attrs.initial.shi,5);assert.equal(p.inspiration.initial,36);
 assert.equal(p.synergies.length,74);assert.equal(p.talents.length+p['sidequest-talents'].talents.length,61);
 const cfg=normalizeConfig(p);assert.equal(cfg.talentById.get('T032').effect.fillRatio,.5);
 assert.equal(cfg.talentById.get('T019').effect.thresholdRatio,.5);
 assert.equal(cfg.attrs.styleSystem.shi.lowMult,.85);
 assert.equal(cfg['sidequest-npcs'].routes.jianghu.climax.mech.signature.pct,.08);
 assert.throws(()=>applyProjectOverride(cfg,{numericVersion:2}),/数值版本/);
});
test('study 25+X, manuscript B, strategy 10+S; independent carry thresholds',()=>{
 const g=game();assert.equal(g.studyProgressRate(),36);assert.equal(g.manuscriptFragmentRate(),5);assert.equal(g.strategyIncome(),15);
 assert.equal(g.studyProgressRate({xue:99}),50);assert.equal(g.manuscriptFragmentRate({bi:99}),30);
 const a=g.ensureAbilityState();a.study.progress.shi=70;
 const result=g.gainStudyProgress('shi',10);assert.equal(result.gained,1);assert.equal(result.progress,5);assert.equal(result.need,75);assert.equal(g.s.attrs.shi,6);
 a.strategy.chargeRemainder=5;a.strategy.refillPhase='';assert.equal(g.refillStrategy('v3'),2);assert.equal(a.strategy.chargeRemainder,0);
 assert.equal(SCALE.strategy,10);assert.equal(SCALE.manuscript,20);assert.equal(SCALE.study,25);
});
test('two sixes multiply score but grant fragment reward only once',()=>{
 const g=game();equip(g,['T007','T040']);g.synergySet=()=>[];const [s,out]=resolve(g,[6,6]);
 const detail=out.selfCalc.items.map(x=>x.detail||'').join('\n');
 assert.match(detail,/梦笔生花 \+16%/);assert.match(detail,/妙手偶得 \+16%/);
 assert.equal(out.talentTriggers.find(t=>t.id==='T040').occurrence,2);
 out.result='draw';g.applyAbilityBattleGrowth(s,out);
 assert.equal(g.s.abilityState.manuscript.fragments,25);
});
test('ascending prefix and full bonus add to 52%, S04 also discounts first extra die',()=>{
 const g=game();equip(g,['T005','T016']);const [s,out]=resolve(g,[2,5,6]);
 const detail=out.selfCalc.items.map(x=>x.detail||'').join('\n');
 assert.match(detail,/急智 \+10%/);assert.match(detail,/文思泉涌 \+20%/);
 assert.match(detail,/思涌笔健·续掷 \+6%/);assert.match(detail,/思涌笔健·骰组 \+16%/);
 assert.equal(s.extraDiceCost('shi',1,[2]),1);
});
test('conditional S18 grants manuscript progress only when its theme matches',()=>{
 const g=game();equip(g,['T020','T021']);let [s,out]=resolve(g,[4],'shi','yongwu');
 assert.equal(out.talentTriggers.find(t=>t.id.startsWith('synergy:S18'))?.reward.value,20);
 [s,out]=resolve(g,[4],'shi','shanshui');assert.ok(!out.talentTriggers.some(t=>t.id.startsWith('synergy:S18')));
});
test('nonwin synergies grant insight and queue max next-battle bonus',()=>{
 const g=game();equip(g,['T011','T027','T043']);const [s,out]=resolve(g);out.result='lose';
 g.applyAbilityBattleGrowth(s,out);assert.equal(g.s.nextBattlePct,.08);
 assert.ok(s.resourceReceipt.insight.nominal>=8);assert.equal(s.resourceReceipt.insight.actual,g.insightCap());
 assert.equal(s.resourceReceipt.insight.overflow,s.resourceReceipt.insight.nominal-s.resourceReceipt.insight.actual);
});
test('resource group max is independent of score group; growth uses start snapshot',()=>{
 const g=game();g.s.attrs.bi=15;const a=g.ensureAbilityState();a.study.focus=['bi'];a.study.progress.bi=74;
 const [s,out]=resolve(g);out.result='draw';out.talentTriggers=[
 {resourceGroup:'switch-insight',reward:{type:'insight',value:1}},
 {resourceGroup:'switch-insight',reward:{type:'insight',value:2}}];
 g.applyAbilityBattleGrowth(s,out);assert.equal(g.s.attrs.bi,16);assert.equal(a.manuscript.fragments,15);
 assert.equal(s.resourceReceipt.insight.nominal,6); // draw 3 + first style 1 + group max 2
});
test('settlement is idempotent under concurrent duplicate calls',async()=>{
 const g=game();const [s,out]=resolve(g);out.result='draw';
 await Promise.all([g.settleBattle(s,out),g.settleBattle(s,out)]);
 assert.equal(g.s.battle.draw,1);const state=JSON.stringify(g.s);
 await g.settleBattle(s,out);assert.equal(JSON.stringify(g.s),state);
});
test('v11 save roundtrip retains small-integer carry; old save remains untouched',()=>{
 const g=game();g.s.abilityState.strategy.chargeRemainder=9;g.s.abilityState.manuscript.fragments=19;
 const saved=serializeRun(g);assert.equal(saved.v,RUN_SAVE_VERSION);assert.equal(saved.v,11);
 const restored=deserializeRun(saved,g.cfg);assert.equal(restored.ok,true);assert.equal(restored.state.numericVersion,3);
 assert.equal(restored.state.abilityState.strategy.chargeRemainder,9);
 const old={v:10,state:{attrs:{shi:53},abilityState:{study:{progress:{shi:1440}}}}};const before=JSON.stringify(old);
 assert.equal(deserializeRun(old,g.cfg).legacy,true);assert.equal(JSON.stringify(old),before);
 assert.notEqual(REINCARNATE_KEY,'feihua_reincarnate_v1');
});
test('capacity acquisition remains permanent, mutually exclusive, upgrade pays delta',()=>{
 const g=game();g.s.inspiration=20;const t=g.leveledTalent(g.cfg.talentById.get('T032'),1);g.applyTalentInstant(t);
 assert.equal(g.s.inspirationMax,62);assert.equal(g.s.inspiration,24);
 g.applyTalentInstant(g.leveledTalent(g.cfg.talentById.get('T033'),1));assert.equal(g.s.inspirationMax,62);
 g.s.passive=[t];g.s.talentLevels.T032=1;g.s.inspiration=54;
 const expected=54+g.cfg.talentUpgradeById.get('T032').levels[1].effect.value;
 assert.equal(g.upgradeTalent('T032').ok,true);assert.equal(g.s.inspirationMax,expected);
 assert.equal(Album.MASTERY_ATTR_PER_LEVEL,2);assert.equal(Album.applyMasteryMechanics({},'bowen',5).knowledgeInsightBonus,1);
});
test('negative and unaffordable fees leave resources unchanged',()=>{
 const g=game();const [s]=resolve(g);g.s.inspiration=2;
 assert.equal(s.spendInspiration(-1,'invalid'),false);assert.equal(s.spendExtraDice(5),false);
 assert.equal(g.s.inspiration,2);assert.equal(s.paidExtraDice||0,0);
});
test('final grade keeps the original score scale',()=>{
 const grades=project().grades;const common={battle:{win:3,draw:1,loss:0,maxStreak:2,upsets:0,winsByStyle:{}},events:{}};
 const a=R.sixDimScore({...common,numericVersion:3,attrs:{shi:12,ci:11,lian:10,bi:9,xue:8,si:7},finish:{inspirationLeft:36}},grades);
 const b=R.sixDimScore({...common,numericVersion:2,attrs:{shi:120,ci:110,lian:100,bi:90,xue:80,si:70},finish:{inspirationLeft:360}},grades);
 assert.equal(a.total,b.total);assert.equal(a.grade.name,b.grade.name);
});
test('all configured talent levels resolve representative dice without invalid numbers',()=>{
 const g=game();let levels=0;
 for(const t of g.cfg.talentById.values()){
  const up=g.cfg.talentUpgradeById.get(t.id);const count=up?.maxLevel||1;
  for(let level=1;level<=count;level++){
   const talent=g.leveledTalent(t,level);g.s.passive=talent.kind==='passive'?[talent]:[];g.s.active=talent.kind==='active'?[talent]:[];
   for(const pips of [[1],[2,5,6],[6,6]]){
    const s=g.createSession({npc:foe,label:t.id+':'+level});if(talent.kind==='active')s.usedActive=[talent];
    const out=g.resolveBattle(s,'shi','wanyue',pips);
    assert.ok(Number.isSafeInteger(out.selfCalc.total),t.id+' Lv'+level);
    assert.ok(out.dicePips.every(n=>Number.isInteger(n)&&n>=1&&n<=6));
   }
   levels++;
  }
 }
 assert.ok(levels>=263);console.log('Talent levels exercised:',levels);
});
test('nested tier reward ratio is normalized once',()=>{
 const c={numericVersion:3,talents:[{effect:{type:'dice_pattern',tiers:[{threshold:12,value:1600,reward:{type:'crit',chance:5000,mult:20000}}]}}]};
 normalizeNumericRates(c);const r=c.talents[0].effect.tiers[0].reward;assert.equal(r.chance,.5);assert.equal(r.mult,2);
});
test('interleaved score groups each retain their own maximum',()=>{
 const g=game();g.synergySet=()=>[
  ['a-low','a',.1],['b-low','b',.2],['a-high','a',.3],['b-high','b',.4]
 ].map(([name,stackGroup,value])=>({id:name,name,effects:[{type:'syn_pct',stackGroup,stackMode:'max',value}]}));
 const [,out]=resolve(g);const detail=out.selfCalc.items.map(x=>x.detail||'').join('\n');
 assert.ok(!detail.includes('a-low')&&!detail.includes('b-low'));assert.match(detail,/a-high \+30%/);assert.match(detail,/b-high \+40%/);
});
test('low inspiration recovery uses a shared snapshot, max group, then floor',async()=>{
 const g=game();g.s.inspiration=0;g.s.onboarding.enabled=false;
 g.s.passive=[{id:'floor',effect:{type:'insp_floor',value:5}}];
 g.synergySet=()=>[2,3].map(value=>({id:'recover'+value,name:'recover'+value,effects:[{type:'insp_battle_recover',threshold:3,value,maxTriggers:2,resourceGroup:'low-recovery'}]}));
 const [s,out]=resolve(g);out.result='lose';await g.settleBattle(s,out);
 assert.equal(g.s.inspiration,5);assert.equal(g.s.talentState.triggers['synergy:recover3'],1);
 assert.equal(g.s.talentState.triggers['synergy:recover2'],undefined);
});
