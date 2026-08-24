/**
 * rules.js —— 纯函数规则层（无 DOM 依赖，可被 selftest.html 直接复用）
 *
 * 唯一战斗公式（方案 B）：
 *   得分 = 三体平均×7 + 本场文体×3 + (笔力+学力+思力)×4 + 灵感骰 + 修正项
 *   平局：双方差 ≤ 高分方的 5%
 *
 * 六维评分公式见全案 3.8。系数由 config/grades.json 提供，
 * 本模块内置 DEFAULT_GRADES 作为缺省与兜底（配置缺字段时逐项回填）。
 */

import { DEFAULT_GRADES, normalizeGrades } from './grade-config.js';
export { DEFAULT_GRADES, adaptGradesConfig, normalizeGrades } from './grade-config.js';

export const ATTR_KEYS = ['shi', 'ci', 'lian', 'bi', 'xue', 'si'];
export const ATTR_NAMES = {
  shi: '诗力', ci: '词力', lian: '联力', bi: '笔力', xue: '学力', si: '思力'
};
export const CREATIVE_KEYS = ['shi', 'ci', 'lian'];   // 创作力（金）
export const BASIC_KEYS = ['bi', 'xue', 'si'];        // 基本功（青）
export const STYLE_NAMES = { shi: '诗', ci: '词', lian: '联' };

/* ============================ 战斗公式 ============================ */

export const BATTLE_COEF = {
  styleCommonMult: 7,     // 三体共通功底
  styleSpecialtyMult: 3,  // 本场文体专精
  styleMult: 3,           // 兼容旧 UI/脚本；新代码应使用上面两项
  basicMult: 4,
  biMult: 4,
  xueMult: 4,
  siMult: 4,
  diceMult: 5,     // 兼容旧 NPC / 旧调用：普通骰的传统固定分值系数
  dicePct: 0.05,   // 普通灵感骰：每点进入作品乘区 +5%（玩家与 NPC 共用）
  drawRatio: 0.05  // 平局带
};

/** 合并可选配置系数；旧调用不传 coef 时使用方案 B 默认值。 */
export function battleCoef(raw) {
  const c = raw || {};
  const common = num(c.styleCommonMult, BATTLE_COEF.styleCommonMult);
  const specialty = num(c.styleSpecialtyMult, BATTLE_COEF.styleSpecialtyMult);
  const basic = num(c.basicMult, BATTLE_COEF.basicMult);
  return {
    ...BATTLE_COEF,
    ...c,
    styleCommonMult: common,
    styleSpecialtyMult: specialty,
    styleMult: specialty,
    basicMult: basic,
    biMult: basic,
    xueMult: basic,
    siMult: basic
  };
}

/** 文体格律底盘：共通功底 + 本体专精。 */
export function styleBaseScore(attrs, style, coef) {
  const a = attrs || {};
  const c = battleCoef(coef);
  const creative = CREATIVE_KEYS.map(k => Math.max(0, Number(a[k]) || 0));
  const mean = creative.reduce((sum, v) => sum + v, 0) / creative.length;
  const selected = Math.max(0, Number(a[style]) || 0);
  return {
    mean,
    selected,
    common: mean * c.styleCommonMult,
    specialty: selected * c.styleSpecialtyMult,
    total: Math.round(mean * c.styleCommonMult + selected * c.styleSpecialtyMult)
  };
}

/**
 * 文体骰面结构。只读取已经掷出的骰点，不读取概率、未来随机数或对手信息。
 * `score` 保留旧版固定分供 NPC/兼容调用，`pct` 是本场骰组最终应进入作品的乘区。
 */
export function styleDiceScore(style, pips, styleCfg, diceMult = BATTLE_COEF.diceMult, dicePlus = 0, dicePct = BATTLE_COEF.dicePct) {
  const list = (Array.isArray(pips) ? pips : [pips]).map(v => Math.max(1, Number(v) || 1));
  const cfg = (styleCfg && styleCfg[style]) || {};
  const dm = num(diceMult, BATTLE_COEF.diceMult);
  const dp = Math.max(0, num(dicePct, BATTLE_COEF.dicePct));
  // 旧版“骰倍率”文心继续保留语义：在新乘区规则下，按相对倍率缩放本场骰乘区。
  const diceRateMult = dm / BATTLE_COEF.diceMult;
  if (style === 'shi' && list.length === 1) {
    const pip = list[0] + num(dicePlus, 0);
    const high = pip >= num(cfg.highMin, 4);
    const mult = high ? num(cfg.highMult, 1.5) : num(cfg.lowMult, 0.7);
    return {
      score: Math.round(pip * dm * mult),
      pct: pip * dp * diceRateMult * mult,
      pips: pip,
      detail: `诗·一气 ${pip} 点 × ${dm} × ${mult}`,
      pctDetail: `诗·一气 ${pip} 点 × ${Math.round(dp * diceRateMult * 100)}% × ${mult}`
    };
  }
  if (style === 'ci') {
    const floor = num(cfg.pipFloor, 3), ceil = num(cfg.pipCeil, 5);
    const first = clamp(list[0] + num(dicePlus, 0), floor, ceil);
    const total = first + list.slice(1).reduce((s, v) => s + v, 0);
    return {
      score: Math.round(total * dm),
      pct: total * dp * diceRateMult,
      pips: total,
      detail: `词·铺陈 ${list[0]}→${first}，合计 ${total} 点 × ${dm}`,
      pctDetail: `词·铺陈 ${list[0]}→${first}，合计 ${total} 点 × ${Math.round(dp * diceRateMult * 100)}%`
    };
  }
  const total = list.reduce((s, v) => s + v, 0) + num(dicePlus, 0);
  return {
    score: Math.round(total * dm),
    pct: total * dp * diceRateMult,
    pips: total,
    detail: `${total} 点 × ${dm}${style === 'lian' ? '（联·对举）' : ''}`,
    pctDetail: `${total} 点 × ${Math.round(dp * diceRateMult * 100)}%${style === 'lian' ? '（联·对举）' : ''}`
  };
}

/**
 * 计算一方的作品得分，逐项返回明细（供 UI 五项弹出累加）。
 * @param {object} input
 *  - attrs      六维 {shi,ci,lian,bi,xue,si}
 *  - style      出战文体 'shi'|'ci'|'lian'
 *  - dice       1d6 点数（1–6）
 *  - diceMult   旧版固定骰系数，默认 5；仅在未传 dicePct 时使用
 *  - dicePct    本场普通骰的有效乘区（由 styleDiceScore.pct 传入；如 0.30 = +30%），传入后不再产生固定骰分
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
  const coef = battleCoef(input.coef);
  const styleAttr = g(input.style);

  const dMult = num(input.diceMult, BATTLE_COEF.diceMult);
  const hasDicePct = input.dicePct !== undefined && input.dicePct !== null;
  const dPct = Math.max(0, num(input.dicePct, BATTLE_COEF.dicePct));
  const dPlus = num(input.dicePlus, 0);
  const critMult = num(input.critMult, 1);
  const pctMods = input.pctMods || [];
  const flatMods = input.flatMods || [];

  const styleBase = styleBaseScore(a, input.style, coef);
  const gelv = styleBase.total;
  const yixiang = g('bi') * coef.basicMult + g('xue') * coef.basicMult;
  const liyi = g('si') * coef.basicMult;

  const hasFixed = input.diceFixed !== undefined && input.diceFixed !== null;
  const dicePips = clamp(num(input.dice, 1) + dPlus, 1, 99);
  const hasOverride = input.diceScore !== undefined && input.diceScore !== null;
  const diceScore = hasFixed ? Number(input.diceFixed) : hasOverride ? Number(input.diceScore) : hasDicePct ? 0 : dicePips * dMult;

  const coreBase = gelv + yixiang + liyi;
  // 普通骰进入独立乘区：先作用于三项创作底盘，再叠加其他百分比修正。
  // 这样属性成长后骰子不会退化为固定的几分，同时固定骰/旧调用仍保持兼容。
  const diceContribution = hasFixed || hasOverride ? diceScore : hasDicePct ? Math.round(coreBase * dPct) : diceScore;
  const effectiveDicePct = hasFixed || hasOverride ? 0 : hasDicePct ? dPct : 0;
  const base = coreBase + diceContribution;

  // 先加后乘：所有百分比先求和，再一次性作用于 base
  const pctSum = pctMods.reduce((s, m) => s + (Number(m.value) || 0), 0);
  const flatSum = flatMods.reduce((s, m) => s + (Number(m.value) || 0), 0);
  const modScore = Math.round(base * pctSum) + flatSum;

  const total = Math.round((base + modScore) * critMult);

  const items = [
    { key: 'gelv', label: '格律分', value: gelv,
      detail: `三体均值 ${styleBase.mean.toFixed(1)} × ${coef.styleCommonMult} ＋ ${ATTR_NAMES[input.style] || input.style} ${styleAttr} × ${coef.styleSpecialtyMult}` },
    { key: 'yixiang', label: '意象分', value: yixiang,
      detail: `笔力 ${g('bi')} × ${coef.basicMult} ＋ 学力 ${g('xue')} × ${coef.basicMult}` },
    { key: 'liyi', label: '立意分', value: liyi,
      detail: `思力 ${g('si')} × ${coef.basicMult}` },
    { key: 'dice', label: '灵感骰', value: diceContribution,
      detail: hasFixed ? `固定发挥 ${input.diceFixed}`
                       : hasOverride ? (input.diceDetail || `文体结构结算 ${diceScore}`)
                       : hasDicePct ? `${input.dicePctDetail || `掷出 ${dicePips} 点`} → 乘区 +${Math.round(dPct * 100)}%，实际 +${diceContribution} 分`
                       : `掷出 ${dicePips} 点 × ${dMult}${dPlus ? `（含骰点 +${dPlus}）` : ''}` },
    { key: 'mods', label: '修正项', value: modScore,
      detail: describeMods(pctMods, flatMods, critMult) }
  ];

  return {
    items, base, modScore, total, dicePips, diceScore: diceContribution,
    breakdown: { gelv, styleMean: styleBase.mean, styleCommon: styleBase.common, styleSpecialty: styleBase.specialty,
      yixiang, liyi, diceScore: diceContribution, diceContribution, dicePct: effectiveDicePct,
      coreBase, modScore, critMult, pctSum, flatSum }
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
export function expectedScore(attrs, style, coef) {
  return battleScore({ attrs, style, dice: 3.5, coef }).total;
}

/** NPC 自动选文体：取期望分最高者（联力 <8 同样受限） */
export function pickNpcStyle(attrs, lianUnlocked, coef) {
  const cands = CREATIVE_KEYS.filter(s => s !== 'lian' || lianUnlocked || (attrs.lian || 0) >= 8);
  let best = cands[0], bestV = -1;
  for (const s of cands) {
    const v = expectedScore(attrs, s, coef);
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

/* ====================== 具名 NPC 出战权重 ======================
 * 每个具名 NPC 可配 `weight`（出战权重，正整数）。同一档内其被抽中的概率正比于 weight / Σweight。
 *  - weight 省略 / 非法 → 视为默认权重 100。
 *  - weight === 0 → 该阶段不出战（skip）。
 * 纯函数，本模块自测友好，供 game.pickNpc（普通战）与殿试抽取共用。
 */
export const NPC_DEFAULT_WEIGHT = 100;
export function npcWeight(n) {
  const w = Number(n && n.weight);
  return Number.isFinite(w) && w >= 0 ? w : NPC_DEFAULT_WEIGHT;
}

/** 按权重从候选池抽一枚；返回 entry 本身（null 当池为空或全部 weight=0）。 */
export function pickNpcByWeight(pool, rand) {
  if (!pool || !pool.length) return null;
  let total = 0;
  for (const x of pool) total += npcWeight(x);
  if (!(total > 0)) return null;
  let r = rand() * total, acc = 0;
  for (const x of pool) {
    acc += npcWeight(x);
    if (r < acc) return x;
  }
  return pool[pool.length - 1];
}

/** 按权重不重复抽取 count 枚（洗带权，逐次剔除已选，防止殿试撞同名）。池有效项不足时按实际返；全为 weight=0 返回 count 个空位。 */
export function pickNpcByWeightUnique(pool, count, rand) {
  const out = [];
  if (!pool || !pool.length || !(count > 0)) return out;
  const remaining = pool.slice();
  for (let i = 0; i < count; i++) {
    const p = remaining.filter(x => npcWeight(x) > 0);
    if (!p.length) { out.push(null); continue; }
    const pick = pickNpcByWeight(p, rand);
    if (!pick) { out.push(null); continue; }
    out.push(pick);
    remaining.splice(remaining.indexOf(pick), 1);
  }
  return out;
}

/* ====================== NPC 三机制纯函数（招牌/破绽/意图） ======================
 *
 * 约定（与 stage-02/03/05 对齐）：
 *  - 意图在 createSession 时「锁定」一次并存入 session，结算阶段只消费、不改写（E0）。
 *  - 破绽先于招牌结算（F0）：先判玩家是否命中破绽 → 得到招牌保留比例 retention →
 *    再按保留比例结算招牌对 NPC 得分的修正。
 *  - 所有数值来自 config/npc-mechanics.json 模板 + npcs.json 的 mech 引用；缺失/非法一律
 *    走「无机制」旧行为兜底，绝不抛错阻断对局。
 *  - 三枚举键：ATTR_KEYS / CREATIVE_KEYS / STYLE_NAMES 见本模块顶部。
 */

/**
 * 抽取 NPC 出战文体：在「签名偏置」与「合理性底线」之间取平衡。
 * 签名偏置把目标文体权重显著抬高；但若目标文体期望分低于最优候选的 bottom（如 0.85）,
 * 说明偏置会让 NPC 自残送分，则回退到期望分最优者（低阶教学 NPC 传更高 bottom 更保守）。
 * @param {object} npcAttrs  六维
 * @param {object} tpl       意图模板（含 signatureBias / bottom）
 * @param {number} biasMult  签名偏置倍率（npcs.json mech.intent.bias）
 * @returns {string} 'shi'|'ci'|'lian'
 */
export function pickIntentionStyle(npcAttrs, tpl, biasMult) {
  const bias = num(biasMult, 1);
  const bottom = num(tpl && tpl.bottom, 0.78);
  const biasStyle = tpl && tpl.signatureBias && tpl.signatureBias.style;
  const cands = CREATIVE_KEYS.filter(s => s !== 'lian' || (npcAttrs.lian || 0) >= 8);
  const scores = {};
  for (const s of cands) scores[s] = expectedScore(npcAttrs, s);
  const best = cands.reduce((a, b) => (scores[b] > scores[a] ? b : a), cands[0]);
  // 目标文体落入底线 → 回退最优（不送分、不自残）
  if (biasStyle && cands.includes(biasStyle) && scores[biasStyle] >= scores[best] * bottom) return biasStyle;
  return best;
}

/**
 * 生成（并锁定）NPC 本场意图。返回 { style, manner, styleDisclosed, mannerDisclosed, template }。
 * - style：按签名偏置抽取的文体；
 * - manner：对文风立意型（int_manner_theme）按模板候选＋相性选最佳；其余用题材相性最优。
 * - 意图锁定即冻结于此，后续结算不得改变（E0）。
 * @param {object} opt { mech, npcAttrs, af, theme, manners }
 */
export function rollIntention(opt) {
  const raw = opt && opt.mech;
  const mech = (raw && raw.mech) ? raw.mech : (raw || {});
  const af = opt.af || {};
  const theme = opt.theme;
  const manners = opt.manners || af.manners || ['wanyue', 'haofang', 'zheli'];
  const intent = (mech && mech.intent) || {};
  const tpl = intent.template ? ((opt.templates || {}).intentTemplates || {})[intent.template] : null;
  const zeitgeist = opt.zeitgeist || null;

  // 文体（无签名偏置时退化为纯期望分最优）
  const style = pickIntentionStyle(opt.npcAttrs || {}, tpl, intent.bias);

  // 文风：立意型从候选中取最优；逐潮型优先跟随本局公开风潮；其余取题材相性最优。
  let manner;
  if (tpl && tpl.type === 'zeitgeist' && zeitgeist && manners.includes(zeitgeist.manner)) {
    manner = zeitgeist.manner;
  } else if (tpl && tpl.type === 'manner') {
    const cands = Array.isArray(intent.manners) ? intent.manners.filter(m => manners.includes(m)) : manners;
    if (cands.length) {
      let vm = -Infinity;
      for (const m of cands) { const v = affinityValue(af.matrix, m, theme); if (v > vm) { vm = v; manner = m; } }
    }
    if (!manner) manner = pickNpcManner(af.matrix, manners, theme);
  } else {
    manner = pickNpcManner(af.matrix, manners, theme);
  }

  // 披露层级：模板声明或默认（教学型默认行动明确）
  const disclosure = (tpl && tpl.disclosure) || 'action';
  return {
    style, manner,
    styleDisclosed: disclosure === 'full' || disclosure === 'action',
    mannerDisclosed: disclosure === 'full' || tpl?.type === 'manner',
    template: intent.template || 'int_preferred_style',
    // 公开战策/审律目标是意图的一部分，须在玩家定策前锁定并展示。
    stance: tpl?.type === 'stance' ? (intent.stance || tpl.stance || null) : null,
    pattern: tpl?.type === 'pattern' ? (intent.pattern || tpl.pattern || null) : null,
    watchesActive: tpl?.type === 'active_watch'
  };
}

/** 骰组是否命中 NPC 在战前公开的审律目标。仅读取已掷出的结果，不改变随机性。 */
function matchesDicePattern(pips, pattern) {
  const list = Array.isArray(pips) ? pips.map(v => Number(v) || 0) : [];
  if (!list.length) return false;
  if (pattern === 'pair') return new Set(list).size < list.length;
  if (pattern === 'sequence') {
    if (list.length < 2) return false;
    const sorted = [...list].sort((a, b) => a - b);
    return sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
  }
  if (pattern === 'high') return list.reduce((sum, v) => sum + v, 0) >= (Number(list.length) * 5);
  return false;
}

/**
 * 判定招牌是否触发。返回 { level:'main'|'weak'|null, key, reason }。
 * 触发规则来自模板 trigger + npcs.json mech.signature 的参数化。
 * @param {object} ctx {
 *   mech, templates, npcStyle(锁定意图文体), npcManner,
 *   playerMove:{ style, manner, extraDice },
 *   playerHistory:{ lastStyle },       // 本场上一场文体（无历史为空）
 *   palaceAdapt:{ layers }             // 跨场适应层数
 * }
 */
export function signatureTriggered(ctx) {
  const raw = ctx && ctx.mech;
  const mech = (raw && raw.mech) ? raw.mech : (raw || {});   // 兼容传 npc 对象(内含.mech)或直接传 mech 对象
  if (!mech || Object.keys(mech).length === 0) return { level: null };
  const main = mech.signature && mech.signature.main ? mech.signature.main : mech.signature;
  const weak = mech.signature && mech.signature.main ? mech.signature.weak : null;
  const tmplLib = (ctx.templates || {}).signatureTemplates || {};
  const pm = ctx.playerMove || {};
  const hist = ctx.playerHistory || {};
  const npcStyle = ctx.npcStyle;
  const npcManner = ctx.npcManner;

  const hitOne = (sig, npcStyle, npcManner, templates) => {
    if (!sig || !sig.template) return null;
    const tpl = templates[sig.template];
    if (!tpl) return null;
    if (sig.template === 'sig_style_mastery') {
      return sig.style === npcStyle ? { level: 'main' } : null;
    }
    if (sig.template === 'sig_repeat_read') {
      if (!hist.lastStyle) return null;                      // 首场无历史不触发
      return pm.style === hist.lastStyle ? { level: 'main' } : null;
    }
    if (sig.template === 'sig_dice_response') {
      return (pm.extraDice || 0) >= 1 ? { level: 'main' } : null;
    }
    if (sig.template === 'sig_copycat') {
      if (!hist.habitualStyle) return null;
      return pm.style === hist.habitualStyle ? { level: 'main' } : null;
    }
    if (sig.template === 'sig_debt_drain') {
      // 文债耗神在战后结算（见 weaknessResolution / settle 侧），此处反馈 main 供计算原值
      return { level: 'main' };
    }
    if (sig.template === 'sig_steady_pressure') {
      return { level: 'main' };                               // 常态化下限
    }
    if (sig.template === 'sig_manner_theme') {
      const ms = sig.manners || [];
      return ms.includes(npcManner) ? { level: 'main' } : null;
    }
    if (sig.template === 'sig_palace_adapt') {
      return true ? { level: 'main' } : null;                 // 跨场适应：每场常驻（防御性）
    }
    if (sig.template === 'sig_zeitgeist_surf') {
      return ctx.zeitgeist && npcManner === ctx.zeitgeist.manner ? { level: 'main' } : null;
    }
    if (sig.template === 'sig_active_talent_tax') {
      return pm.activeTalentUsed ? { level: 'main' } : null;
    }
    if (sig.template === 'sig_dice_pattern_hunt') {
      return matchesDicePattern(pm.dicePips, sig.pattern) ? { level: 'main' } : null;
    }
    if (sig.template === 'sig_declared_stance') {
      return ctx.intentStance ? { level: 'main' } : null;
    }
    return null;
  };

  const mainHit = hitOne(main, npcStyle, npcManner, tmplLib);
  if (mainHit) return { ...mainHit, key: main.name || '主招牌' };
  // 弱副招牌：仅当举人以上（由 mech 结构决定是否配置），独立判
  if (weak) {
    const weakHit = hitOne(weak, npcStyle, npcManner, tmplLib);
    if (weakHit) return { level: 'weak', key: weak.name || '副招牌' };
  }
  return { level: null };
}

/**
 * 破绽判定（先于招牌结算）。返回 {
 *   hit,                     // 是否命中任一破绽路径
 *   retention,               // 招牌保留比例（1 = 全额保留；0 = 完全关闭；中间=削弱）
 *   shutdownLevel,           // 'full'|'partial'|'none'
 *   playerBonus,             // 额外玩家加分比例（0 为无）
 *   refundInsp,              // 返还灵感点数
 *   infoBonus,               // 意图信息精度提升层级
 *   extraInspCost,           // 文债耗神导致的额外灵感扣除（负数）
 *   reason
 * }
 * @param {object} ctx { mech, templates, npcStyle, playerMove, playerHistory, result, relativeMargin }
 */
/**
 * 殿试跨场适应阻尼：把「破绽收益」按已叠加的适应层数递减，但保留至少一半。
 * - benefitMult = max(minWeaknessRetention, 1 - weaknessDampen * layers)
 * - 作用在「破绽压制量」(1 - retention) 与玩家额外加分 playerBonus 上；
 *   retention 越小（压制越狠=收益越大）被削弱越多，逼近 1（不压制）时几乎无损。
 * 仅当 layers>0 且有阻尼参数时生效；非命中破绽（retention=1, playerBonus=0）原样返回。
 * @param {object} r weaknessResolution 的命中结果
 * @param {object|null} pa { layers, weaknessDampen, minWeaknessRetention }
 */
function applyPalaceDampen(r, pa) {
  if (!r || !pa) return r;
  const layers = Number(pa.layers) || 0;
  if (layers <= 0) return r;
  const dampen = Number(pa.weaknessDampen) || 0;
  const minRet = Number(pa.minWeaknessRetention) || 0;
  if (dampen <= 0 && minRet <= 0) return r;
  const benefitMult = clamp(Math.max(minRet, 1 - dampen * layers), 0, 1);
  const shutdown = 1 - (r.retention ?? 1);
  const effShutdown = clamp(shutdown * benefitMult, 0, 1);
  const effRet = 1 - effShutdown;
  const effBonus = (r.playerBonus || 0) * benefitMult;
  let level = 'none';
  if (effShutdown > 0.001) level = effRet <= 0.3 ? 'full' : 'partial';
  return { ...r, retention: effRet, playerBonus: effBonus, shutdownLevel: level };
}

/**
 * 合并多个破绽判定结果（NPC 可配置多个 weakness 时）。
 * - hit：任一命中即为命中
 * - retention：取最强压制（最小 retention）
 * - playerBonus / extraInspCost / flatPenalty：累加
 * - layerReduce / refundInsp / infoBonus：取较大值
 * - cancelAlt：任一置位即为真
 */
function mergeWeakness(a, b) {
  const retention = Math.min(a.retention ?? 1, b.retention ?? 1);
  const shutdownLevel = retention <= 0.3 ? 'full' : (retention < 1 ? 'partial' : 'none');
  const template = (a.template && b.template && a.template !== b.template) ? (a.template + '+' + b.template) : (a.template || b.template);
  return {
    hit: a.hit || b.hit,
    retention,
    shutdownLevel,
    playerBonus: (a.playerBonus || 0) + (b.playerBonus || 0),
    refundInsp: Math.max(a.refundInsp || 0, b.refundInsp || 0),
    extraInspCost: (a.extraInspCost || 0) + (b.extraInspCost || 0),
    flatPenalty: (a.flatPenalty || 0) + (b.flatPenalty || 0),
    infoBonus: Math.max(a.infoBonus || 0, b.infoBonus || 0),
    cancelAlt: !!(a.cancelAlt || b.cancelAlt),
    layerReduce: Math.max(a.layerReduce || 0, b.layerReduce || 0),
    template
  };
}

/** 单个破绽模板的判定（不含殿试跨场适应阻尼，阻尼在合并后统一施加） */
function resolveSingleWeakness(ctx, wea, tmplLib, pm, hist, npcStyle) {
  const nullR = { hit: false, retention: 1, shutdownLevel: 'none', playerBonus: 0, refundInsp: 0, infoBonus: 0, extraInspCost: 0 };
  const fullRet = () => clamp(Number(wea.retention ?? 0), 0, 1);
  const out = (extra) => ({ ...nullR, ...extra, template: wea.template });

  switch (wea.template) {
    case 'wea_use_other_style': {
      const fullClose = (wea.fullClose && wea.fullClose.includes('*')) || (Array.isArray(wea.fullClose) && wea.fullClose.includes(pm.style)) || (wea.fullClose === '*' && pm.style !== npcStyle);
      const pr = wea.partialReduction;
      const inPartial = pr && pr.style && Array.isArray(pr.style) && pr.style.includes(pm.style);
      if (pm.style && pm.style !== npcStyle) {
        if (fullClose) return out({ hit: true, retention: 0, shutdownLevel: 'full', reason: '改用他体' });
        if (inPartial) {
          const retention = clamp(Number(pr.retention ?? 0.5), 0, 1);
          return out({ hit: true, retention, shutdownLevel: retention <= 0.3 ? 'full' : 'partial', reason: '部分削弱' });
        }
        return out({ hit: true, retention: 0, shutdownLevel: 'full', reason: '改用他体' });
      }
      return nullR;
    }
    case 'wea_switch_style': {
      if (hist.lastStyle && pm.style && pm.style !== hist.lastStyle) {
        return out({ hit: true, retention: 0, shutdownLevel: 'full', infoBonus: wea.infoBonus ? Number(wea.infoBonus.intentPrecision) || 0 : 0 });
      }
      if (!hist.lastStyle) return out({ hit: true, retention: 1, shutdownLevel: 'partial', reason: '无历史，仅提升信息' });
      return nullR;
    }
    case 'wea_base_dice_only': {
      if ((pm.extraDice || 0) === 0) {
        const flat = Number(wea.flat) || 0;
        return out({ hit: true, retention: 0, shutdownLevel: 'full', extraInspCost: 0, flatPenalty: -flat });
      }
      return nullR;
    }
    case 'wea_style_manner_combo': {
      const ms = wea.manners || [];
      // style 缺省或为 'any' 时，不限定文体（仅按文风判定），便于主考官配置「跨文体定势」破绽
      const styleOk = !wea.style || wea.style === 'any' || wea.style === pm.style;
      if (styleOk && ms.includes(pm.manner)) {
        const ret = fullRet();
        return out({ hit: true, retention: ret, shutdownLevel: ret <= 0.3 ? 'full' : 'partial', playerBonus: Number(wea.playerBonus) || 0 });
      }
      return nullR;
    }
    case 'wea_crushing_win': {
      if (ctx.result === 'win' && ctx.relativeMargin != null && ctx.relativeMargin >= (Number(wea.threshold) || 0)) {
        return out({ hit: true, retention: 0, shutdownLevel: 'full', refundInsp: Number(wea.refund) || 0 });
      }
      return nullR;
    }
    case 'wea_harmonious_manner': {
      const ms = wea.manners || [];
      if (ms.includes(pm.manner)) {
        const ret = fullRet();
        return out({ hit: true, retention: ret, shutdownLevel: ret <= 0.3 ? 'full' : 'partial' });
      }
      return nullR;
    }
    case 'wea_counter_intent': {
      if (pm.matchesIntent === true) {
        const ret = fullRet();
        return out({ hit: true, retention: ret, shutdownLevel: ret >= 1 ? 'none' : 'partial', cancelAlt: true });
      }
      return nullR;
    }
    case 'wea_cross_battle_shift': {
      if (ctx.strategyChanged) {
        return out({ hit: true, retention: 1, shutdownLevel: 'partial', layerReduce: Number(wea.layerReduce) || 1 });
      }
      return nullR;
    }
    case 'wea_go_against_zeitgeist': {
      const z = ctx.zeitgeist;
      const minAffinity = Number(wea.minAffinity ?? 0);
      if (z && pm.manner && pm.manner !== z.manner && Number(pm.playerAffinity) >= minAffinity) {
        const ret = fullRet();
        return out({ hit: true, retention: ret, shutdownLevel: ret <= 0.3 ? 'full' : 'partial', playerBonus: Number(wea.playerBonus) || 0, reason: '逆潮而作，仍合题意' });
      }
      return nullR;
    }
    case 'wea_hold_active_talent': {
      if (!pm.activeTalentUsed) {
        const ret = fullRet();
        return out({ hit: true, retention: ret, shutdownLevel: ret <= 0.3 ? 'full' : 'partial', playerBonus: Number(wea.playerBonus) || 0, reason: '藏锋不用主动文心' });
      }
      return nullR;
    }
    case 'wea_limited_extra_dice': {
      if ((pm.extraDice || 0) <= (Number(wea.maxExtraDice) || 0)) {
        const ret = fullRet();
        return out({ hit: true, retention: ret, shutdownLevel: ret <= 0.3 ? 'full' : 'partial', playerBonus: Number(wea.playerBonus) || 0, reason: '收束骰组，未落入审律' });
      }
      return nullR;
    }
    case 'wea_stance_counter': {
      const stance = ctx.intentStance;
      const counter = wea.counter || {};
      const required = counter[stance];
      const hit = required === 'base_dice' ? (pm.extraDice || 0) === 0
        : required === 'one_extra' ? (pm.extraDice || 0) === 1
          : required === 'change_style' ? !!(hist.lastStyle && pm.style && pm.style !== hist.lastStyle)
            : required === 'change_manner' ? !!(hist.lastManner && pm.manner && pm.manner !== hist.lastManner)
              : false;
      if (hit) {
        const ret = fullRet();
        return out({ hit: true, retention: ret, shutdownLevel: ret <= 0.3 ? 'full' : 'partial', playerBonus: Number(wea.playerBonus) || 0, reason: '以相应章法反制其公开战策' });
      }
      return nullR;
    }
    default:
      return nullR;
  }
}

export function weaknessResolution(ctx) {
  const raw = ctx && ctx.mech;
  const mech = (raw && raw.mech) ? raw.mech : (raw || {});
  const nullR = { hit: false, retention: 1, shutdownLevel: 'none', playerBonus: 0, refundInsp: 0, infoBonus: 0, extraInspCost: 0 };
  if (!mech || Object.keys(mech).length === 0) return nullR;
  const tmplLib = (ctx.templates || {}).weaknessTemplates || {};
  const pm = ctx.playerMove || {};
  const hist = ctx.playerHistory || {};
  const npcStyle = ctx.npcStyle;
  // 支持 NPC 配置多个破绽（数组）；单破绽自动包装。殿试主考官即此：换策消层 + 可被利用的破绽并存。
  const weaList = Array.isArray(mech.weakness) ? mech.weakness : (mech.weakness ? [mech.weakness] : []);
  let merged = null;
  for (const wea of weaList) {
    const weaT = tmplLib[wea && wea.template];
    if (!wea || !weaT) continue;
    const one = resolveSingleWeakness(ctx, wea, tmplLib, pm, hist, npcStyle);
    merged = merged ? mergeWeakness(merged, one) : one;
  }
  if (!merged) return nullR;
  // 殿试跨场适应：重复破绽收益按层数递减（sig_palace_adapt 的 weaknessDampen），合并后统一施加
  return applyPalaceDampen(merged, ctx.palaceAdapt);
}

/**
 * 按「招牌触发 + 破绽保留比例」生成对 NPC 得分的最终修正列表。
 * - 破绽先结算：retention 决定招牌生效比例；
 * - 返回对象直接对接调用方（game.js）分发：
 *     pct / flat                    —— 应用于 NPC 得分的修正（招牌按 retention 摊薄）
 *     playerBonusPct                —— 破绽带给玩家的额外加分比例（供玩家侧）
 *     extraInspCost                 —— 破绽代价（文债耗神等，负数则扣灵感）
 *     refundInsp / infoBonus / cancelAlt —— 结果型/信息型/策略型奖励
 * @param {object} tri     signatureTriggered 的结果
 * @param {object} wea     weaknessResolution 的结果
 * @param {object} sig     mech.signature（主/副）
 */
export function signatureScoreMods(tri, wea, sig, ctx) {
  const pct = [], flat = [];
  const main = sig && sig.main ? sig.main : sig;
  const weak = sig && sig.main ? sig.weak : null;
  const ret = wea && wea.hit ? (wea.retention ?? 0) : 1;
  const extraDice = (ctx && ctx.extraDice) || 0;
  const label = (obj) => obj && obj.name || (main && main.name) || '招牌';

  /** 追加骰响应：按 玩家追加骰数 累加递减 flat 分，封顶 cap */
  const diceResponseFlat = (sigObj) => {
    const steps = Array.isArray(sigObj.steps) ? sigObj.steps : [];
    const cap = Number(sigObj.cap) || 0;
    let sum = 0;
    for (let i = 0; i < extraDice; i++) sum += Number(steps[i] !== undefined ? steps[i] : (steps[steps.length - 1] || 0));
    if (cap) sum = Math.min(sum, cap);
    return sum;
  };

  /** 稳稿压迫：floor 折算为 flat 下限。
   *  支持两种口径：
   *   - floorPct（推荐，阶段 E 校准）：按 NPC 最佳文体期望分 × 比例折算，全档位稳定贡献等效 pct
   *     （解决此前固定 floor 在高档总分中占比摊薄、招牌近失效的问题）；
   *   - floor（旧格式兼容）：固定分。
   *  仅提高下限，暂不限制上限（ceiling 为对称设计位，阶段 E 后续接入）。
   */
  const steadyFloor = (sigObj) => {
    if (sigObj && sigObj.floorPct != null) {
      const exp = Math.max(0, Number(ctx && ctx.npcExpected) || 0);
      return Math.round(exp * (Number(sigObj.floorPct) || 0));
    }
    return Number(sigObj.floor) || 0;
  };

  const applyMain = (obj, isWeak = false) => {
    const tag = isWeak ? '副招牌' : '主招牌';
    const name = obj && obj.name || tag;
    if (obj && obj.template === 'sig_dice_response') {
      const fv = Math.round(diceResponseFlat(obj) * ret);
      if (fv !== 0) flat.push({ source: 'npcSign', label: `招牌·${name}`, value: fv });
    } else if (obj && obj.template === 'sig_steady_pressure') {
      const fv = Math.round(steadyFloor(obj) * ret);
      if (fv !== 0) flat.push({ source: 'npcSign', label: `招牌·${name}`, value: fv });
    } else if (obj && (obj.template === 'sig_style_mastery' || obj.template === 'sig_repeat_read' || obj.template === 'sig_copycat'
      || obj.template === 'sig_zeitgeist_surf' || obj.template === 'sig_active_talent_tax'
      || obj.template === 'sig_dice_pattern_hunt' || obj.template === 'sig_declared_stance')) {
      const v = Number(obj.pct) || 0;
      const eff = v * ret;
      if (eff !== 0) pct.push({ source: 'npcSign', label: `招牌·${name}`, value: eff });
    } else if (obj && obj.template === 'sig_manner_theme') {
      // 文风立意（阶段D D4 落地，此前仅在 UI 文案展示、无实际分数效果）：
      // 对「思力贡献 = npcSi × siMult」按 pct 折算为额外 flat 分（等效总分提高 pct），
      // 再按破绽保留比例摊薄。applyTo !== 'si_contribution' 时忽略（仅内容告警 E3）。
      if ((obj.applyTo || 'si_contribution') === 'si_contribution') {
        const pctM = Number(obj.pct) || 0;
        const si = Math.max(0, Number(ctx && ctx.npcSi) || 0);
        const add = Math.round(si * BATTLE_COEF.siMult * pctM * ret);
        if (add !== 0) flat.push({ source: 'npcSign', label: `招牌·${name}`, value: add });
      }
    }
    // sig_debt_drain / sig_palace_adapt 不在本场得分修正；由后果/后续处理
  };

  if (tri && tri.level === 'main' && main) applyMain(main, false);
  else if (tri && tri.level === 'weak' && weak) applyMain(weak, true);

  // 只用基础骰破绽：NPC 失去稳定分 → 负的 flat 修正（wea.flatPenalty 已是负值）
  if (wea && wea.flatPenalty) flat.push({ source: 'npcWeak', label: '失稳', value: Math.round(wea.flatPenalty) });

  return {
    pct, flat,
    playerBonusPct: wea && wea.playerBonus ? Number(wea.playerBonus) || 0 : 0,
    extraInspCost: wea && wea.extraInspCost ? Number(wea.extraInspCost) : 0,
    refundInsp: wea && wea.refundInsp ? Number(wea.refundInsp) || 0 : 0,
    infoBonus: wea && wea.infoBonus ? Number(wea.infoBonus) || 0 : 0,
    cancelAlt: !!(wea && wea.cancelAlt)
  };
}

export default {
  rollIntention, pickIntentionStyle, signatureTriggered, weaknessResolution, signatureScoreMods
};

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

/* 评分配置适配与缓存已拆分到 grade-config.js。 */

/**
 * 六维结算。
 * @param {object} s
 *  attrs   {shi,ci,lian,bi,xue,si}
 *  battle  {win,draw,loss,maxStreak,upsets,winsByStyle:{shi,ci,lian}}
 *  events  {total,rare,legend,talents,items}
 *  finish  {reached,inspirationLeft,turns,finalWin}（旧配置兼容 palaceSweep）
 * @param {object} cfgRaw config/grades.json
 */
export function sixDimScore(s, cfgRaw) {
  const cfg = normalizeGrades(cfgRaw);
  const D = cfg.dims;
  const a = s.attrs || {};
  const b = Object.assign({ win: 0, draw: 0, loss: 0, maxStreak: 0, upsets: 0, winsByStyle: {} }, s.battle);
  const e = Object.assign({ total: 0, rare: 0, legend: 0, talents: 0, items: 0 }, s.events);
  const f = Object.assign({ reached: false, inspirationLeft: 0, turns: 0, finalWin: false, palaceSweep: false, manuscriptBonus: 0, manuscriptVolumes: 0 }, s.finish);
  if (f.finalWin == null) f.finalWin = !!f.palaceSweep;
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
  if (Number(f.manuscriptBonus) > 0)
    p1.push({ label: `笔力·定卷：成卷 ${Number(f.manuscriptVolumes) || 0}`, value: Math.round(Number(f.manuscriptBonus) || 0) });

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
  if (f.finalWin || f.palaceSweep) p6.push({ label: '金榜题名：殿试夺魁', value: y.finalWin ?? y.palaceSweep });
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
