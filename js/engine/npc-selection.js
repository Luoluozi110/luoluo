/** NPC 档位抽取与跨场行为历史。保持 Game 只负责编排流程。 */
import * as R from './rules.js';

export function stableFoeId(npc) {
  if (!npc) return '论敌';
  return npc.id ? npc.id : npc.name;
}

export function npcFromPick(tier, pick) {
  const label = tier.tier || tier.name || '论敌';
  return {
    id: pick && pick.id ? pick.id : tier.id,
    tierId: tier.id,
    tier: label, range: tier.range, desc: tier.desc,
    isFinal: tier.isFinal, battles: tier.battles, themes: tier.themes,
    name: pick.name || label,
    title: pick.title || '',
    style: pick.style || '',
    attrs: pick.attrs || tier.attrs || {},
    mech: pick.mech || null,
    fullName: `${label}·${pick.name || label}`
  };
}

/**
 * 阶段必遇条件：由 NPC 配置声明，而非在流程里按姓名硬编码。
 * 当前支持「某一属性严格超过门槛，可选地再严格高于指定属性」：
 * { primary:'lian', minExclusive:35 } 或
 * { primary:'lian', minExclusive:35, strictlyHigherThan:['shi','ci'] }。
 * stageForcedWhen 用于所属档位；palaceForcedWhen 作为康尔玉旧数据的兼容别名。
 * 同时满足多名时按档内配置顺序取首名，保持结果确定、可审计。
 */
export function forcedStageNpc(pool, attrs) {
  if (!Array.isArray(pool) || !pool.length) return null;
  const values = attrs || {};
  for (const npc of pool) {
    const rule = npc && (npc.stageForcedWhen || npc.palaceForcedWhen);
    if (!rule || !rule.primary) continue;
    const primary = Number(values[rule.primary]);
    const min = Number(rule.minExclusive);
    if (!Number.isFinite(primary) || !Number.isFinite(min) || !(primary > min)) continue;
    const compare = Array.isArray(rule.strictlyHigherThan) ? rule.strictlyHigherThan : [];
    if (compare.every(key => primary > Number(values[key]))) return npc;
  }
  return null;
}

/**
 * 殿试的康尔玉是玩法承诺，不能因旧编辑器工程缺少条件字段而失效。
 * 因而先按联力门槛锁定档内的稳定 ID，再回退到其他配置化的殿试必遇规则。
 */
export function forcedPalaceNpc(pool, attrs) {
  const lian = Number(attrs && attrs.lian);
  // 兼容历史云端工程曾把康尔玉条目的 id 序列化成空串：按稳定 id 或显示名兜底识别。
  const kang = Array.isArray(pool) && pool.find(npc => npc && (npc.id === 'kang_er_yu' || (!npc.id && npc.name === '康尔玉')));
  if (kang && Number.isFinite(lian) && lian > 35) return kang;
  return forcedStageNpc(pool, attrs);
}

/**
 * 三圈棋盘的关卡阶段与 NPC 档位并不等同于路线进度百分比：例如进入举人圈时，
 * 路线进度仍可能落在秀才档的旧区间。常规遭遇必须以已进入的阶段为准，
 * 旧版棋盘或未知阶段才保留按进度区间抽取的兼容逻辑。
 */
const PHASE_TIER_ID = Object.freeze({
  child: 'tongsheng',
  xiucai: 'xiucai',
  juren: 'juren',
  jinshi: 'jinshi',
  palace: 'zhukaoguan',
  secret: 'taohuaxian'
});

export function tierForCurrentStage(game, list = game.cfg.npcs || []) {
  const phase = game && game.s && game.s.phase;
  const tierId = PHASE_TIER_ID[phase];
  if (tierId) {
    const tier = list.find(entry => entry && entry.id === tierId);
    if (tier) return tier;
  }
  const progress = game.progress();
  return list.find(entry => entry.range && progress >= entry.range[0] && progress < entry.range[1]) || list[0];
}

/**
 * 入门卷：把具名 NPC 的难度角色推导出来。
 * 优先取已外置的 `difficultyRole`；缺省时回退到 `mech.complexity` 映射；
 * 两者皆无则默认 `advanced`（不冒险放进新手池）。
 */
const ROLE_FROM_COMPLEXITY = {
  tutorial: 'tutorial',
  basic: 'basic',
  advanced: 'advanced',
  cross_battle: 'advanced'
};
export function npcDifficultyRole(npc) {
  if (npc && npc.difficultyRole) {
    return ['tutorial', 'basic', 'advanced', 'elite'].includes(npc.difficultyRole) ? npc.difficultyRole : 'advanced';
  }
  const c = npc && npc.mech && npc.mech.complexity;
  if (c && ROLE_FROM_COMPLEXITY[c]) return ROLE_FROM_COMPLEXITY[c];
  return 'advanced';
}

/**
 * 模式权重解析。兼容顺序：
 *   入门卷：beginnerWeight → weight → 默认权重
 *   标准局：standardWeight → weight → 默认权重
 * `npcWeightForMode(npc, false)` 必须与现有标准选择行为完全一致，
 * 因此标准局不读取任何入门卷字段。
 */
export function npcWeightForMode(npc, onboardingEnabled) {
  const def = R.NPC_DEFAULT_WEIGHT;
  const w = Number(npc && npc.weight);
  if (onboardingEnabled) {
    const bw = Number(npc && npc.beginnerWeight);
    if (Number.isFinite(bw) && bw >= 0) return bw;
  } else {
    const sw = Number(npc && npc.standardWeight);
    if (Number.isFinite(sw) && sw >= 0) return sw;
  }
  if (Number.isFinite(w) && w >= 0) return w;
  return def;
}

/**
 * 入门卷候选池筛选。纯函数，便于单元测试。
 * `context` 由 game.js 传入：{ isGate, phase, battleCount, isFirstXiucaiGate, isPalace }。
 * 殿试（isPalace）由调用方保证传入完整池，此处仅做防御性兜底。
 * 任一档位找不到符合要求的 NPC 时，按 tutorial → basic → advanced → 原始池 放宽，
 * 每次放宽都写入开发日志，便于发现配置缺口。
 */
export function poolForOnboarding(game, tier, context) {
  const pool = Array.isArray(tier.npcs) ? tier.npcs : [];
  if (!pool.length) return pool;
  if (context && context.isPalace) return pool;

  const { isGate, battleCount = 0, isFirstXiucaiGate } = context || {};
  const roleOf = npcDifficultyRole;
  let result = pool;
  let relaxedFrom = null;

  if (isGate && isFirstXiucaiGate) {
    // 首次秀才晋阶试：只取 basic（排除 117/123 等超规格精英）
    const basic = pool.filter(n => roleOf(n) === 'basic');
    if (basic.length) {
      result = basic;
    } else {
      relaxedFrom = 'basic';
      const advanced = pool.filter(n => roleOf(n) === 'advanced');
      result = advanced.length ? advanced : pool;
    }
  } else if (isGate) {
    // 后续晋阶试：排除 elite，advanced 借 beginnerWeight 保持低概率
    const nonElite = pool.filter(n => roleOf(n) !== 'elite');
    if (nonElite.length) {
      result = nonElite;
    } else {
      relaxedFrom = 'non-elite';
      result = pool;
    }
  } else if (battleCount === 0) {
    // 第 1 场普通论战：只取 tutorial
    const tutorial = pool.filter(n => roleOf(n) === 'tutorial');
    if (tutorial.length) {
      result = tutorial;
    } else {
      relaxedFrom = 'tutorial';
      const basic = pool.filter(n => roleOf(n) === 'basic');
      if (basic.length) result = basic;
      else {
        const advanced = pool.filter(n => roleOf(n) === 'advanced');
        result = advanced.length ? advanced : pool;
      }
    }
  } else if (battleCount === 1) {
    // 第 2 场普通论战：tutorial 或 basic，不得选 elite
    const tb = pool.filter(n => { const r = roleOf(n); return r === 'tutorial' || r === 'basic'; });
    if (tb.length) {
      result = tb;
    } else {
      relaxedFrom = 'tutorial/basic';
      const advanced = pool.filter(n => roleOf(n) === 'advanced');
      result = advanced.length ? advanced : pool;
    }
  } else {
    // 第 3 场及以后：按 beginnerWeight 抽取（elite 已为 0），不做结构性过滤
    result = pool;
  }

  if (relaxedFrom) {
    console.warn(`[onboarding] tier ${tier.id} 候选池放宽：请求 ${relaxedFrom} 不可用，回退到更宽池（${result.length} 名 NPC）。`);
  }
  return result;
}

/**
 * 从一个明确档位抽取对手。阶段必遇只在该档首次命中时生效，
 * 之后恢复权重随机，避免一路反复遭遇同一名 NPC。
 * 新增 `context`：入门卷开启时，前两场普通论战与首次秀才晋阶试优先于普通
 * `stageForcedWhen`，以保证新手梯度不被阶段必遇 NPC 打断。
 */
export function pickNpcFromTier(game, tier, { recordStageForce = true, context = null } = {}) {
  if (!tier) return { name: '论敌', fullName: '论敌', attrs: { shi: 5, ci: 4, lian: 3, bi: 4, xue: 4, si: 4 } };
  const label = tier.tier || tier.name || '论敌';
  const pool = Array.isArray(tier.npcs) ? tier.npcs : null;
  if (!pool || !pool.length) {
    return {
      id: tier.id, tier: label, range: tier.range, desc: tier.desc,
      isFinal: tier.isFinal, battles: tier.battles, themes: tier.themes,
      name: tier.name || label, title: tier.title || '', attrs: tier.attrs || {}, fullName: label
    };
  }
  const state = game.s || {};
  const onboarding = state.onboarding;
  const onboardingEnabled = !!(onboarding && onboarding.enabled && !onboarding.disabledByPlayer);
  const isPalace = !!(context && context.isPalace);
  // 殿试沿用当前主考规则，不套用入门卷权重/筛选
  const useOnboarding = onboardingEnabled && !isPalace;

  // 入门卷前两场普通论战、首次秀才晋阶试优先于普通 stageForcedWhen，
  // 把被推迟的必遇 NPC 留给该阶段下一场符合条件的普通论战恢复触发。
  const overrideForced = useOnboarding && context && (
    (context.isGate && context.isFirstXiucaiGate) ||
    (!context.isGate && context.battleCount < 2)
  );
  if (!overrideForced) {
    const seen = state.stageForcedSeen || (state.stageForcedSeen = {});
    const forced = forcedStageNpc(pool, state.attrs);
    if (forced && !seen[tier.id]) {
      if (recordStageForce) seen[tier.id] = stableFoeId(forced);
      return { ...npcFromPick(tier, forced), stageForced: true };
    }
  }

  const chosenPool = useOnboarding && context ? poolForOnboarding(game, tier, context) : pool;
  const weightedPool = chosenPool.map(n => ({ ...n, weight: npcWeightForMode(n, useOnboarding) }));
  const pick = R.pickNpcByWeight(weightedPool, game.rand) || weightedPool[0];
  return npcFromPick(tier, pick);
}

export function pickNpc(game, forPalace, context = null) {
  const list = game.cfg.npcs || [];
  let tier;
  if (forPalace) {
    tier = list.find(n => n.id === 'zhukaoguan')
      || list.find(n => (n.range || [])[0] >= 1)
      || list[list.length - 1];
  } else {
    tier = tierForCurrentStage(game, list);
  }
  return pickNpcFromTier(game, tier, { recordStageForce: !forPalace, context });
}

export function mechHistoryForNpc(state, npcId) {
  const nm = state.npcMech || {};
  const lastStyle = nm.lastPlayerStyle || null;
  const lastManner = nm.lastPlayerManner || null;
  let habitualStyle = null;
  const h = nm.history && nm.history[npcId];
  if (h && Array.isArray(h.styles) && h.styles.length >= 2 && h.styles[h.styles.length - 1] === h.styles[h.styles.length - 2]) {
    habitualStyle = h.styles[h.styles.length - 1];
  }
  return { lastStyle, lastManner, habitualStyle, _nm: nm };
}

export function strategyChangedSinceLast(state, npc, style, manner) {
  try {
    const nm = state.npcMech || {};
    const h = nm.history && nm.history[stableFoeId(npc)];
    if (!h) return false;
    const lastStyle = h.styles && h.styles[h.styles.length - 1];
    const lastManner = h.manners && h.manners[h.manners.length - 1];
    return !!lastStyle && (lastStyle !== style || lastManner !== manner);
  } catch (_) { return false; }
}

export function palaceStrategyChanged(state, style, manner) {
  try {
    const last = (state.npcMech || {}).palaceLast;
    return !!(last && last.style) && (last.style !== style || last.manner !== manner);
  } catch (_) { return false; }
}

