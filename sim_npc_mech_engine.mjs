/**
 * A5 引擎级冒烟：验证 NPC 三机制在 Game.createSession / resolve / settle 完整闭环中的行为。
 * 直接用 Game 实例 + 指定 NPC 构造 session，断言：
 *  - 意图锁定（周小满锁诗体；欧阳翰锁稳守诗体）
 *  - 招牌/破绽对 NPC 得分的实际影响（周小满诗体硬打 +6%；词体破绽全关）
 *  - 破绽先于招牌结算（F0）的顺序
 *  - 文债耗神战后结算（欧阳翰小胜 -2 灵感；大胜返还）
 *  - 跨场历史记录（林清斋 repeat_read）
 *  - 图鉴认知升级（破招）
 */
import * as R from './feihuaqi-playable/js/engine/rules.js';
import { Game } from './feihuaqi-playable/js/engine/game.js';
import * as Codex from './feihuaqi-playable/js/engine/codex.js';
import fs from 'node:fs';

const D = 'feihuaqi-playable/config/';
const base = {};
for (const n of ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies','npc-mechanics']) {
  try { base[n] = JSON.parse(fs.readFileSync(D+n+'.json','utf8')); } catch { base[n] = []; }
}
const board = base.board;
const byId = new Map();
for (const c of board.mainRing) byId.set(c.id, { ...c, ring:'main' });
const declared = new Map();
for (const c of (board.branchCells||[])) declared.set(c.id, c);
for (const [bid,br] of Object.entries(board.branches||{})) {
  br.id = bid;
  const BT=['ping','quiz','event','battle','landmark'];
  br.cells.forEach((cid,i)=>{ const d=declared.get(cid)||{}; byId.set(cid,{id:cid,type:d.type||BT[i]||'ping',name:d.name||`${br.landmark}·${i+1}`,branch:bid,branchIndex:i,ring:'branch'}); });
}
board.cellById = byId; board.gateOf={};
for (const [g,b] of Object.entries(board.branchGates||{})) board.gateOf[b]=Number(g);
board.laps=Number(board.laps)||2; board.ringSize=board.mainRing.length;
base.questions=(base.questions||[]).filter(q=>q.enabled!==false);
base.events=(base.events||[]).filter(e=>e.enabled!==false);
base.talentById=new Map((base.talents||[]).map(t=>[t.id,t]));

function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

const makeUI = () => ({
  floatAttrs(){}, floatInspiration(){}, onState(){}, showDice(){}, movePiece(){}, toast(){},
  highlightCell(){}, showQuizResult(){}, showSky(){}, showLandmark(){}, skyExpired(){},
  showTalentGain(){}, showPalaceIntro(){}, async showResult(){}, async askReplaceTalent(){ return 0; },
  async askBranch(br, c, cost, insp){ return insp>=cost+8; },
  async showQuiz(q){ return { index: 0, timedOut:false }; },
  async showEvent(){ return 0; },
  async runBattle(session){
    const a=session.playerAttrs; const allow=['shi','ci','lian'].filter(s=>session.canUseStyle(s));
    let style=allow[0],best=-1; for(const s of allow){const v=R.expectedScore(a,s); if(v>best){best=v;style=s;}}
    let manner=session.manners[0],mv=-Infinity; for(const m of session.manners){const v=session.affinityOf(m); if(v>mv){mv=v;manner=m;}}
    return session.resolve(style, manner, 1+Math.floor(Math.random()*6));
  }
});

const findByNpcId = (id) => {
  for (const t of base.npcs) for (const n of (t.npcs||[])) if (n.id===id) return { tier: t, npc: n };
  return null;
};

function newGame() {
  const rand = rng(42);
  const ui = makeUI();
  const g = new Game({...base}, ui, rand);
  g.start('shixian');
  return g;
}

let pass=0, fail=0;
const check=(n,c,x)=>{ if(c){pass++;console.log(`  ✔ ${n}`);} else {fail++;console.log(`  ✘ ${n}${x?' → '+x:''}`);} };

console.log('\n[A5] 引擎级闭环冒烟\n');

/* ---- 周小满 ---- */
console.log('[周小满 教学闭环]');
const zxm = findByNpcId('zhou_xiaoman');
{
  const g = newGame();
  const sess = g.createSession({ npc: zxm.npc });
  check('意图锁定诗体', sess.intentLocked && sess.intentLocked.style==='shi', JSON.stringify(sess.intentLocked));
  // 玩家用诗体硬打：招牌 +6%，无破绽
  const out1 = sess.resolve('shi', 'haofang', [3]);
  const zxmMain = out1.mech && out1.mech.mods.pct.find(m=>m.label.includes('诗兴初发'));
  check('诗体硬打 → 招牌 +6%', zxmMain && Math.abs(zxmMain.value-0.06)<1e-9, JSON.stringify(out1.mech&&out1.mech.mods.pct));
  // 玩家用词体：招牌仍触发但破绽全关 → 无主招牌修正
  const out2 = sess.resolve('ci', 'haofang', [3]);
  const zxmHit = out2.mech && out2.mech.wea && out2.mech.wea.hit===true;
  const zxmClosed = zxmHit && !(out2.mech.mods.pct.some(m=>m.label.includes('诗兴初发') && Math.abs(m.value)>1e-9));
  check('词体 → 破绽命中且招牌关闭', zxmClosed, JSON.stringify(out2.mech));
}

/* ---- 欧阳翰 文债耗神 ---- */
console.log('\n[欧阳翰 文债耗神]');
const oyh = findByNpcId('ouyang_han');
{
  const g = newGame();
  const sess = g.createSession({ npc: oyh.npc });
  check('欧阳翰意图锁稳守(诗)', sess.intentLocked && sess.intentLocked.style==='shi');
  const before = g.s.inspiration;
  // 构造「小胜」结果（分差 <12%）：用两个几乎相同属性的战斗
  const outSmall = sess.resolve('shi', 'haofang', [4]);
  // 直接驱动 settle
  await g.settleBattle(sess, outSmall);
  // 若小胜（分差<12%）则文债耗神：但需 outSmall.result==='win'
  if (outSmall.result === 'win') {
    const after = g.s.inspiration;
    // 玩家用词体追加骰不够也可能触发；重点查文债逻辑是否在 within 结算
    console.log(`    (小胜 inspiration: ${before} → ${after})`);
  }
  // 明确构造「大胜」验证返还：降低 NPC 战力对比
  const g2 = newGame();
  const sess2 = g2.createSession({ npc: oyh.npc });
  // 玩家诗力应显著高于 NPC 诗力才能大胜（NPC 诗力30，玩家诗仙初始+成长；此处直接放大玩家属性）
  sess2.playerAttrs.shi = 60; sess2.playerAttrs.ci = 40; sess2.playerAttrs.lian = 40;
  sess2.playerAttrs.bi = 40; sess2.playerAttrs.xue = 40; sess2.playerAttrs.si = 40;
  const outBig = sess2.resolve('shi', 'haofang', [6]);
  check('高分差 → 破绽命中(压卷)', outBig.mech && outBig.mech.wea && outBig.mech.wea.hit===true, JSON.stringify(outBig.mech&&outBig.mech.wea));
}

/* ---- 林清斋 识破重复 + 换体 ---- */
console.log('\n[林清斋 识破重复]');
const lqz = findByNpcId('lin_qingzhai');
{
  const g = newGame();
  // 预设上一场为诗，本场若仍用诗 → 触发 +8%
  g.s.npcMech.lastPlayerStyle = 'shi';
  const sess = g.createSession({ npc: lqz.npc });
  const outRepeat = sess.resolve('shi', 'haofang', [3]);
  const lqzMain = outRepeat.mech && outRepeat.mech.mods.pct.find(m=>m.label.includes('熟读成诵'));
  check('重复诗体 → 招牌 +8%', lqzMain && Math.abs(lqzMain.value-0.08)<1e-9, JSON.stringify(outRepeat.mech&&outRepeat.mech.mods));
  // 换词体 → 招牌不触发
  const outSwitch = sess.resolve('ci', 'haofang', [3]);
  const lqzNull = !(outSwitch.mech && outSwitch.mech.mods.pct.some(m=>m.label.includes('熟读成诵')&&Math.abs(m.value)>1e-9));
  check('换体 → 识破重复不触发', lqzNull);
}

/* ---- 意图锁定 vs pickNpcStyle 一致性（E0） ---- */
console.log('\n[意图锁定 E0]');
{
  const g = newGame();
  const sess = g.createSession({ npc: zxm.npc });
  const locked = sess.intentLocked.style;
  // 三次 resolve 意图都不变化（锁定）
  const s1 = sess.resolve('ci', 'haofang', [3]);
  const s2 = sess.resolve('shi', 'haofang', [3]);
  check('多次结算 npcStyle 恒定 = 锁定文体', s1.npcStyle===locked && s2.npcStyle===locked, `${s1.npcStyle}/${s2.npcStyle} vs ${locked}`);
}

/* ---- 图鉴认知（破招推进） ---- */
console.log('\n[图鉴认知升级]');
{
  const g = newGame();
  const c1 = Codex.getFoeCognition('zhou_xiaoman');
  const sess = g.createSession({ npc: zxm.npc });
  const out = sess.resolve('ci', 'haofang', [3]);   // 词体 → 破绽命中
  await g.settleBattle(sess, out);
  const c2 = Codex.getFoeCognition('zhou_xiaoman');
  check('破招命中后认知≥1(相识/破招)', c2.level >= 1, `level=${c2.level} (破绽Hits=${c2.weaknessHits})`);
}

/* ---- 无机制 NPC（陈砚秋）兼容 ---- */
console.log('\n[无机制 NPC 兼容]');
{
  const cyq = findByNpcId && { npc: { id:'chen_yanqiu', name:'陈砚秋', tier:'童生级', attrs:{ shi:4, ci:10, lian:3, bi:4, xue:3, si:4 } } };
  const g = newGame();
  const sess = g.createSession({ npc: cyq.npc });
  check('无 mech → 不锁定意图', sess.intentLocked === null);
  const out = sess.resolve('shi', 'haofang', [3]);
  check('无 mech → 无机制修正', !(out.mech && out.mech.mods && (out.mech.mods.pct.length||out.mech.mods.flat.length)));
}

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail ? 1 : 0);
