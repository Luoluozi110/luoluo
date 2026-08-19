/**
 * E2 参数探索：在不改配置文件的前提下，运行时给 NPC mech 施加
 *   sigBoost  —— 招牌强度倍率（作用到 pct / floorPct / floor）
 *   retCut    —— 破绽 retention 折减系数（retention=origin×retCut）
 * 快速粗扫，确定「规划破绽领先 ≥10pp」需要的参数域，再决定落盘改动。
 */
import * as R from './feihuaqi-playable/js/engine/rules.js';
import { Game } from './feihuaqi-playable/js/engine/game.js';
import fs from 'node:fs';

const D = 'feihuaqi-playable/config/';
function loadBase() {
  const base = {};
  for (const n of ['attrs','inspiration','board','questions','events','talents','schools','affinity','npcs','sky','grades','album','synergies','npc-mechanics']) {
    try { base[n] = JSON.parse(fs.readFileSync(D + n + '.json', 'utf8')); } catch { base[n] = []; }
  }
  const board = base.board;
  const byId = new Map();
  for (const c of board.mainRing) byId.set(c.id, { ...c, ring: 'main' });
  const declared = new Map();
  for (const c of (board.branchCells || [])) declared.set(c.id, c);
  for (const [bid, br] of Object.entries(board.branches || {})) {
    const BT = ['ping','quiz','event','battle','landmark'];
    br.cells.forEach((cid, i) => { const d = declared.get(cid) || {}; byId.set(cid, { id: cid, type: d.type || BT[i] || 'ping', name: d.name || br.landmark + '·' + (i + 1), branch: bid, branchIndex: i, ring: 'branch' }); });
  }
  board.cellById = byId; board.gateOf = {};
  for (const [g, b] of Object.entries(board.branchGates || {})) board.gateOf[b] = Number(g);
  board.laps = Number(board.laps) || 2; board.ringSize = board.mainRing.length;
  base.questions = (base.questions || []).filter(q => q.enabled !== false);
  base.events = (base.events || []).filter(e => e.enabled !== false);
  base.talentById = new Map((base.talents || []).map(t => [t.id, t]));
  return base;
}

function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function decide(strategy, session, rand) {
  const a = session.playerAttrs;
  const allow = ['shi','ci','lian'].filter(s => session.canUseStyle ? session.canUseStyle(s) : true);
  const bestOf = () => { let b = allow[0], bv = -Infinity; for (const s of allow) { const v = R.expectedScore(a, s); if (v > bv) { bv = v; b = s; } } return b; };
  const bestManner = () => { let b = session.manners[0], bv = -Infinity; for (const m of session.manners) { const v = session.affinityOf(m); if (v > bv) { bv = v; b = m; } } return b; };
  const style = bestOf(), manner = bestManner();
  const dice = [1 + Math.floor(rand() * 6)];
  const il = session.intentLocked, mech = session.npc && session.npc.mech;
  if (strategy === 'simple') return { style, manner, dice };
  if (strategy === 'readIntent') {
    let chosen = style;
    const sigTpl = mech && mech.signature && (mech.signature.main || mech.signature);
    if (il && sigTpl && sigTpl.template === 'sig_style_mastery' && sigTpl.style === il.style) {
      const alt = notStyle(il.style).filter(s => allow.includes(s));
      if (alt.length) chosen = alt[0];
    }
    return { style: chosen, manner, dice };
  }
  if (strategy === 'planWeakness') {
    const mech2 = session.npc && session.npc.mech;
    const w = mech2 && mech2.weakness;
    const npcSig = mech2 && mech2.signature && (mech2.signature.main || mech2.signature);
    const npcExp = R.expectedScore(a, style);
    const estSignature = (() => {
      if (!npcSig) return 0;
      const templates = session.templates && session.templates; // hmm
      if (['sig_style_mastery','sig_repeat_read','sig_copycat'].includes(npcSig.template)) return npcExp * (Number(npcSig.pct) || 0);
      if (npcSig.template === 'sig_steady_pressure') { if (npcSig.floorPct != null) return npcExp * (Number(npcSig.floorPct) || 0); return Number(npcSig.floor) || 0; }
      return 0;
    })();
    const candidates = [];
    for (const s of allow) for (const m of session.manners) {
      const base = R.expectedScore(a, s);
      let hit = false, retForHit = 1;
      if (w) {
        if (w.template === 'wea_use_other_style') { hit = s !== w.npcStyle; retForHit = (w.fullClose && w.fullClose.includes(s)) || w.fullClose === '*' ? 0 : (w.partialReduction && w.partialReduction.retention != null ? Number(w.partialReduction.retention) : Number(w.retention)); }
        else if (w.template === 'wea_harmonious_manner') { hit = (w.manners || []).includes(m); retForHit = Number(w.retention); }
        else if (w.template === 'wea_style_manner_combo') { hit = (w.style === s && (w.manners || []).includes(m)); retForHit = Number(w.retention); }
        else if (w.template === 'wea_base_dice_only') hit = true;
        else if (w.template === 'wea_switch_style' || w.template === 'wea_crushing_win') hit = s !== style;
      }
      if (isNaN(retForHit)) retForHit = 1;
      const bonusVal = (w && w.playerBonus) ? (Number(w.playerBonus) || 0) : 0;
      // 破绽收益 = 关闭招牌 + 玩家获bonus（bonus 乘算玩家 base）
      const weaken = hit ? estSignature * (1 - retForHit) + base * bonusVal : 0;
      candidates.push({ s, m, expected: base + weaken, hit });
    }
    candidates.sort((x, y) => y.expected - x.expected);
    const bestOpt = candidates[0] || { s: style, m: manner, expected: R.expectedScore(a, style), hit: false };
    return { style: bestOpt.s, manner: bestOpt.m, dice };
  }
  if (strategy === 'conservative') return { style, manner, dice: [1 + Math.floor(rand() * 6)] };
  if (strategy === 'aggressive') { const dices = [1 + Math.floor(rand() * 6), 1 + Math.floor(rand() * 6), 1 + Math.floor(rand() * 6)]; return { style, manner, dice: dices }; }
  return { style, manner, dice };
}
function notStyle(s) { return ['shi','ci','lian'].filter(x => x !== s); }

let strategyRef = { current: 'simple' };
function makeGame(base, rand) {
  const ui = {
    floatAttrs() {}, floatInspiration() {}, onState() {}, showDice() {}, movePiece() {}, toast() {},
    highlightCell() {}, showQuizResult() {}, showSky() {}, showLandmark() {}, skyExpired() {},
    showTalentGain() {}, showPalaceIntro() {}, async showResult() {}, async askReplaceTalent() { return 0; },
    async askBranch() { return true; },
    async showQuiz(q) { return { index: Math.floor(rand() * ((q.options || []).length || 1)), timedOut: false }; },
    async askScenic(cell, cost, insp) { return insp >= cost; },
    async showEvent(ev) { const ch = (ev.choices || []).length; return ch ? Math.floor(rand() * ch) : 0; },
    async runBattle(session) { const mv = decide(strategyRef.current, session, rand); return session.resolve(mv.style, mv.manner, mv.dice); }
  };
  const g = new Game({ ...base }, ui, rand);
  g.start(base.schools[Math.floor(rand() * base.schools.length)].id);
  return { g, ui };
}
async function runBattleOnce(g, npc, theme, isPalace, cloneAttrs = true) {
  // 镜像口径：克隆 NPC 六维；均衡口径：玩家六维近均衡，便于检验换文体克制破绽的低成本路径
  const a = (npc && npc.attrs) || { shi:10, ci:10, lian:10, bi:10, xue:10, si:10 };
  if (cloneAttrs) {
    g.s.attrs = JSON.parse(JSON.stringify(a));
  } else {
    // 均衡玩家：三个文体为 (max+min)/2 附近，基本功取 NPC 的 bi/xue/si
    const stys = [a.shi||0, a.ci||0, a.lian||0];
    const maxv = Math.max(...stys), minv = Math.min(...stys);
    const mid = Math.round((maxv + minv) / 2);
    g.s.attrs = { shi: mid, ci: mid, lian: mid, bi: a.bi||5, xue: a.xue||5, si: a.si||5 };
  }
  const session = g.createSession({ npc, theme, isPalace });
  const mv = decide(strategyRef.current, session, g.rand);
  const res = session.resolve(mv.style, mv.manner, mv.dice);
  await g.settleBattle(session, res);
  return { session, res, mv };
}

async function sweep(sigBoost, retCut, bonus, REPS = 12, cloneAttrs = true) {
  const base = loadBase();
  // 运行时注入：提高招牌强度、降低破绽 retention、增强破绽命中带给玩家的 bonus
  for (const t of base.npcs) for (const n of (t.npcs || [])) {
    if (!n.mech) continue;
    const sig = n.mech.signature && (n.mech.signature.main || n.mech.signature);
    if (sig) {
      if (['sig_style_mastery','sig_repeat_read','sig_copycat','sig_manner_theme'].includes(sig.template) && sig.pct != null) sig.pct = Math.round(sig.pct * sigBoost * 1000) / 1000;
      if (sig.template === 'sig_steady_pressure') { if (sig.floorPct != null) sig.floorPct = Math.round(sig.floorPct * sigBoost * 1000) / 1000; if (sig.floor != null) sig.floor = Math.round(sig.floor * sigBoost); }
      const weakSig = n.mech.signature && n.mech.signature.weak;
      if (weakSig) {
        if (['sig_style_mastery','sig_repeat_read','sig_copycat','sig_manner_theme'].includes(weakSig.template) && weakSig.pct != null) weakSig.pct = Math.round(weakSig.pct * sigBoost * 1000) / 1000;
        if (weakSig.template === 'sig_steady_pressure') { if (weakSig.floorPct != null) weakSig.floorPct = Math.round(weakSig.floorPct * sigBoost * 1000) / 1000; if (weakSig.floor != null) weakSig.floor = Math.round(weakSig.floor * sigBoost); }
      }
    }
    const w = n.mech.weakness;
    if (w && w.retention != null) w.retention = Math.max(0, Math.min(1, Number(w.retention) * retCut));
    if (w && w.partialReduction && w.partialReduction.retention != null) w.partialReduction.retention = Math.max(0, Math.min(1, Number(w.partialReduction.retention) * retCut));
    if (w) w.playerBonus = bonus;
  }
  const mechNPCs = [];
  for (const t of base.npcs) for (const n of (t.npcs || [])) if (n.mech) mechNPCs.push({ tier: t.tier, npc: n, isFinal: !!t.isFinal });
  const SEED = 20260815;
  const agg = { simple: { wins: 0, games: 0 }, planWeakness: { wins: 0, games: 0 } };
  for (const strat of ['simple','planWeakness']) {
    strategyRef.current = strat;
    let idx = 0;
    for (const { npc, isFinal } of mechNPCs) {
      for (let rep = 0; rep < REPS; rep++) {
        const rand = rng(SEED + (strat === 'planWeakness' ? 1 : 0) * 10000 + idx * 7 + rep);
        const { g } = makeGame(base, rand);
        const theme = base.affinity.themes[Math.floor(rand() * base.affinity.themes.length)];
        const { res } = await runBattleOnce(g, npc, theme, isFinal, cloneAttrs);
        agg[strat].games++;
        if (res.result === 'win') agg[strat].wins++;
        idx++;
      }
    }
  }
  const simple = agg.simple, plan = agg.planWeakness;
  const lead = (plan.wins / plan.games - simple.wins / simple.games) * 100;
  return {
    sigBoost, retCut, bonus, REPS, cloneAttrs,
    simpleWin: simple.wins / simple.games * 100,
    planWin: plan.wins / plan.games * 100,
    lead
  };
}

(async () => {
  console.log('===== 均衡玩家口径（非镜像，玩家文体近均衡）=====');
  console.log('bonus   x retCut | simple胜率 | plan胜率 | 领先pp');
  const rows = [];
  const combos = [];
  for (const b of [0, 0.03, 0.06, 0.1, 0.15]) for (const r of [1, 0.5, 0.3, 0.1]) combos.push([b, r]);
  for (const [b, r] of combos) {
    const row = await sweep(1, r, b, 12, false);
    rows.push(row);
    console.log(`${(b * 100).toFixed(0).padStart(4)}%  x ${r.toFixed(1).padStart(4)}  | ${row.simpleWin.toFixed(1)}% | ${row.planWin.toFixed(1)}% | ${row.lead.toFixed(1)}`);
  }
  process.exit(0);
})();
