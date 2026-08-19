#!/usr/bin/env node
/*
 * 三流派 v3.0 大胆反馈版：固定局面 + Monte Carlo 纸面原型
 * 仅模拟，不修改 playable 游戏代码。
 * 目标：验证前 3-8 回合反馈、胜率、终局属性、文心/灵感经济、辞宗奇遇负担。
 */
import fs from 'fs';
import { fileURLToPath } from 'url';

const N = Number(process.env.N || 20000);
const BATTLES = 12;
const SCHOOLS = ['bowen', 'qishi', 'cizong_bi'];
const STRATEGIES = ['safe', 'balanced', 'greedy'];
const STYLE_KEYS = ['shi', 'ci', 'lian'];
const BASIC_KEYS = ['bi', 'xue', 'si'];
const BATTLE_COEF = { style: 10, bi: 4, xue: 3, si: 5, dice: 5 };
const MATRIX = [
  [0.12, 0.02, -0.04],
  [0.02, 0.12, 0.04],
  [-0.04, 0.04, 0.12],
  [0.08, 0.04, 0.00],
  [0.00, 0.08, 0.04],
  [0.04, 0.00, 0.08]
];
const THEMES = ['yongwu', 'songbie', 'shanshui', 'biansai', 'huaigu', 'jieling'];

const PARAM = {
  initialAttr: 5,
  schoolOpen: 3,
  bowenStyleRatioDenom: 2,
  bowenQuizStyle: 1,
  bowenTriggerNeed: 2,
  bowenGuaranteeBattle: 3,
  bowenTalentAttr: 2,
  qishiDrop: 0.35,
  qishiDropCap: 0.45,
  qishiGuaranteeBattle: 5,
  qishiUpgradeRatio: 0.65,
  qishiInspRatio: 0.35,
  qishiInspDenom: 3,
  qishiTurnInspCap: 6,
  cizongBasicRatioDenom: 4,
  cizongPostBasic: 1,
  cizongDicePlus: 1,
  cizongDiceCap: 5,
  cizongEventCost: 1,
  cizongEventBasicGain: 3,
  baseDrop: 0.15,
  baseUpgradeCosts: [10, 14, 18],
  baseTalentPower: 2.4,
  upgradeTalentPower: 1.6,
  quizCorrectGain: 4,
  choiceGain: 4,
  normalBattleStyleGain: 3,
  normalBattleBasicGain: 1,
  battleInspCost: 2,
  positiveInspSources: { quiz: 1, choice: 1, ping: 2, event: 3, win: 2 },
  winInsp: 2,
  maxInsp: 80,
  initialInsp: 60
};

class RNG {
  constructor(seed) { this.s = seed >>> 0; }
  next() { this.s = (1664525 * this.s + 1013904223) >>> 0; return this.s / 0x100000000; }
  int(n) { return Math.floor(this.next() * n); }
  pick(a) { return a[this.int(a.length)]; }
  normal(mu = 0, sigma = 1) {
    const u = Math.max(1e-9, this.next());
    const v = Math.max(1e-9, this.next());
    return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}

function makeState(school, strategy) {
  const attrs = Object.fromEntries([...STYLE_KEYS, ...BASIC_KEYS].map(k => [k, PARAM.initialAttr]));
  const schoolAttr = school === 'bowen' ? 'xue' : school === 'qishi' ? 'si' : 'bi';
  attrs[schoolAttr] += PARAM.schoolOpen;
  // 计入三派初始文心的常驻属性：T004 博览 xue+2、T008 推敲 si+3、T006 入木三分 bi+3。
  attrs[schoolAttr] += school === 'bowen' ? 2 : 3;
  return {
    school, strategy, attrs,
    insp: PARAM.initialInsp, talents: 1, upgrades: 0,
    talentLevels: 1, battleWins: 0, battleDraws: 0, battleLosses: 0,
    styleProgress: { shi: 0, ci: 0, lian: 0 },
    basicProgress: { bi: 0, xue: 0, si: 0 },
    bowenKnowledge: 0, bowenChoices: 0, bowenEvents: 0, bowenRecruit: 0,
    qishiInspProgress: 0, cizongEvents: 0, cizongPostAttr: 0,
    eventGain: 0, eventTime: 0, score: 0,
    firstFeedbackBattle: null, firstTalentBattle: null, firstUpgradeBattle: null,
    maxSingleAttrGain: 0, maxInsp: PARAM.initialInsp,
    styleChoices: { shi: 0, ci: 0, lian: 0 },
    invalidSwitches: 0, lastStyle: null,
    hadBowenChoice: false, hadBowenEvent: false,
    noRecurse: true
  };
}

function positiveInsp(st, base, source) {
  let gain = Math.max(0, Number(base) || 0);
  if (st.school === 'qishi' && gain > 0) {
    st.qishiInspProgress += gain;
    const extra = Math.floor(st.qishiInspProgress / PARAM.qishiInspDenom);
    st.qishiInspProgress %= PARAM.qishiInspDenom;
    gain += extra;
  }
  st.insp = Math.min(PARAM.maxInsp, st.insp + gain);
  st.maxInsp = Math.max(st.maxInsp, st.insp);
  return gain;
}

function spendInsp(st, n) { st.insp = Math.max(0, st.insp - Math.max(0, n)); }

function addStyle(st, key, base, opts = {}) {
  const n = Math.max(0, Math.round(base));
  if (!n || !STYLE_KEYS.includes(key)) return 0;
  let gain = n;
  if (st.school === 'bowen' && !opts.noBowenAccelerator) {
    st.styleProgress[key] += n;
    const extra = Math.floor(st.styleProgress[key] / PARAM.bowenStyleRatioDenom);
    st.styleProgress[key] %= PARAM.bowenStyleRatioDenom;
    gain += extra;
  }
  st.attrs[key] += gain;
  st.maxSingleAttrGain = Math.max(st.maxSingleAttrGain, gain);
  return gain;
}

function addBasic(st, key, base, opts = {}) {
  const n = Math.max(0, Math.round(base));
  if (!n || !BASIC_KEYS.includes(key)) return 0;
  let gain = n;
  if (st.school === 'cizong_bi' && !opts.noCizongAccelerator) {
    st.basicProgress[key] += n;
    const extra = Math.floor(st.basicProgress[key] / PARAM.cizongBasicRatioDenom);
    st.basicProgress[key] %= PARAM.cizongBasicRatioDenom;
    gain += extra;
  }
  st.attrs[key] += gain;
  st.maxSingleAttrGain = Math.max(st.maxSingleAttrGain, gain);
  return gain;
}

function chooseStyle(st, themeIndex, npcStyle, informed = false) {
  const affinity = MATRIX[themeIndex];
  const vals = STYLE_KEYS.map((key, i) => {
    const attr = st.attrs[key] * BATTLE_COEF.style;
    const aff = affinity[i] * 100;
    const intent = informed && key === npcStyle ? -6 : 0;
    const noise = st.strategy === 'greedy' ? 0 : (st.strategy === 'safe' ? (i === 0 ? 1 : 0) : 0);
    return attr + aff + intent + noise;
  });
  let best = 0;
  for (let i = 1; i < vals.length; i++) if (vals[i] > vals[best]) best = i;
  if (st.strategy === 'greedy' && st.school === 'qishi' && st.lastStyle !== null && st.bowenKnowledge === -1) {
    best = (best + 1) % 3;
  }
  const key = STYLE_KEYS[best];
  st.styleChoices[key]++;
  return key;
}

function talentDrop(st, rng, battleNo) {
  let p = PARAM.baseDrop;
  if (st.school === 'qishi') p = Math.min(PARAM.qishiDropCap, PARAM.qishiDrop);
  const guaranteed = st.school === 'qishi' && battleNo === PARAM.qishiGuaranteeBattle && st.talents < 6;
  if ((!guaranteed && rng.next() >= p) || st.talents >= 6) return false;
  st.talents++;
  if (st.firstTalentBattle == null) st.firstTalentBattle = battleNo;
  if (st.school === 'bowen') {
    const key = st.strategy === 'safe' ? 'xue' : (st.strategy === 'greedy' ? STYLE_KEYS[rng.int(3)] : BASIC_KEYS[rng.int(3)]);
    if (STYLE_KEYS.includes(key)) addStyle(st, key, PARAM.bowenTalentAttr, { noBowenAccelerator: true });
    else addBasic(st, key, PARAM.bowenTalentAttr, { noCizongAccelerator: true });
    st.bowenRecruit++;
  }
  return true;
}

function maybeUpgrade(st, battleNo, rng) {
  const can = st.talents > st.upgrades + 1 && st.insp >= 4;
  if (!can) return false;
  const costIndex = Math.min(st.upgrades, PARAM.baseUpgradeCosts.length - 1);
  const baseCost = PARAM.baseUpgradeCosts[costIndex];
  const cost = st.school === 'qishi' ? Math.max(1, Math.ceil(baseCost * PARAM.qishiUpgradeRatio)) : baseCost;
  const willingness = st.strategy === 'greedy' ? 0.9 : st.strategy === 'balanced' ? 0.7 : 0.45;
  if (st.insp < cost || rng.next() > willingness) return false;
  spendInsp(st, cost);
  st.upgrades++;
  st.talentLevels++;
  if (st.firstUpgradeBattle == null) st.firstUpgradeBattle = battleNo;
  return true;
}

function bowenChoice(st, rng, battleNo) {
  st.bowenKnowledge = 0;
  st.bowenChoices++;
  st.hadBowenChoice = true;
  if (st.firstFeedbackBattle == null) st.firstFeedbackBattle = battleNo;
  const options = ['focus', 'broad', 'battle'];
  let chosen = st.strategy === 'safe' ? 'broad' : st.strategy === 'greedy' ? 'focus' : 'battle';
  if (!options.includes(chosen)) chosen = rng.pick(options);
  if (chosen === 'focus') {
    const key = STYLE_KEYS[rng.int(3)];
    addStyle(st, key, 3, { noBowenAccelerator: true });
    st.styleProgress[key] += 1;
  } else if (chosen === 'broad') {
    for (const key of STYLE_KEYS) addStyle(st, key, 1, { noBowenAccelerator: true });
    if (st.bowenEvents < 2) { st.bowenEvents++; st.hadBowenEvent = true; st.eventTime += 0.35; st.eventGain += 2; }
  } else {
    addBasic(st, 'xue', 2, { noCizongAccelerator: true });
    positiveInsp(st, 2, 'bowenChoice');
  }
  if (st.bowenChoices >= 2 && (st.bowenChoices === 2 || (st.bowenChoices - 2) % 3 === 0)) {
    st.bowenEvents++;
    st.hadBowenEvent = true;
    st.eventTime += 0.65;
    const eventStyle = STYLE_KEYS[rng.int(3)];
    addStyle(st, eventStyle, 2, { noBowenAccelerator: true });
    st.eventGain += 2;
  }
}

function prep(st, rng, battleNo) {
  const roll = rng.next();
  if (roll < 0.45) {
    const correct = rng.next() < (st.strategy === 'safe' ? 0.78 : st.strategy === 'balanced' ? 0.72 : 0.64);
    if (correct) {
      const key = STYLE_KEYS[rng.int(3)];
      addStyle(st, key, PARAM.quizCorrectGain);
      positiveInsp(st, PARAM.positiveInspSources.quiz, 'quiz');
      if (st.school === 'bowen') {
        addStyle(st, key, PARAM.bowenQuizStyle, { noBowenAccelerator: true });
        st.bowenKnowledge++;
      }
    } else if (st.school === 'bowen') {
      st.bowenKnowledge = Math.max(0, st.bowenKnowledge - 0.25);
    }
  } else if (roll < 0.62) {
    const correct = rng.next() < (st.strategy === 'greedy' ? 0.76 : 0.68);
    if (correct) {
      if (st.school === 'bowen') {
        const key = STYLE_KEYS[rng.int(3)];
        addStyle(st, key, PARAM.choiceGain);
        addStyle(st, key, PARAM.bowenQuizStyle, { noBowenAccelerator: true });
        st.bowenKnowledge++;
      } else addBasic(st, BASIC_KEYS[rng.int(3)], PARAM.choiceGain);
      positiveInsp(st, PARAM.positiveInspSources.choice, 'choice');
    }
  } else if (roll < 0.72 && st.school === 'bowen') {
    st.bowenKnowledge++;
    if (rng.next() < 0.7) addStyle(st, STYLE_KEYS[rng.int(3)], 2, { noBowenAccelerator: true });
  }
  if (st.school === 'bowen' && st.bowenKnowledge >= PARAM.bowenTriggerNeed) bowenChoice(st, rng, battleNo);
  if (st.school === 'bowen' && battleNo === PARAM.bowenGuaranteeBattle && st.bowenChoices === 0) bowenChoice(st, rng, battleNo);
}

function battle(st, rng, battleNo) {
  const themeIndex = (battleNo - 1) % THEMES.length;
  const npcStyle = STYLE_KEYS[(themeIndex + 1) % STYLE_KEYS.length];
  const informed = st.school === 'bowen' && (st.bowenChoices > 0 || st.bowenKnowledge === -1);
  const style = chooseStyle(st, themeIndex, npcStyle, informed);
  if (st.school === 'qishi' && st.strategy === 'greedy' && st.lastStyle === style && battleNo > 1) st.invalidSwitches++;
  st.lastStyle = style;

  const pipsBase = 3.5 + (st.school === 'cizong_bi' ? PARAM.cizongDicePlus : 0);
  const dice = Math.max(1, Math.min(6, Math.round(pipsBase + rng.normal(0, 1.7))));
  const playerBase = st.attrs[style] * BATTLE_COEF.style + st.attrs.bi * BATTLE_COEF.bi + st.attrs.xue * BATTLE_COEF.xue + st.attrs.si * BATTLE_COEF.si + dice * BATTLE_COEF.dice;
  const talentPower = (st.talents - 1) * PARAM.baseTalentPower + st.upgrades * PARAM.upgradeTalentPower;
  const affinity = MATRIX[themeIndex][STYLE_KEYS.indexOf(style)] * 100;
  const playerScore = playerBase + affinity + talentPower;

  // 校准到可区分的固定局面：当前 v3 只是早期大胆版，NPC 基准需落在玩家中位附近，避免全派 95%+ 胜率掩盖机制差异。
  const npcBase = 230 + battleNo * 4.5 + rng.normal(0, 16);
  const diff = playerScore - npcBase;
  const result = diff >= 8 ? 'win' : diff <= -8 ? 'loss' : 'draw';
  if (result === 'win') { st.battleWins++; positiveInsp(st, PARAM.winInsp, 'win'); }
  else if (result === 'draw') st.battleDraws++;
  else st.battleLosses++;

  addStyle(st, style, result === 'win' ? PARAM.normalBattleStyleGain : result === 'draw' ? 1 : 0);
  addBasic(st, 'bi', result === 'win' ? 1 : result === 'draw' ? 1 : 0);

  if (result === 'win') talentDrop(st, rng, battleNo);
  // 奇士早期反馈敏感性开关：第5场前仍无文心时，即使本场未胜也给一次“文心引荐”保底。
  if (st.school === 'qishi' && battleNo === PARAM.qishiGuaranteeBattle && st.talents === 1) talentDrop(st, rng, battleNo);
  maybeUpgrade(st, battleNo, rng);

  // 各派的“首个可感知反馈”独立记录：博闻=首次抉择，奇士=首次文心，辞宗=首场创作骰点/战后结算。
  if (st.school === 'qishi' && st.firstFeedbackBattle == null && st.firstTalentBattle != null) st.firstFeedbackBattle = st.firstTalentBattle;
  if (st.school === 'cizong_bi' && st.firstFeedbackBattle == null) st.firstFeedbackBattle = battleNo;

  if (st.school === 'cizong_bi') {
    const target = st.strategy === 'safe' ? 'bi' : st.strategy === 'balanced' ? BASIC_KEYS[(battleNo + 1) % 3] : BASIC_KEYS[rng.int(3)];
    addBasic(st, target, PARAM.cizongPostBasic, { noCizongAccelerator: true });
    st.cizongPostAttr += PARAM.cizongPostBasic;
    st.cizongEvents++;
    st.eventTime += 1.0;
    spendInsp(st, PARAM.cizongEventCost);
    const eventRoll = rng.next();
    if (eventRoll < 0.55) { addBasic(st, BASIC_KEYS[rng.int(3)], PARAM.cizongEventBasicGain); st.eventGain += PARAM.cizongEventBasicGain; }
    else if (eventRoll < 0.82) { addStyle(st, STYLE_KEYS[rng.int(3)], 2); st.eventGain += 2; }
    else { positiveInsp(st, 4, 'event'); st.eventGain += 4; }
  }
}

function runOne(school, strategy, seed) {
  const rng = new RNG(seed);
  const st = makeState(school, strategy);
  for (let b = 1; b <= BATTLES; b++) { prep(st, rng, b); battle(st, rng, b); }
  st.score = st.battleWins * 1 + st.battleDraws * 0.25;
  return st;
}

function summarize(rows) {
  const n = rows.length;
  const avg = key => rows.reduce((s, x) => s + (Number(key(x)) || 0), 0) / n;
  const pct = key => rows.filter(key).length / n;
  const med = key => { const a = rows.map(key).sort((a, b) => a - b); return a[Math.floor(a.length / 2)] || 0; };
  return {
    runs: n,
    winRate: avg(x => x.battleWins / BATTLES),
    drawRate: avg(x => x.battleDraws / BATTLES),
    lossRate: avg(x => x.battleLosses / BATTLES),
    attrsTotal: avg(x => Object.values(x.attrs).reduce((s, v) => s + v, 0)),
    styleTotal: avg(x => STYLE_KEYS.reduce((s, k) => s + x.attrs[k], 0)),
    basicTotal: avg(x => BASIC_KEYS.reduce((s, k) => s + x.attrs[k], 0)),
    talentCount: avg(x => x.talents),
    upgradeCount: avg(x => x.upgrades),
    finalInsp: avg(x => x.insp),
    maxInsp: avg(x => x.maxInsp),
    firstFeedbackBattle: med(x => x.firstFeedbackBattle ?? 99),
    feedbackByB3: pct(x => x.firstFeedbackBattle != null && x.firstFeedbackBattle <= 3),
    feedbackByB8: pct(x => x.firstFeedbackBattle != null && x.firstFeedbackBattle <= 8),
    firstTalentBattle: med(x => x.firstTalentBattle ?? 99),
    firstUpgradeBattle: med(x => x.firstUpgradeBattle ?? 99),
    bowenChoices: avg(x => x.bowenChoices),
    bowenRecruit: avg(x => x.bowenRecruit),
    bowenEvents: avg(x => x.bowenEvents),
    cizongEvents: avg(x => x.cizongEvents),
    cizongPostAttr: avg(x => x.cizongPostAttr),
    eventGain: avg(x => x.eventGain),
    eventTime: avg(x => x.eventTime),
    highestStyleRate: avg(x => Math.max(...Object.values(x.styleChoices)) / BATTLES),
    invalidSwitches: avg(x => x.invalidSwitches),
    maxSingleAttrGain: med(x => x.maxSingleAttrGain)
  };
}

const all = [];
for (const school of SCHOOLS) for (const strategy of STRATEGIES) {
  const rows = [];
  for (let i = 0; i < N; i++) rows.push(runOne(school, strategy, 0x1a2b3c4d + i * 97 + school.length * 1009 + strategy.length * 313));
  all.push({ school, strategy, summary: summarize(rows) });
}

const output = { generatedAt: new Date().toISOString(), runsPerCell: N, battles: BATTLES, params: PARAM, cells: all };
const outPath = fileURLToPath(new URL('./sim_three_schools_v3.json', import.meta.url));
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
