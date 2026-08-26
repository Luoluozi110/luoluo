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
 * 从一个明确档位抽取对手。阶段必遇只在该档首次命中时生效，
 * 之后恢复权重随机，避免一路反复遭遇同一名 NPC。
 */
export function pickNpcFromTier(game, tier, { recordStageForce = true } = {}) {
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
  const seen = state.stageForcedSeen || (state.stageForcedSeen = {});
  const forced = forcedStageNpc(pool, state.attrs);
  if (forced && !seen[tier.id]) {
    if (recordStageForce) seen[tier.id] = stableFoeId(forced);
    return { ...npcFromPick(tier, forced), stageForced: true };
  }
  return npcFromPick(tier, R.pickNpcByWeight(pool, game.rand) || pool[0]);
}

export function pickNpc(game, forPalace) {
  const list = game.cfg.npcs || [];
  let tier;
  if (forPalace) {
    tier = list.find(n => n.id === 'zhukaoguan')
      || list.find(n => (n.range || [])[0] >= 1)
      || list[list.length - 1];
  } else {
    tier = tierForCurrentStage(game, list);
  }
  return pickNpcFromTier(game, tier, { recordStageForce: !forPalace });
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
