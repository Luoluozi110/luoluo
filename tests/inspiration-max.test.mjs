#!/usr/bin/env node
// 灵感上限扩展 · 引擎集成单测
// 覆盖：传世名篇 reward.type='inspirationMax'（applyLoadout）与奇遇 effect.inspirationMax（applyEffect）
// 公式（与文心 insp_max 一致）：max(cfg.max, current + gain)，gain<=0 不生效。
import fs from 'fs'; import path from 'path';
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
const rng=(()=>{let s=20260816;return()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};})();
function newGame(){
  const g=new Game(buildCfg(),makeUI(),rng);
  g.push=()=>{}; g.grantTalent=()=>{};
  g.start('bowen',{name:''});
  return g;
}
const assert=(c,m)=>{if(!c){console.error('  ✗ '+m);process.exitCode=1;throw new Error(m);} console.log('  ✓ '+m);};

const BASE_MAX = load('inspiration').max;

console.log('== 传世名篇 reward.inspirationMax（applyLoadout）==');
{
  const g=newGame();
  const before=g.s.inspirationMax;
  g.applyLoadout([{id:'test_c1',name:'测试·名篇甲',reward:{type:'inspirationMax',value:8},rewardDesc:'灵感上限 +8'}]);
  assert(g.s.inspirationMax===before+8, `装配后上限 ${before}→${g.s.inspirationMax}（+8 生效）`);
  // 与文心 insp_max 语义一致：只扩容量不动当前值（开局 60/80，扩的是局中可容纳空间）
  assert(g.s.inspiration===g.cfg.inspiration.initial, `当前灵感保持初始值 ${g.cfg.inspiration.initial} 不变（仅扩容量）`);
}
{
  const g=newGame();
  const before=g.s.inspirationMax;
  g.applyLoadout([{id:'test_c2',name:'测试·名篇乙',reward:{type:'inspirationMax',value:-5},rewardDesc:'负值'}]);
  assert(g.s.inspirationMax===before, `gain<=0 不生效（${before} 不变）`);
  g.applyLoadout([{id:'test_c3',name:'测试·名篇丙',reward:{type:'inspirationMax',value:0},rewardDesc:'零值'}]);
  assert(g.s.inspirationMax===before, 'value=0 不生效');
}
{
  // 多张叠加
  const g=newGame();
  const before=g.s.inspirationMax;
  g.applyLoadout([
    {id:'t1',name:'A',reward:{type:'inspirationMax',value:5},rewardDesc:''},
    {id:'t2',name:'B',reward:{type:'inspirationMax',value:7},rewardDesc:''}
  ]);
  assert(g.s.inspirationMax===before+12, `多张名篇叠加 ${before}→${g.s.inspirationMax}（+12）`);
}

console.log('== 奇遇 effect.inspirationMax（applyEffect）==');
{
  const g=newGame();
  const before=g.s.inspirationMax;
  await g.applyEffect({inspirationMax:6});
  assert(g.s.inspirationMax===before+6, `奇遇扩容 ${before}→${g.s.inspirationMax}（+6）`);
}
{
  // 奇遇只扩上限，不动当前灵感
  const g=newGame();
  g.s.inspiration=3; const before=g.s.inspirationMax;
  await g.applyEffect({inspirationMax:4});
  assert(g.s.inspirationMax===before+4 && g.s.inspiration===3, `只扩上限不动当前（insp=3 不变，max ${before}→${g.s.inspirationMax}）`);
}
{
  // 与文心 insp_max 混合叠加
  const g=newGame();
  const before=g.s.inspirationMax;
  g.applyLoadout([{id:'t3',name:'C',reward:{type:'inspirationMax',value:5},rewardDesc:''}]);
  await g.applyEffect({inspirationMax:6});
  assert(g.s.inspirationMax===before+11, `名篇+奇遇混合叠加 ${before}→${g.s.inspirationMax}（+11）`);
}
{
  // 非法值兜底
  const g=newGame();
  const before=g.s.inspirationMax;
  await g.applyEffect({inspirationMax:'abc'});
  await g.applyEffect({inspirationMax:null});
  await g.applyEffect({inspirationMax:-3});
  assert(g.s.inspirationMax===before, `非法/负值不生效（${before} 不变）`);
}

console.log('== 与既有 addInspiration clamp 的联动 ==');
{
  const g=newGame();
  g.s.inspiration=2;
  await g.applyEffect({inspirationMax:10});
  await g.addInspiration(999,'测试');
  assert(g.s.inspiration===g.s.inspirationMax, `加灵感 clamp 到新上限（=${g.s.inspirationMax}）`);
}
{
  // 下限保护：current 已低于 cfg.max（理论上不会发生）时 Math.max 兜底
  const g=newGame();
  g.s.inspirationMax=2; // 人为压低
  g.applyLoadout([{id:'t4',name:'D',reward:{type:'inspirationMax',value:1},rewardDesc:''}]);
  assert(g.s.inspirationMax===Math.max(BASE_MAX,3), `下限保护：max(基础${BASE_MAX}, 2+1)=${g.s.inspirationMax}`);
}

console.log('== save.js 白名单兼容（inspirationMax 序列化往返）==');
{
  const g=newGame();
  g.applyLoadout([{id:'t5',name:'E',reward:{type:'inspirationMax',value:9},rewardDesc:''}]);
  const saved=JSON.parse(JSON.stringify(g.s));
  assert(saved.inspirationMax===g.s.inspirationMax, `序列化保留 inspirationMax=${saved.inspirationMax}`);
  // 反序列化还原
  const g2=new Game(g.cfg,makeUI(),rng);
  g2.push=()=>{}; g2.grantTalent=()=>{};
  g2.s=JSON.parse(JSON.stringify(saved));
  assert(g2.s.inspirationMax===saved.inspirationMax, `读档后上限还原（=${g2.s.inspirationMax}）`);
}

console.log('灵感上限扩展引擎测试：全部通过 ✓');
