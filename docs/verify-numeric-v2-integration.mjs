import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(process.argv[2] || path.join(here,'../feihuaqi-playable'));
const read = n=>JSON.parse(fs.readFileSync(path.join(source,'config',n+'.json'),'utf8'));
const data = JSON.parse(fs.readFileSync(path.join(here,'文心棋-数值系统对接数据-v2.1.json'),'utf8'));
const side = read('sidequest-talents'), original = [...read('talents'),...side.talents];
const upMain = read('talent-upgrade');
assert.equal(Object.keys(side.upgrades).filter(id=>id in upMain).length,0,'overlapping upgrade IDs');
const upgrades = {...upMain,...side.upgrades};
const byId = Object.fromEntries(data.talents.map(t=>[t.id,t]));
const sy = Object.fromEntries(data.synergies.map(t=>[t.id,t]));
const level = (id,n=1)=>byId[id].levels[n-1].targetParameters;
let numericFields = 0, changed = 0;
function checkEffect(record) {
  const found = [];
  function collect(x,p='') {
    if (!x||typeof x!=='object') return;
    for (const [k,v]of Object.entries(x)) {
      if(typeof v==='number') found.push([p+k,v]);
      else collect(v,p+k+'.');
    }
  }
  collect(record.legacyEffect);
  assert.equal(found.length,record.numericFields.length);
  function get(o,p){return p.split('.').reduce((a,k)=>a[k],o)}
  for(const [p,v] of found){
    const a=record.numericFields.find(f=>f.path===p);assert.ok(a,p);
    assert.equal(a.old,v);assert.equal(get(record.targetParameters,p),a.target);
    if(a.unit==='manuscript_progress'){assert.equal(a.target,v*20);changed++;}
    else assert.equal(a.target,v);
    numericFields++;
  }
  // Reverse only the declared unit conversion; all other fields must survive exactly.
  function reverse(x){
    if(Array.isArray(x))return x.map(reverse);
    if(!x||typeof x!=='object')return x;
    const o=Object.fromEntries(Object.entries(x).map(([k,v])=>[k,reverse(v)]));
    if(o.type==='manuscript_progress'){o.type='fragment';o.value/=20;}
    return o;
  }
  assert.deepEqual(reverse(record.targetParameters),record.legacyEffect);
}
for(const t of original){
  const r=byId[t.id];assert.deepEqual(r.legacyTalent,t);checkEffect(r.base);
  r.levels.forEach((lv,i)=>{
    assert.deepEqual(lv.legacyLevel,upgrades[t.id].levels[i]);
    assert.equal(lv.activeCost,upgrades[t.id].levels[i].cost??t.cost??null);
    assert.equal(lv.upgradeCostToNext,upgrades[t.id].upCost[i]??null);
    checkEffect(lv);
  });
}
for(const s of read('synergies')){
  assert.deepEqual(sy[s.id].effects,s.effects);assert.deepEqual(sy[s.id].members,s.members);
  sy[s.id].mappedEffects.forEach(checkEffect);
}
assert.equal(numericFields,data.counts.numericEffectFields);assert.equal(changed,data.counts.changedFragmentFields);
assert.equal(level('TA08',3).costStep,0);
assert.equal(level('TA09',5).penalty,0);
assert.ok(level('TA03').lowValue<0);
assert.equal(level('T038',2).value,0.035);
assert.equal(level('T007',5).reward.value,20);
assert.equal(level('T010').reward.value,10);
const examples = {};
examples.A={nominal:3+level('T001').value+level('T012').value};
examples.A.actual=Math.min(9-5,examples.A.nominal);examples.A.overflow=examples.A.nominal-examples.A.actual;
assert.deepEqual(examples.A,{nominal:8,actual:4,overflow:4});
const B={scorePercent:Math.round((2*level('T007',5).value+2*level('T040').value+sy.S10.effects[0].value)*100),
  progress:15+5+level('T007',5).reward.value+level('T040').reward.value+sy.S10.mappedEffects[0].targetParameters.reward.value};
B.made=Math.floor(B.progress/40);B.rest=B.progress%40;B.nominalPages=B.made+1;B.actualPages=Math.min(2-1,B.nominalPages);B.overflow=B.nominalPages-B.actualPages;
assert.deepEqual(B,{scorePercent:58,progress:80,made:2,rest:0,nominalPages:3,actualPages:1,overflow:2});examples.B=B;
const C={cost:Math.max(1,5-level('T005').conditionalFirstCostDiscount-level('T016').firstCostDiscount-sy.S04.effects[0].firstCostDiscount),
  scorePercent:Math.round((level('T005').value+2*level('T016').perStepValue+level('T016').fullValue+2*sy.S04.effects[0].value+sy.S04.effects[1].value)*100)};
assert.deepEqual(C,{cost:1,scorePercent:52});examples.C=C;
const D={scorePercent:Math.round((level('T037').value+level('T042').value+Math.max(sy.S13.effects[0].value,sy.S27.effects[0].value))*100),insight:level('T037').insight+Math.max(sy.S13.effects[0].insight,sy.S27.effects[0].insight)};
assert.deepEqual(D,{scorePercent:27,insight:3});examples.D=D;
examples.E={insight:2+level('T027').value+sy.S21.effects[0].value,nextPercent:Math.round(Math.max(level('T027').nextBattlePct,sy.S21.effects[0].nextBattlePct)*100)};
assert.deepEqual(examples.E,{insight:6,nextPercent:8});
let remainder=0;examples.F=[];for(let i=0;i<5;i++){remainder++;examples.F.push(1+Math.floor(remainder/5));remainder%=5;}
assert.deepEqual(examples.F,[1,1,1,1,2]);
const schoolRows=read('schools').map(s=>{
 const a={...read('attrs').initial};a[s.attr]+=read('attrs').schoolBonus;
 for(const [k,v]of Object.entries(level(s.talent).attrs))a[k]+=v;
 const m=s.schoolMechanics;
 return {id:s.id,study:Math.min(50,25+a.xue),slots:Math.min(3,1+Math.floor(a.xue/10)+(m.studySlotsPlus||0)),insightCap:6+Math.floor(a.xue/3),strategy:10+a.si+10*(m.strategyChargePlus||0),strategyCap:Math.min(6,3+Math.floor(a.si/10)+(m.strategyMaxPlus||0)),manuscript:Math.min(30,a.bi),pageCap:Math.min(8,2+Math.floor(a.bi/6)+(m.manuscriptCapPlus||0))};
});
assert.deepEqual(schoolRows.map(s=>[s.study,s.slots,s.insightCap,s.strategy,s.strategyCap,s.manuscript,s.pageCap]),[[36,3,9,15,3,5,2],[30,1,7,31,5,5,2],[30,1,7,15,3,11,4]]);
for(const [name,hash]of Object.entries(data.fingerprints))assert.equal(createHash('sha256').update(fs.readFileSync(path.join(source,'config',name))).digest('hex'),hash);
const reportName='文心棋-数值对接验收记录-v2.1.json';
const report={status:'passed-static-design-checks',counts:data.counts,examples,schoolRows,
  sourceFiles:Object.fromEntries(['js/engine/game.js','js/engine/rules.js','js/engine/save.js'].map(n=>[n,createHash('sha256').update(fs.readFileSync(path.join(source,n))).digest('hex')])),
  limits:['No runtime implementation','No full-game simulation','No full peripheral numeric mapping','No save migration test','No playtest'],documentChecks:{}};
fs.writeFileSync(path.join(here,reportName),JSON.stringify(report,null,2)+'\n');
let links=0,jsonBlocks=0,tables=0;
for(const name of ['文心棋-数值系统对接实施规格-v2.1.md','文心棋-文心升级羁绊全量对接表-v2.1.md']){
 const text=fs.readFileSync(path.join(here,name),'utf8');assert.ok(!text.includes('\uFFFD'));
 assert.equal((text.match(/^```/gm)||[]).length%2,0);
 for(const m of text.matchAll(/\]\(([^)]+)\)/g)){assert.ok(fs.existsSync(path.resolve(here,m[1])),m[1]);links++;}
 for(const m of text.matchAll(/```json\s*\n([\s\S]*?)```/g)){JSON.parse(m[1]);jsonBlocks++;}
 let columns=0;for(const line of text.split(/\r?\n/)){if(!line.startsWith('|')){columns=0;continue;}const n=line.replaceAll('\\|','').split('|').length;if(columns)assert.equal(n,columns,line);else tables++;columns=n;}
}
report.documentChecks={links,jsonBlocks,tables,passed:true};
fs.writeFileSync(path.join(here,reportName),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,counts:report.counts,documentChecks:report.documentChecks},null,2));
