#!/usr/bin/env node
// 流派熟练度系统 · 纯函数 + 引擎集成单测
// 覆盖：等级映射/阈值、机制增强、xp 累加与升级、start() 主属性叠加、博闻 Lv5 点睛。
import fs from 'fs'; import path from 'path';
import { pathToFileURL } from 'url';
import * as Album from '../js/engine/album.js';
import { Game } from '../js/engine/game.js';

const CFG_DIR = path.join(process.cwd(), 'config');
function load(n){try{return JSON.parse(fs.readFileSync(path.join(CFG_DIR,n+'.json'),'utf8'));}catch(e){return n==='talent-upgrade'?{}:[];}}
function buildCfg(){
  const cfg={}; for(const n of ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','talent-upgrade']) cfg[n]=load(n);
  const board=cfg.board; const byId=new Map(); for(const c of board.mainRing) byId.set(c.id,{...c,ring:'main'}); board.cellById=byId; board.laps=Number(board.laps)||2; board.ringSize=board.mainRing.length;
  cfg.questions=(cfg.questions||[]).filter(q=>q.enabled!==false); cfg.events=(cfg.events||[]).filter(e=>e.enabled!==false);
  const af=cfg.affinity; af.themeNames=af.themeNames||{}; af.mannerNames=af.mannerNames||{}; af.matrix=af.matrix||{};
  cfg.talentById=new Map((cfg.talents||[]).map(t=>[t.id,t])); cfg.talentUpgradeById=new Map(Object.entries(cfg['talent-upgrade']||{}));
  return cfg;
}
function makeUI(){return {floatAttrs(){},floatInspiration(){},onState(){},showDice(){},movePiece(){},toast(){},highlightCell(){},showQuizResult(){},showSky(){},skyExpired(){},showTalentGain(){},showPalaceIntro(){},async showResult(){},async askReplaceTalent(){return 0;},async askScenic(){return false;},async showQuiz(){return{index:0,timedOut:false};},async showEvent(){return 0;},async runBattle(){return{win:true,score:1,oppScore:0};}};}
const rng=(()=>{let s=12345;return()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};})();
function gameWithMastery(cfg,schoolId,xp){
  Album.resetStore(); let store=Album.emptyStore(); store.mastery[schoolId]=Album.masteryEntry(xp); Album.saveStore(store);
  const g=new Game(cfg,makeUI(),rng);
  // 覆盖 start() 里的 grantTalent/applyLoadout 不在本单测范围，静默即可（保留 attrs 生效）
  g.push=()=>{}; g.grantTalent=(t,o)=>{}; g.applyLoadout=()=>{};
  const s=g.start(schoolId,{name:''});
  return {game:g, s, store};
}
const cfg=buildCfg();
const assert=(c,m)=>{if(!c){console.error('  ✗ '+m);process.exitCode=1;throw new Error(m);} console.log('  ✓ '+m);};

console.log('== 等级映射与阈值 ==');
const TH=[0,40,100,200,340];
assert(Album.masteryLevelFromXp(0)===1 && Album.masteryLevelFromXp(39)===1, '0/39 → Lv1');
assert(Album.masteryLevelFromXp(40)===2 && Album.masteryLevelFromXp(99)===2, '40/99 → Lv2');
assert(Album.masteryLevelFromXp(100)===3 && Album.masteryLevelFromXp(199)===3, '100/199 → Lv3');
assert(Album.masteryLevelFromXp(200)===4 && Album.masteryLevelFromXp(339)===4, '200/339 → Lv4');
assert(Album.masteryLevelFromXp(340)===5 && Album.masteryLevelFromXp(9999)===5, '340+ → Lv5（封顶）');
assert(Album.masteryLevelName(1)==='初学乍练' && Album.masteryLevelName(5)==='登峰造极', '等级名正确');

console.log('== 机制增强表 ==');
const bowenBase={type:'bowen',knowledgeThreshold:2};
const qishiBase={type:'qishi',inspirationBonusRate:0.35,upgradeCostRate:0.65};
const cizongBase={type:'cizong_bi',creativeDicePlus:2,freeDiceCap:5};
assert(Album.applyMasteryMechanics(bowenBase,'bowen',1)===bowenBase, 'Lv1 不增强（原引用）');
assert(Album.applyMasteryMechanics(bowenBase,'bowen',3).knowledgeThreshold===2, '博闻 Lv3 threshold 仍为 2');
assert(Album.applyMasteryMechanics(bowenBase,'bowen',4).knowledgeThreshold===1, '博闻 Lv4 threshold→1');
assert(Album.applyMasteryMechanics(bowenBase,'bowen',5).knowledgeBonusGain===1, '博闻 Lv5 点睛 +1 学力');
assert(Album.applyMasteryMechanics(qishiBase,'qishi',5).inspirationBonusRate===0.55 && Album.applyMasteryMechanics(qishiBase,'qishi',5).upgradeCostRate===0.55, '奇士 Lv5 rate 0.55 + 成本折扣 0.55');
assert(Album.applyMasteryMechanics(qishiBase,'qishi',2).inspirationBonusRate===0.40, '奇士 Lv2 rate→0.40');
assert(Album.applyMasteryMechanics(cizongBase,'cizong_bi',4).creativeDicePlus===5 && Album.applyMasteryMechanics(cizongBase,'cizong_bi',4).freeDiceCap===5, '辞宗 Lv4 dice 5（cap 5 不变）');
assert(Album.applyMasteryMechanics(cizongBase,'cizong_bi',5).creativeDicePlus===5 && Album.applyMasteryMechanics(cizongBase,'cizong_bi',5).freeDiceCap===6, '辞宗 Lv5 dice 5 + cap→6');
assert(Album.applyMasteryMechanics(bowenBase,'unknown',5)===bowenBase, '未知门派不增强');

console.log('== xp 累加与升级 ==');
Album.resetStore(); let store=Album.emptyStore();
let r=Album.addMasteryXp(store,'bowen',{reachedEnd:true,wenzong:true});
assert(r.gained===12+20+8 && r.after.level===2 && r.leveledUp, '通关+文宗 → +40 且 Lv1→Lv2');
r=Album.addMasteryXp(store,'bowen',{reachedEnd:false,wenzong:false});
assert(r.gained===12 && r.after.xp===52 && !r.leveledUp, '普通局 → +12 不升级');
assert(Album.addMasteryXp(store,'nope',{})===null, '未知门派返回 null');
const legacy=Album.normalizeStore({v:1,stats:{},unlocked:[],loadout:[]});
assert(legacy.mastery.bowen.xp===0 && legacy.mastery.bowen.level===1 && legacy.mastery.cizong_bi.level===1, '旧档无 mastery → 全 Lv1 默认');

console.log('== 引擎 start() 主属性叠加 ==');
const L1=gameWithMastery(cfg,'bowen',0);
assert(L1.s.attrs.xue===cfg.attrs.initial.xue+cfg.attrs.schoolBonus, `bowen Lv1 xue=${L1.s.attrs.xue}（初5+3）`);
const L4=gameWithMastery(cfg,'qishi',200);
assert(L4.s.attrs.si===cfg.attrs.initial.si+cfg.attrs.schoolBonus+(4-1)*Album.MASTERY_ATTR_PER_LEVEL, `qishi Lv4 si=${L4.s.attrs.si}（初5+3+6）`);
const L5=gameWithMastery(cfg,'cizong_bi',340);
assert(L5.s.attrs.bi===cfg.attrs.initial.bi+cfg.attrs.schoolBonus+(5-1)*Album.MASTERY_ATTR_PER_LEVEL, `cizong Lv5 bi=${L5.s.attrs.bi}（初5+3+8）`);
assert(L5.game.schoolMechanics().freeDiceCap===6 && L5.game.schoolMechanics().creativeDicePlus===5, 'cizong Lv5 引擎机制已增强');

console.log('== 博闻 Lv5 点睛：触发额外 +1 学力 ==');
// 直接构造 bowen Lv5 结算
Album.resetStore(); store=Album.emptyStore(); store.mastery.bowen=Album.masteryEntry(340); Album.saveStore(store);
const g4=new Game(cfg,makeUI(),rng); g4.push=()=>{}; g4.grantTalent=(t,o)=>{}; g4.applyLoadout=()=>{};
g4.start('bowen',{name:''});
const s4=g4.s; s4.turn=1; s4.schoolState=g4.createSchoolState(g4.s.school); s4.schoolState.knowledge=1;
await g4.gainBowenKnowledge('t');
assert(s4.attrs.xue===cfg.attrs.initial.xue+cfg.attrs.schoolBonus+(5-1)*2+1, `bowen Lv5 触发后 xue=${s4.attrs.xue}（初5+3+8，点睛+1）`);

console.log('\n流派熟练度测试：全部通过 ✓');
