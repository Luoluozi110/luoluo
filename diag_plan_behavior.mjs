/**
 * 诊断 planWeakness 策略的实际行为：对每个 NPC，
 * 输出计划选文体 vs 最高属性文体、计划命中破绽与否、胜负。
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
  if (strategy === 'simple') return { style, manner, dice };
  const mech = session.npc && session.npc.mech;
  if (strategy === 'planWeakness') {
    const w = mech && mech.weakness;
    const npcSig = mech && mech.signature && (mech.signature.main || mech.signature);
    const npcExp = R.expectedScore(a, style);
    const estSignature = (() => {
      if (!npcSig) return 0;
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
      const weaken = hit ? estSignature * (1 - retForHit) : 0;
      candidates.push({ s, m, expected: base + weaken, hit, base });
    }
    candidates.sort((x, y) => y.expected - x.expected);
    const bestOpt = candidates[0];
    return { style: bestOpt.s, manner: bestOpt.m, dice, _dbg: { bestStyle: style, bestExp: R.expectedScore(a, style), chosenStyle: bestOpt.s, chosenExp: R.expectedScore(a, bestOpt.s), chosenHit: bestOpt.hit, estSig: estSignature, weaTpl: w && w.template } };
  }
  return { style, manner, dice };
}

const strategyRef = { current: 'simple' };
function makeGame(base, rand) {
  const ui = {
    floatAttrs() {}, floatInspiration() {}, onState() {}, showDice() {}, movePiece() {}, toast() {},
    highlightCell() {}, showQuizResult() {}, showSky() {}, showLandmark() {}, skyExpired() {},
    showTalentGain() {}, showPalaceIntro() {}, async showResult() {}, async askReplaceTalent() { return 0; },
    async askBranch() { return true; },
    async showQuiz(q) { return { index: 0, timedOut: false }; },
    async askScenic() { return true; },
    async showEvent() { return 0; },
    async runBattle(session) { const mv = decide(strategyRef.current, session, rand); return session.resolve(mv.style, mv.manner, mv.dice); }
  };
  const g = new Game({ ...base }, ui, rand);
  g.start(base.schools[Math.floor(rand() * base.schools.length)].id);
  return { g, ui };
}
async function runBattleOnce(g, npc, theme, isPalace) {
  g.s.attrs = JSON.parse(JSON.stringify((npc && npc.attrs) || {}));
  const session = g.createSession({ npc, theme, isPalace });
  const mv = decide('planWeakness', session, g.rand);
  const res = session.resolve(mv.style, mv.manner, mv.dice);
  await g.settleBattle(session, res);
  return { session, res, mv };
}

(async () => {
  const base = loadBase();
  const mechNPCs = [];
  for (const t of base.npcs) for (const n of (t.npcs || [])) if (n.mech) mechNPCs.push({ tier: t.tier, npc: n, isFinal: !!t.isFinal });
  console.log('npc        wea模板              best→chosen      hit  结果    estSig  bestExp');
  let idx = 0;
  for (const { npc, isFinal } of mechNPCs) {
    const rand = rng(20260815 + 10000 + idx * 7);
    const { g } = makeGame(base, rand);
    const theme = base.affinity.themes[0];
    const { res, mv } = await runBattleOnce(g, npc, theme, isFinal);
    const dbg = mv._dbg || {};
    const wea = (npc.mech.weakness && npc.mech.weakness.template) || '';
    console.log(`${(npc.name || '').padEnd(9)} ${wea.padEnd(24)} ${(dbg.bestStyle || '-')}→${(dbg.chosenStyle || '-')}    ${dbg.chosenHit ? 'hit' : 'miss'}   ${res.result.padEnd(5)} ${String(dbg.estSig || 0).padStart(5)} ${String(dbg.bestExp || 0).padStart(7)}`);
    idx++;
  }
  process.exit(0);
})();
