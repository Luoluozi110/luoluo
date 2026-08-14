/**
 * rules.js —— 纯函数规则层（无 DOM 依赖，可被 selftest.html 直接复用）
 *
 * 唯一战斗公式（全案 3.5.2 / SCHEMA.md）：
 *   得分 = 文体属性×10 + (笔力×4 + 学力×3) + 思力×5 + 1d6×5 + 修正项
 *   平局：双方差 ≤ 高分方的 5%
 *
 * 六维评分公式见全案 3.8。系数由 config/grades.json 提供，
 * 本模块内置 DEFAULT_GRADES 作为缺省与兜底（配置缺字段时逐项回填）。
 */

export const ATTR_KEYS = ['shi', 'ci', 'lian', 'bi', 'xue', 'si'];
export const ATTR_NAMES = {
  shi: '诗力', ci: '词力', lian: '联力', bi: '笔力', xue: '学力', si: '思力'
};
export const CREATIVE_KEYS = ['shi', 'ci', 'lian'];   // 创作力（金）
export const BASIC_KEYS = ['bi', 'xue', 'si'];        // 基本功（青）
export const STYLE_NAMES = { shi: '诗', ci: '词', lian: '联' };

/* ============================ 战斗公式 ============================ */

export const BATTLE_COEF = {
  styleMult: 10,   // 格律分：文体属性 ×10
  biMult: 4,       // 意象分：笔力 ×4
  xueMult: 3,      // 意象分：学力 ×3
  siMult: 5,       // 立意分：思力 ×5
  diceMult: 5,     // 灵感骰：1d6 ×5
  drawRatio: 0.05  // 平局带
};

/**
 * 计算一方的作品得分，逐项返回明细（供 UI 五项弹出累加）。
 * @param {object} input
 *  - attrs      六维 {shi,ci,lian,bi,xue,si}
 *  - style      出战文体 'shi'|'ci'|'lian'
 *  - dice       1d6 点数（1–6）
 *  - diceMult   灵感骰系数，默认 5（「语不惊人」改 8 → 传 8）
 *  - dicePlus   骰点加值（「急智」+1），作用于点数而非分数
 *  - diceFixed  固定灵感骰分值（「七步成诗」= 15），设置后忽略 dice
 *  - pctMods    百分比修正 [{source,label,value}]，value 如 0.10
 *  - flatMods   固定值修正 [{source,label,value}]
 *  - critMult   暴击倍率（默认 1）
 * @returns {{items:Array,base:number,modScore:number,total:number,breakdown:object}}
 */
export function battleScore(input) {
  const a = input.attrs || {};
  const g = (k) => Math.max(0, Number(a[k]) || 0);
  const styleAttr = g(input.style);

  const dMult = num(input.diceMult, BATTLE_COEF.diceMult);
  const dPlus = num(input.dicePlus, 0);
  const critMult = num(input.critMult, 1);
  const pctMods = input.pctMods || [];
  const flatMods = input.flatMods || [];

  const gelv = styleAttr * BATTLE_COEF.styleMult;
  const yixiang = g('bi') * BATTLE_COEF.biMult + g('xue') * BATTLE_COEF.xueMult;
  const liyi = g('si') * BATTLE_COEF.siMult;

  const hasFixed = input.diceFixed !== undefined && input.diceFixed !== null;
  const dicePips = clamp(num(input.dice, 1) + dPlus, 1, 99);
  const diceScore = hasFixed ? Number(input.diceFixed) : dicePips * dMult;

  const base = gelv + yixiang + liyi + diceScore;

  // 先加后乘：所有百分比先求和，再一次性作用于 base
  const pctSum = pctMods.reduce((s, m) => s + (Number(m.value) || 0), 0);
  const flatSum = flatMods.reduce((s, m) => s + (Number(m.value) || 0), 0);
  const modScore = Math.round(base * pctSum) + flatSum;

  const total = Math.round((base + modScore) * critMult);

  const items = [
    { key: 'gelv', label: '格律分', value: gelv,
      detail: `${ATTR_NAMES[input.style] || input.style} ${styleAttr} × 10` },
    { key: 'yixiang', label: '意象分', value: yixiang,
      detail: `笔力 ${g('bi')} × 4 ＋ 学力 ${g('xue')} × 3` },
    { key: 'liyi', label: '立意分', value: liyi,
      detail: `思力 ${g('si')} × 5` },
    { key: 'dice', label: '灵感骰', value: diceScore,
      detail: hasFixed ? `固定发挥 ${input.diceFixed}`
                       : `掷出 ${dicePips} 点 × ${dMult}${dPlus ? `（含骰点 +${dPlus}）` : ''}` },
    { key: 'mods', label: '修正项', value: modScore,
      detail: describeMods(pctMods, flatMods, critMult) }
  ];

  return {
    items, base, modScore, total, dicePips, diceScore,
    breakdown: { gelv, yixiang, liyi, diceScore, modScore, critMult, pctSum, flatSum }
  };
}

/* ================== 成长递减与雪球收敛（Round 3 · 全案 4.4 降方差） ==================
 *
 * 全案 3.1 只规定「属性无硬上限」，未规定成长必须线性。Round 2 实测线性成长导致
 * 高手主修创作力 P90 = 71（全案 4.3 预期 ≈43）、总分 sd = 910，评级分布彻底失真。
 * 故引入两条纯函数式的收敛机制，均由 config/attrs.json 驱动，可整体关闭。
 */

/** 属性收益递减参数：属性越高，同一次 +N 的实得越少 */
export const DEFAULT_DIMINISH = {
  soft: 18,        // 低于 soft：全额
  hard: 28,        // soft～hard：midRate；≥hard：highRate
  midRate: 0.5,
  highRate: 0.25,
  minGain: 1       // 任何正向成长至少 +1（保证飘字有分量，全案 4.6 红线）
};

/**
 * 逐点累进地计算一次属性成长的实得值。
 * 「累进」= 本次成长过程中已获得的点数也计入下一点的档位判定，
 * 因此不存在「一次性跨档白嫖」的漏洞。
 * @param {number} current 当前属性值
 * @param {number} gain    名义成长值（正整数）
 * @param {object|false} cfg config/attrs.json 的 diminish；传 falsy 则不递减
 * @returns {number} 实得成长（整数，≥ minGain）
 */
export function diminishGain(current, gain, cfg) {
  const g = Math.floor(num(gain, 0));
  if (!cfg || g <= 0) return g;
  const d = { ...DEFAULT_DIMINISH, ...cfg };
  let acc = 0;
  let cur = Math.max(0, num(current, 0));
  for (let i = 0; i < g; i++) {
    const rate = cur >= d.hard ? d.highRate : cur >= d.soft ? d.midRate : 1;
    acc += rate;
    cur += rate;
  }
  return Math.max(d.minGain, Math.round(acc));
}

/** 胜利奖励收敛参数：以强凌弱所得渐薄 */
export const DEFAULT_WIN_SCALE = { min: 0.35, max: 1, exp: 1 };

/**
 * 战斗胜利奖励系数 = clamp((对手战力 / 我方战力)^exp, min, max)。
 * 势均力敌 → 1.0 全额；碾压弱者 → 逼近 min。这是掐断「胜→变强→更易胜」正反馈的关键。
 * @param {number} selfPower 我方期望分（R.expectedScore）
 * @param {number} oppPower  对手期望分
 * @param {object|false} cfg config/attrs.json 的 winScale；传 falsy 则恒为 1
 */
export function winRewardScale(selfPower, oppPower, cfg) {
  if (!cfg) return 1;
  const c = { ...DEFAULT_WIN_SCALE, ...cfg };
  const self = Math.max(1, num(selfPower, 1));
  const opp = Math.max(0, num(oppPower, 0));
  return clamp(Math.pow(opp / self, num(c.exp, 1)), c.min, c.max);
}

function describeMods(pctMods, flatMods, critMult) {
  const parts = [];
  for (const m of pctMods) {
    const v = Number(m.value) || 0;
    parts.push(`${m.label || m.source} ${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`);
  }
  for (const m of flatMods) {
    const v = Number(m.value) || 0;
    parts.push(`${m.label || m.source} ${v >= 0 ? '+' : ''}${v}`);
  }
  if (critMult && critMult !== 1) parts.push(`神来之笔 ×${critMult}`);
  return parts.length ? parts.join('　') : '无';
}

/** 胜负判定：差值 ≤ 高分方 5% 判平 */
export function judgeBattle(selfScore, oppScore, drawRatio) {
  const r = num(drawRatio, BATTLE_COEF.drawRatio);
  const hi = Math.max(selfScore, oppScore);
  const diff = Math.abs(selfScore - oppScore);
  if (hi > 0 && diff <= hi * r) return 'draw';
  return selfScore > oppScore ? 'win' : 'lose';
}

/** 相性数值：matrix["manner.theme"]，未列出为 0 */
export function affinityValue(matrix, manner, theme) {
  if (!matrix) return 0;
  return Number(matrix[`${manner}.${theme}`]) || 0;
}

/** 相性星级：3=★★★(+10%) 2=★★ 1=★ 0=相冲 */
export function affinityStars(v) {
  if (v >= 0.10) return 3;
  if (v > 0) return 2;
  if (v === 0) return 1;
  return 0;
}

export function affinityLabel(v) {
  const s = affinityStars(v);
  if (s === 0) return '相冲';
  return '★'.repeat(s) + '☆'.repeat(3 - s);
}

/**
 * 题材的最优风格（基矩阵）。通儒「临题自选最优」身份层由此判定。
 */
export function bestMannerForTheme(matrix, manners, theme) {
  let best = manners[0], bv = -Infinity;
  for (const m of manners) {
    const v = affinityValue(matrix, m, theme);
    if (v > bv) { bv = v; best = m; }
  }
  return best;
}

/**
 * 相性 2.0 · 综合相性（玩家决策/UI 用，不含气势连捷）：
 *   基矩阵 + 门派文风(本门功底/通儒自适应) + 当朝风潮(热点题材/得势文体)。
 * NPC 侧只取基矩阵（affinityValue），上述三层是玩家专属的策略优势。
 * @param {object} af       完整 affinity 配置（含 knobs）
 * @param {string} manner
 * @param {string} theme
 * @param {string|null} schoolHome  学派 homeManner，可为 'adaptive' 或具体风格或 null
 * @param {object|null} zeitgeist   { theme, manner } 本局风潮
 */
export function effectiveAffinity(af, manner, theme, schoolHome, zeitgeist) {
  let v = affinityValue(af.matrix, manner, theme);
  if (schoolHome) {
    if (schoolHome === 'adaptive') {
      const best = bestMannerForTheme(af.matrix, af.manners, theme);
      if (manner === best) v += Number(af.homeAdaptiveBonus ?? 0.04);
    } else if (manner === schoolHome) {
      v += Number(af.homeMannerBonus ?? 0.05);
    }
  }
  if (zeitgeist) {
    if (theme === zeitgeist.theme) v += Number(af.zeitgeistThemeBonus ?? 0.04);
    if (manner === zeitgeist.manner) v += Number(af.zeitgeistMannerBonus ?? 0.03);
  }
  return v;
}

/**
 * 相性 2.0 · 气势连捷：连续同风格胜场叠加的战力pct，封顶 momentumMax 层。
 * 返回「进入本场前」已累积的加成（首战为 0，败/换风格清零）。
 * @param {{manner:string|null, n:number}} streak  玩家连捷状态
 * @param {string} manner  本场选用风格
 * @param {object} af      含 momentumPer / momentumMax
 */
export function momentumPct(streak, manner, af) {
  const cap = Number(af.momentumMax ?? 5);
  const per = Number(af.momentumPer ?? 0.02);
  if (!streak || streak.manner !== manner || streak.n <= 0) return 0;
  return Math.min(streak.n, cap) * per;
}

/** 相性档位文案（用于 UI 标签） */
export function affinityTierLabel(v) {
  if (v >= 0.12) return '契合';
  if (v > 0) return '相得';
  if (v === 0) return '中平';
  return '相左';
}

/** 综合战力估算（NPC 选文体用）：不含骰子的期望分 */
export function expectedScore(attrs, style) {
  return battleScore({ attrs, style, dice: 3.5 }).total;
}

/** NPC 自动选文体：取期望分最高者（联力 <8 同样受限） */
export function pickNpcStyle(attrs, lianUnlocked) {
  const cands = CREATIVE_KEYS.filter(s => s !== 'lian' || lianUnlocked || (attrs.lian || 0) >= 8);
  let best = cands[0], bestV = -1;
  for (const s of cands) {
    const v = expectedScore(attrs, s);
    if (v > bestV) { bestV = v; best = s; }
  }
  return best;
}

/** NPC 自动选风格：取相性最高者 */
export function pickNpcManner(matrix, manners, theme) {
  let best = manners[0], bestV = -Infinity;
  for (const m of manners) {
    const v = affinityValue(matrix, m, theme);
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
}

/* ============================ 六维评分 ============================ */

/**
 * 软上限递减：value 超过 soft 的部分只按 rate 计。
 * 与战绩维度的「超额胜场半计」同一套语言，用于削掉分数右尾而不动中位
 * （全案 4.4：品级线要建立在收敛的分布上，而不是靠拉线去追长尾）。
 * soft 缺省或 ≤0 时不生效。
 */
export function taper(value, soft, rate) {
  const v = num(value, 0);
  const s = num(soft, 0);
  if (!(s > 0) || v <= s) return v;
  return s + (v - s) * clamp(num(rate, 1), 0, 1);
}

export const DEFAULT_GRADES = {
  dims: {
    wencai: { name: '文采分', mult: 10, soft: 0, softRate: 0.5,
      allHigh: { threshold: 14, bonus: 100, label: '三绝并进' },
      dominant: { bonus: 50, label: '一枝独秀' },
      peak: { threshold: 26, bonus: 80, label: '破壁' } },
    gongli: { name: '功力分', mult: 8, soft: 0, softRate: 0.5,
      balance: { maxRange: 3, bonus: 80, label: '根基匀称' },
      peak: { threshold: 22, bonus: 150, label: '偏锋独绝' } },
    zhanji: { name: '战绩分', win: 50, draw: 20, loss: -10, streak: 25, upset: 30,
      winFull: 99, streakCap: 99,
      allStyles: { minWins: 2, bonus: 100, label: '诗词联三栖' } },
    qiyu: { name: '奇遇分', event: 15, rare: 30, legend: 80, talent: 40, item: 20 },
    liupai: { name: '流派分',
      specialist: { minAttr: 24, minWins: 4, bonus: 200 },
      sanjue: { threshold: 14, bonus: 180, label: '三绝' },
      names: { shi: '诗仙', ci: '词宗', lian: '联圣' } },
    yuanman: { name: '圆满分', reach: 200, perInspiration: 5,
      swift: { maxTurns: 32, bonus: 150, label: '捷才' },
      steady: { maxTurns: 38, minInspiration: 5, bonus: 100, label: '从容' },
      palaceSweep: 150 }
  },
  tiers: [
    { name: '童生', min: 0, max: 599 }, { name: '秀才', min: 600, max: 1099 },
    { name: '举人', min: 1100, max: 1699 }, { name: '进士', min: 1700, max: 2199 },
    { name: '探花', min: 2200, max: 2599 }, { name: '榜眼', min: 2600, max: 2999 },
    { name: '状元', min: 3000, max: 3399 }, { name: '翰林', min: 3400, max: 3799 },
    { name: '文宗', min: 3800, max: 999999 }
  ],
  comments: {
    wencai: '锦心绣口，落笔成章——文采冠绝一时。',
    gongli: '根基深厚，厚积薄发——功力不显山水而自重。',
    zhanji: '百战文场，杀伐果断——笔为刀兵，无往不利。',
    qiyu: '奇遇连连，福至心灵——文章本天成，妙手偶得之。',
    liupai: '一门深入，卓然成家——专精一道，自成宗风。',
    yuanman: '行稳致远，功德圆满——科举一途，善始善终。'
  }
};

/**
 * 把内容侧 config/grades.json 的书写结构（dimensions[] / grades[]）
 * 翻译成引擎内部结构（dims{} / tiers[]）。
 * 内容方按 SCHEMA 写「维度数组 + 加成数组」，引擎读「具名字段」，此处是唯一的转换点。
 * 传入已是内部结构（dims/tiers）时原样返回，两种写法都能吃。
 */
export function adaptGradesConfig(raw) {
  if (!raw || typeof raw !== 'object') return {};
  if (!Array.isArray(raw.dimensions) && !Array.isArray(raw.grades)) return raw;

  const out = {};
  const byKey = new Map((raw.dimensions || []).map(d => [d.key, d]));
  const bonusOf = (dim, id) => ((dim && dim.bonuses) || []).find(b => b.id === id);
  const tierOf = (dim, id) => ((dim && dim.tiers) || []).find(t => t.id === id);
  const dims = {};

  const put = (obj, path, value) => {
    if (value === undefined || value === null) return;
    const keys = path.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) cur = (cur[keys[i]] = cur[keys[i]] || {});
    cur[keys[keys.length - 1]] = value;
  };

  /* 文采分 */
  const wc = byKey.get('wencai');
  if (wc) {
    const d = dims.wencai = {};
    put(d, 'name', wc.name);
    put(d, 'mult', (wc.coeff || {}).shi);
    put(d, 'soft', (wc.coeff || {}).soft);
    put(d, 'softRate', (wc.coeff || {}).softRate);
    const a = bonusOf(wc, 'sanjuejunheng'), b = bonusOf(wc, 'yizhiduxiu'), c = bonusOf(wc, 'pobi');
    if (a) { put(d, 'allHigh.threshold', (a.cond || {}).value); put(d, 'allHigh.bonus', a.score); put(d, 'allHigh.label', a.name); }
    if (b) { put(d, 'dominant.bonus', b.score); put(d, 'dominant.label', b.name); }
    if (c) { put(d, 'peak.threshold', (c.cond || {}).value); put(d, 'peak.bonus', c.score); put(d, 'peak.label', c.name); }
  }

  /* 功力分 */
  const gl = byKey.get('gongli');
  if (gl) {
    const d = dims.gongli = {};
    put(d, 'name', gl.name);
    put(d, 'mult', (gl.coeff || {}).bi);
    put(d, 'soft', (gl.coeff || {}).soft);
    put(d, 'softRate', (gl.coeff || {}).softRate);
    const a = bonusOf(gl, 'genjishenhou'), b = bonusOf(gl, 'pianfeng');
    if (a) { put(d, 'balance.maxRange', (a.cond || {}).value); put(d, 'balance.bonus', a.score); put(d, 'balance.label', a.name); }
    if (b) { put(d, 'peak.threshold', (b.cond || {}).value); put(d, 'peak.bonus', b.score); put(d, 'peak.label', b.name); }
  }

  /* 战绩分 */
  const zj = byKey.get('zhanji');
  if (zj) {
    const d = dims.zhanji = {}, co = zj.coeff || {};
    put(d, 'name', zj.name);
    put(d, 'win', co.win); put(d, 'draw', co.draw); put(d, 'loss', co.lose);
    put(d, 'streak', co.maxStreak); put(d, 'upset', co.upset);
    put(d, 'winFull', co.winFull); put(d, 'streakCap', co.maxStreakCap);
    const a = bonusOf(zj, 'santijiesheng');
    if (a) { put(d, 'allStyles.minWins', (a.cond || {}).value); put(d, 'allStyles.bonus', a.score); put(d, 'allStyles.label', a.name); }
  }

  /* 奇遇分 */
  const qy = byKey.get('qiyu');
  if (qy) {
    const d = dims.qiyu = {}, co = qy.coeff || {};
    put(d, 'name', qy.name);
    put(d, 'event', co.eventCount); put(d, 'rare', co.rareCount);
    put(d, 'legend', co.legendCount); put(d, 'talent', co.talentCount); put(d, 'item', co.itemCount);
  }

  /* 流派分 */
  const lp = byKey.get('liupai');
  if (lp) {
    const d = dims.liupai = {};
    put(d, 'name', lp.name);
    const sx = tierOf(lp, 'shixian'), sj = tierOf(lp, 'sanjue');
    if (sx) {
      put(d, 'specialist.minAttr', (sx.cond || {}).attrMin);
      put(d, 'specialist.minWins', (sx.cond || {}).winMin);
      put(d, 'specialist.bonus', sx.score);
    }
    if (sj) { put(d, 'sanjue.threshold', (sj.cond || {}).value); put(d, 'sanjue.bonus', sj.score); put(d, 'sanjue.label', sj.name); }
    const names = {};
    for (const [key, id] of [['shi', 'shixian'], ['ci', 'cizong'], ['lian', 'liansheng']]) {
      const t = tierOf(lp, id);
      if (t && t.name) names[key] = t.name;
    }
    if (Object.keys(names).length) put(d, 'names', names);
  }

  /* 圆满分 */
  const ym = byKey.get('yuanman');
  if (ym) {
    const d = dims.yuanman = {}, co = ym.coeff || {};
    put(d, 'name', ym.name);
    put(d, 'reach', co.arrive); put(d, 'perInspiration', co.inspirationLeft);
    const a = bonusOf(ym, 'jiecai'), b = bonusOf(ym, 'congrong'), c = bonusOf(ym, 'jinbangtiming');
    if (a) { put(d, 'swift.maxTurns', (a.cond || {}).value); put(d, 'swift.bonus', a.score); put(d, 'swift.label', a.name); }
    if (b) {
      put(d, 'steady.maxTurns', (b.cond || {}).value);
      put(d, 'steady.minInspiration', (b.cond || {}).inspirationMin);
      put(d, 'steady.bonus', b.score); put(d, 'steady.label', b.name);
    }
    if (c) put(d, 'palaceSweep', c.score);
  }

  if (Object.keys(dims).length) out.dims = dims;

  if (Array.isArray(raw.grades) && raw.grades.length) {
    out.tiers = raw.grades.map(g => ({
      name: g.name,
      min: Number(g.min) || 0,
      max: g.max === null || g.max === undefined ? 999999 : Number(g.max)
    }));
  }
  if (raw.comments) out.comments = raw.comments;
  if (raw.battle) out.battle = raw.battle;
  return out;
}

/**
 * 深合并：以 DEFAULT_GRADES 为底，用外部配置覆盖（容忍配置缺字段）。
 *
 * 结果按 cfg 的对象标识记忆化：正式对局里每局只调一次无所谓，但数值台
 * （tools/r3_fit.mjs）要在同一份配置上跑几百万次结算，每次深拷贝一遍 DEFAULT_GRADES
 * 会让拟合从秒级退化到分钟级。配置对象在运行期不被就地改写，故按标识缓存是安全的。
 */
const gradesCache = new WeakMap();
export function normalizeGrades(cfg) {
  if (cfg && typeof cfg === 'object') {
    const hit = gradesCache.get(cfg);
    if (hit) return hit;
    const out = deepMerge(clone(DEFAULT_GRADES), adaptGradesConfig(cfg));
    gradesCache.set(cfg, out);
    return out;
  }
  return deepMerge(clone(DEFAULT_GRADES), adaptGradesConfig(cfg));
}

/**
 * 六维结算。
 * @param {object} s
 *  attrs   {shi,ci,lian,bi,xue,si}
 *  battle  {win,draw,loss,maxStreak,upsets,winsByStyle:{shi,ci,lian}}
 *  events  {total,rare,legend,talents,items}
 *  finish  {reached,inspirationLeft,turns,palaceSweep}
 * @param {object} cfgRaw config/grades.json
 */
export function sixDimScore(s, cfgRaw) {
  const cfg = normalizeGrades(cfgRaw);
  const D = cfg.dims;
  const a = s.attrs || {};
  const b = Object.assign({ win: 0, draw: 0, loss: 0, maxStreak: 0, upsets: 0, winsByStyle: {} }, s.battle);
  const e = Object.assign({ total: 0, rare: 0, legend: 0, talents: 0, items: 0 }, s.events);
  const f = Object.assign({ reached: false, inspirationLeft: 0, turns: 0, palaceSweep: false }, s.finish);
  const n = (k) => Math.max(0, Number(a[k]) || 0);

  /* 维度 1 文采分 */
  const cre = [n('shi'), n('ci'), n('lian')];
  const creSum = cre[0] + cre[1] + cre[2];
  const creMax = Math.max(...cre);
  const w = D.wencai;
  const creEff = taper(creSum, w.soft, w.softRate);
  const p1 = [{
    label: creEff < creSum
      ? `(诗${cre[0]}＋词${cre[1]}＋联${cre[2]}) × ${w.mult}（逾 ${w.soft} 之数半计）`
      : `(诗${cre[0]}＋词${cre[1]}＋联${cre[2]}) × ${w.mult}`,
    value: Math.round(creEff * w.mult)
  }];
  if (cre.every(v => v >= w.allHigh.threshold))
    p1.push({ label: `${w.allHigh.label}：三力均 ≥${w.allHigh.threshold}`, value: w.allHigh.bonus });
  if (creMax > creSum - creMax)
    p1.push({ label: `${w.dominant.label}：最高创作力 > 另两项之和`, value: w.dominant.bonus });
  if (creMax >= w.peak.threshold)
    p1.push({ label: `${w.peak.label}：任一创作力 ≥${w.peak.threshold}`, value: w.peak.bonus });

  /* 维度 2 功力分 */
  const bas = [n('bi'), n('xue'), n('si')];
  const basSum = bas[0] + bas[1] + bas[2];
  const gg = D.gongli;
  const basEff = taper(basSum, gg.soft, gg.softRate);
  const p2 = [{
    label: basEff < basSum
      ? `(笔${bas[0]}＋学${bas[1]}＋思${bas[2]}) × ${gg.mult}（逾 ${gg.soft} 之数半计）`
      : `(笔${bas[0]}＋学${bas[1]}＋思${bas[2]}) × ${gg.mult}`,
    value: Math.round(basEff * gg.mult)
  }];
  if (Math.max(...bas) - Math.min(...bas) <= gg.balance.maxRange)
    p2.push({ label: `${gg.balance.label}：三项极差 ≤${gg.balance.maxRange}`, value: gg.balance.bonus });
  if (Math.max(...bas) >= gg.peak.threshold)
    p2.push({ label: `${gg.peak.label}：单项 ≥${gg.peak.threshold}`, value: gg.peak.bonus });

  /* 维度 3 战绩分（Round 3：胜场超额半计 + 连胜封顶，收敛长尾） */
  const z = D.zhanji;
  const p3 = [];
  const winFull = Math.max(0, num(z.winFull, 99));
  const winHalfMult = Math.round(z.win / 2);
  if (b.win) {
    const nFull = Math.min(b.win, winFull);
    const nHalf = Math.max(0, b.win - winFull);
    p3.push({ label: `胜 ${nFull} 场 × ${z.win}`, value: nFull * z.win });
    if (nHalf) p3.push({ label: `超额胜 ${nHalf} 场 × ${winHalfMult}（战绩递减）`, value: nHalf * winHalfMult });
  }
  if (b.draw) p3.push({ label: `平 ${b.draw} 场 × ${z.draw}`, value: b.draw * z.draw });
  if (b.loss) p3.push({ label: `负 ${b.loss} 场 × ${z.loss}`, value: b.loss * z.loss });
  if (b.maxStreak) {
    const st = Math.min(b.maxStreak, Math.max(1, num(z.streakCap, 99)));
    p3.push({
      label: `最高连胜 ${st} × ${z.streak}${st < b.maxStreak ? `（封顶 ${z.streakCap}，实录 ${b.maxStreak}）` : ''}`,
      value: st * z.streak
    });
  }
  if (b.upsets) p3.push({ label: `以弱胜强 ${b.upsets} 场 × ${z.upset}`, value: b.upsets * z.upset });
  const wbs = b.winsByStyle || {};
  if (CREATIVE_KEYS.every(k => (wbs[k] || 0) >= z.allStyles.minWins))
    p3.push({ label: `${z.allStyles.label}：三种文体各胜 ≥${z.allStyles.minWins}`, value: z.allStyles.bonus });
  if (!p3.length) p3.push({ label: '未有战绩', value: 0 });

  /* 维度 4 奇遇分 */
  const q = D.qiyu;
  const p4 = [];
  if (e.total) p4.push({ label: `触发事件 ${e.total} 次 × ${q.event}`, value: e.total * q.event });
  if (e.rare) p4.push({ label: `稀有 ${e.rare} 张 × ${q.rare}`, value: e.rare * q.rare });
  if (e.legend) p4.push({ label: `传说 ${e.legend} 张 × ${q.legend}`, value: e.legend * q.legend });
  if (e.talents) p4.push({ label: `文心 ${e.talents} 枚 × ${q.talent}`, value: e.talents * q.talent });
  if (e.items) p4.push({ label: `道具 ${e.items} 件 × ${q.item}`, value: e.items * q.item });
  if (!p4.length) p4.push({ label: '未有奇遇', value: 0 });

  /* 维度 5 流派分（取最高一档，不叠加） */
  const lp = D.liupai;
  const p5 = [];
  let best = { value: 0, label: '未成宗派' };
  CREATIVE_KEYS.forEach((k, i) => {
    const others = creSum - cre[i];
    if (cre[i] > others && cre[i] >= lp.specialist.minAttr && (wbs[k] || 0) >= lp.specialist.minWins) {
      if (lp.specialist.bonus > best.value) {
        best = { value: lp.specialist.bonus,
          label: `${lp.names[k]}：${ATTR_NAMES[k]}${cre[i]} > 另两项之和，且 ≥${lp.specialist.minAttr}、${STYLE_NAMES[k]}胜 ≥${lp.specialist.minWins}` };
      }
    }
  });
  if (cre.every(v => v >= lp.sanjue.threshold) && lp.sanjue.bonus > best.value)
    best = { value: lp.sanjue.bonus, label: `${lp.sanjue.label}：诗词联均 ≥${lp.sanjue.threshold}` };
  p5.push({ label: best.label, value: best.value });

  /* 维度 6 圆满分 */
  const y = D.yuanman;
  const p6 = [];
  if (f.reached) p6.push({ label: '抵达终点·金殿对策', value: y.reach });
  if (f.inspirationLeft) p6.push({ label: `剩余灵感 ${f.inspirationLeft} × ${y.perInspiration}`, value: f.inspirationLeft * y.perInspiration });
  if (f.reached && f.turns > 0 && f.turns <= y.swift.maxTurns)
    p6.push({ label: `${y.swift.label}：${f.turns} 回合抵达 ≤${y.swift.maxTurns}`, value: y.swift.bonus });
  else if (f.reached && f.turns > 0 && f.turns <= y.steady.maxTurns && f.inspirationLeft >= y.steady.minInspiration)
    p6.push({ label: `${y.steady.label}：≤${y.steady.maxTurns} 回合且灵感 ≥${y.steady.minInspiration}`, value: y.steady.bonus });
  if (f.palaceSweep) p6.push({ label: '金榜题名：殿试三连胜', value: y.palaceSweep });
  if (!p6.length) p6.push({ label: '中道封笔，圆满无从谈起', value: 0 });

  const dims = [
    { key: 'wencai', name: D.wencai.name, parts: p1 },
    { key: 'gongli', name: D.gongli.name, parts: p2 },
    { key: 'zhanji', name: D.zhanji.name, parts: p3 },
    { key: 'qiyu', name: D.qiyu.name, parts: p4 },
    { key: 'liupai', name: D.liupai.name, parts: p5 },
    { key: 'yuanman', name: D.yuanman.name, parts: p6 }
  ].map(d => ({ ...d, score: d.parts.reduce((s, p) => s + p.value, 0) }));

  const total = dims.reduce((s, d) => s + d.score, 0);
  const topDim = dims.reduce((m, d) => (d.score > m.score ? d : m), dims[0]);

  return {
    dims, total,
    grade: gradeOf(total, cfg.tiers),
    topDim: topDim.key,
    comment: (cfg.comments || {})[topDim.key] || ''
  };
}

/** 按分数取品级档位 */
export function gradeOf(total, tiers) {
  const list = tiers && tiers.length ? tiers : DEFAULT_GRADES.tiers;
  for (const t of list) {
    if (total >= t.min && total <= t.max) return { ...t };
  }
  return total < list[0].min ? { ...list[0] } : { ...list[list.length - 1] };
}

/* ============================ 抽取与权重 ============================ */

export const RARITY_WEIGHT = { common: 0.70, rare: 0.22, legend: 0.08 };

/** 按稀有度权重抽事件（同局去重由调用方传入已过滤的池） */
export function pickByRarity(pool, rand) {
  if (!pool.length) return null;
  const r = rand();
  const buckets = { common: [], rare: [], legend: [] };
  for (const e of pool) (buckets[e.rarity] || buckets.common).push(e);
  const order = r < RARITY_WEIGHT.legend ? ['legend', 'rare', 'common']
    : r < RARITY_WEIGHT.legend + RARITY_WEIGHT.rare ? ['rare', 'common', 'legend']
      : ['common', 'rare', 'legend'];
  for (const k of order) if (buckets[k].length) return buckets[k][Math.floor(rand() * buckets[k].length)];
  return pool[0];
}

/** 难度权重：乡试圈 1–2 星为主，会试圈 2–3 星为主，殿试 3 星 */
export function difficultyWeights(phase) {
  if (phase === 'palace') return { 1: 0.05, 2: 0.25, 3: 0.70 };
  if (phase === 'lap2') return { 1: 0.15, 2: 0.55, 3: 0.30 };
  return { 1: 0.50, 2: 0.40, 3: 0.10 };
}

/** 按难度权重抽题；某难度缺题时自动放宽到相邻难度 */
export function pickQuestion(pool, phase, rand) {
  if (!pool.length) return null;
  const w = difficultyWeights(phase);
  const r = rand();
  let acc = 0, want = 1;
  for (const d of [1, 2, 3]) { acc += w[d]; if (r <= acc) { want = d; break; } }
  for (const d of [want, want - 1, want + 1, want - 2, want + 2]) {
    const sub = pool.filter(q => Number(q.difficulty) === d);
    if (sub.length) return sub[Math.floor(rand() * sub.length)];
  }
  return pool[Math.floor(rand() * pool.length)];
}

/* ============================ 小工具 ============================ */

export function num(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }
export function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function deepMerge(base, over) {
  for (const k of Object.keys(over || {})) {
    const v = over[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      deepMerge(base[k], v);
    } else if (v !== undefined && v !== null) {
      base[k] = v;
    }
  }
  return base;
}
