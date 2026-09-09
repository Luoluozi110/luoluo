// One-time v2 -> v3 content conversion. Ratios stay bp; units are field/type specific.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=n=>JSON.parse(fs.readFileSync(path.join(root,'config',n+'.json'),'utf8'));
const write=(p,o)=>fs.writeFileSync(path.join(root,p),JSON.stringify(o,null,2)+'\n');
const content=JSON.parse(fs.readFileSync(path.join(root,'feihua-content.json'),'utf8'));
assert.equal(content.numericVersion,2,'Only explicit numeric v2 input is accepted');
const keys=fs.readdirSync(path.join(root,'config')).filter(n=>n.endsWith('.json')&&!['cloud.json','leaderboard.json'].includes(n)).map(n=>n.slice(0,-5));
// Cloud is authoritative for editor-managed blocks; do not overwrite recent narrative edits.
const cfg=Object.fromEntries(keys.map(n=>[n,content[n]??read(n)]));
for(const [n,o]of Object.entries(cfg))write('legacy/numeric-v2/config/'+n+'.json',o);
const attrKeys=['shi','ci','lian','bi','xue','si'];
function divide(o,k,d){if(typeof o?.[k]!=='number')return;const n=o[k]/d;assert.ok(Number.isSafeInteger(n),`Cannot exactly convert ${k}=${o[k]} / ${d}`);o[k]=n;}
function attrs(o){if(o&&!Array.isArray(o))for(const k of attrKeys)divide(o,k,10);}
function walk(o){
 if(Array.isArray(o)){o.forEach(walk);return;}
 if(!o||typeof o!=='object')return;
 for(const [k,v] of Object.entries(o)){
  if(k==='attrs'&&v&&typeof v==='object'){attrs(v);continue;}
  if(['inspiration','inspirationMax','insight','carryCost'].includes(k)&&typeof v==='number')divide(o,k,10);
  else if(k==='fragment'&&typeof v==='number')divide(o,k,50);
  else if(k==='releaseInspirationByMerit'&&v)for(const key of Object.keys(v))divide(v,key,10);
  else walk(v);
 }
}
const spiritTypes=new Set(['inspiration','inspirationMax','insp_on_win','insp_turn_regen','insp_floor','palace_insp','insp_on_quiz','insp_battle_recover','insp_max','start_insp']);
function effect(e){
 if(!e)return;
 attrs(e.attrs);
 if(['on_win_bonus','draw_bonus','study_bonus','insight','attr','attr_flat'].includes(e.type)||spiritTypes.has(e.type))divide(e,'value',10);
 if(e.type==='fragment'){divide(e,'value',50);e.unit='manuscript_progress';}
 if(e.type==='sky_strategy'&&e.key==='ping_fragment')divide(e,'value',50);
 if(e.type==='sky_strategy'&&e.key==='battle_guard')divide(e,'value',10);
 for(const k of ['cost','refund','baseCost','costStep','firstCostDiscount','conditionalFirstCostDiscount','startInspiration','startValue','onTalent','inspThreshold','maxInspiration','minInspiration'])if(!(e.type==='sky_strategy' && k==='cost'))divide(e,k,10);
 if(['comeback','insp_battle_recover'].includes(e.type))divide(e,'threshold',10);
 effect(e.reward);effect(e.fullReward);for(const t of e.tiers||[])effect(t.reward);
 if(e.type==='on_win_bonus'||e.type==='draw_bonus'||e.type==='study_bonus')e.resource='insight';
 if(e.type==='armory_pct')e.target=e.effectId==='S22-E1'?'score':'attrs';
}
function talents(list,up){
 for(const t of list||[]){effect(t.effect);divide(t,'cost',10);}
 for(const u of Object.values(up||{})){u.upCost=u.upCost.map(n=>{assert.equal(n%10,0);return n/10});for(const l of u.levels||[]){effect(l.effect);divide(l,'cost',10);}}
}
const a=cfg.attrs;a.numericVersion=3;attrs(a.initial);
for(const k of ['schoolBonus','quizCorrectGain','zeCellGain','branchLandmarkGain'])divide(a,k,10);
a.battleWinGain=a.battleWinGain.map(n=>n/10);for(const g of ['battleDrawGain','battleLoseGain'])for(const k of Object.keys(a[g]||{}))divide(a[g],k,10);
const ab=a.abilitySystem;ab.version=4;
for(const k of Object.keys(ab.growth))if(k!=='familiarityNeed')divide(ab.growth,k,10);
for(const k of ['baseInsightCap','insightCapPerXue','slotPerXue'])divide(ab.study,k,10);
ab.study.slotMilestones=ab.study.slotMilestones.map(n=>n/10);divide(ab.study,'progressNeed',40);ab.study.progressPerXue=1;
for(const k of ['chargePerSi','capPerSi'])divide(ab.strategy,k,10);
divide(ab.strategy.plans.steady,'fragmentGain',50);divide(ab.strategy.plans.guard,'lossReduce',10);
ab.strategy.plans.steady.desc='自然移动骰为1～3时，消耗1构思，成稿进度+20格';
ab.strategy.plans.guard.desc='论战失败时，消耗1构思，减少2点败北灵感损失';
for(const k of ['capPerBi','fragmentFastBi','bonusPageBi','volumeRefundBi','polishDiscount','publishInspiration'])divide(ab.manuscript,k,10);
divide(ab.manuscript,'fragmentNeed',50);ab.manuscript.fragmentPerBi=1;
for(const s of Object.values(a.styleSystem))for(const k of ['singleDieInsight','firstExtraDiscount','catchupGap','lossInspirationReduce','drawRefund'])divide(s,k,10);
for(const k of ['soft','hard','minGain'])divide(a.diminish,k,10);
for(const k of Object.keys(cfg.inspiration))if(!['dicePct','extraDicePct','maxExtraDice','numericVersion'].includes(k))divide(cfg.inspiration,k,10);
cfg.inspiration.numericVersion=3;
talents(cfg.talents,cfg['talent-upgrade']);talents(cfg['sidequest-talents'].talents,cfg['sidequest-talents'].upgrades);
for(const s of cfg.synergies)for(const e of s.effects||[])effect(e);
for(const s of cfg.schools){const m=s.schoolMechanics;for(const k of ['knowledgeInsight','differentStyleInsight'])divide(m,k,10);if(m.talentConversion?.resource==='insight')divide(m.talentConversion,'cost',10);}
for(const s of cfg.sky){effect(s.effect);for(const c of s.choices||[])effect(c.effect);}
for(const c of cfg.album){effect(c.reward);for(const b of c.branches||[])for(const e of b.effects||[])effect(e);}
for(const k of ['events','sidequests','npcs'])walk(cfg[k]);
// Per-synergy score grouping; compound rewards have independent resource group names.
for(const s of cfg.synergies)for(const e of s.effects||[]){
 e.stackMode='add';e.stackGroup='score:'+e.effectId;
 if(e.type==='style_switch_pct'&&['S13','S25','S27'].includes(s.id)){e.stackGroup='switch-score';e.stackMode='max';e.resourceGroup='switch-insight';}
 if(e.type==='streak_pct'&&['S15','S26'].includes(s.id)){e.stackGroup='streak-score';e.stackMode='max';}
 if(e.type==='battle_history_pct'&&['S06','S21','S28','S32'].includes(s.id)){e.stackGroup='previous-nonwin-score';e.stackMode='max';}
 if(e.type==='insp_battle_recover'&&['S12','S32'].includes(s.id))e.resourceGroup='low-inspiration-recovery';
}
// Structured rules appended to existing literary text, avoiding stale numeric claims.
const all=[...cfg.talents,...cfg['sidequest-talents'].talents];
for(const t of all){const e=t.effect;const base=(t.text||'').split('【小整数规则】')[0];
 let rule='';if(e.type==='on_win_bonus')rule=`以${({shi:'诗',ci:'词',lian:'联'})[e.style]}获胜，心得+${e.value}。`;
 if(e.type==='draw_bonus')rule=`平局时心得+${e.value}。`;
 if(e.type==='study_bonus')rule=`平局或败北时心得+${e.value}，下一场作品修正+${e.nextBattlePct/100}%。`;
 if(e.type==='attr_flat')rule=Object.entries(e.attrs).map(([k,v])=>`${k}常驻+${v}`).join('，')+'。';
 if(rule)t.text=base.replace(/(?:诗力|词力|联力|学力|笔力|思力|属性)(?:额外|常驻)?\s*\+\s*\d+/g,'修为随文心而进')+'【小整数规则】'+rule;
}
for(const [n,o]of Object.entries(cfg)){if(o&&typeof o==='object'&&!Array.isArray(o)&&'numericVersion'in o)o.numericVersion=3;write('config/'+n+'.json',o);}
const next={...content,...cfg,numericVersion:3,ruleSetId:'small-integer-v2.1',_version:Number(content._version)+1};
write('feihua-content.json',next);
write('config/numeric.json',{numericVersion:3,ruleSetId:'small-integer-v2.1',units:{attribute:1,inspiration:1,insight:1,study:25,manuscript:20,strategy:10,battleScore:1,bp:10000},experiments:{growthCarry:false,smoothManuscript:false,flatUpgradeDiscount:false,roundedDice:false}});
console.log('Converted cloud-authoritative config to numericVersion 3; preserved narrative and ratio bp.');
