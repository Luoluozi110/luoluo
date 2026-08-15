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

  // 文体（无签名偏置时退化为纯期望分最优）
  const style = pickIntentionStyle(opt.npcAttrs || {}, tpl, intent.bias);

  // 文风：文风立意型取模板候选中最优相性者；否则题材相性最优
  let manner;
  if (tpl && tpl.type === 'manner') {
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
    template: intent.template || 'int_preferred_style'
  };
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
    } else if (obj && (obj.template === 'sig_style_mastery' || obj.template === 'sig_repeat_read' || obj.template === 'sig_copycat')) {
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
