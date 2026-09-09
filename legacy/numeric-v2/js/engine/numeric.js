/**
 * 数值系统 v2 的单位与定点计算。
 *
 * 配置文件保存整数单位，运行时仍向既有战斗规则层提供 0～1 的比例，
 * 因此迁移不会让“800 bp”被误当作“+800%”。资源、属性与连续进度
 * 始终保留为整数，禁止写入二进制浮点小数。
 */

export const NUMERIC_VERSION = 2;
export const SCALE = Object.freeze({
  attribute: 10,
  inspiration: 10,
  insight: 10,
  progress: 1000,
  battleScore: 10,
  bp: 10000
});

export const clampInt = (value, min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
};

/** 正负对称的“半入”整数舍入，避免 Math.round 对负半数的偏差。 */
export const roundDiv = (numerator, denominator) => {
  const n = Number(numerator), d = Math.abs(Number(denominator));
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return 0;
  return Math.sign(n) * Math.floor(Math.abs(n) / d + 0.5);
};

export const toBp = ratio => clampInt(roundDiv(Number(ratio) * SCALE.bp, 1));
export const fromBp = bp => Number(bp || 0) / SCALE.bp;
export const mulBp = (value, bp) => roundDiv(Number(value || 0) * Number(bp || 0), SCALE.bp);

/**
 * 新版研修、成稿和构思都采用同一“收入 + 结余 → 完成次数 + 新结余”规则。
 */
export function accumulateProgress(previous, income, threshold) {
  const need = Math.max(1, clampInt(threshold, 1));
  const total = Math.max(0, clampInt(previous, 0)) + Math.max(0, clampInt(income, 0));
  return { total, completed: Math.floor(total / need), remainder: total % need, need };
}

/** 旧档的十进制小数转为新版进度整数，限定三位旧精度，隔离浮点噪声。 */
export const legacyProgressToV2 = value => Math.max(0, roundDiv(Math.round((Number(value) || 0) * 1000), 1));

/** 旧属性／资源的标准十倍迁移。 */
export const legacyTenthsToV2 = value => Math.max(0, roundDiv(Number(value || 0) * SCALE.attribute, 1));

const RATE_KEYS = new Set([
  'value', 'pct', 'chance', 'ratio', 'fraction', 'mult', 'penalty', 'retention', 'cap',
  'minPct', 'maxPct', 'highPct', 'lowMult', 'highMult', 'scorePct', 'nextBattlePct',
  'singleDieBonus', 'perStepValue', 'fullValue', 'highValue', 'lowValue', 'themeFlat',
  'synergyPct', 'convertPct', 'previousWinBonus', 'previousNonWinBonus', 'fillRatio',
  'thresholdRatio', 'inspirationRatioMin', 'upgradeCostRate', 'inspirationBonusRate',
  'attrRatio', 'softRate', 'midRate', 'highRate'
]);

const RATE_TYPES = new Set([
  'style_pct', 'theme_pct', 'syn_pct', 'palace_pct', 'dice_pattern', 'extra_dice_pct',
  'comeback', 'battle_history_pct', 'armory_pct', 'style_switch_pct', 'manuscript_pct',
  'streak_pct', 'restraint_pct', 'weakness_reward', 'dice_commitment', 'copy_affinity',
  'borrow_signature', 'extra_dice_chain', 'dice_transform', 'seal_signature', 'attr_pct',
  'next_battle_pct', 'lucky_six', 'streak_mult', 'pct', 'crit'
]);

/**
 * V2 配置里百分比以 bp 写入。本函数只在加载后的内存对象中把比例还原成
 * 现有规则层需要的十进制，不改变资源和属性整数。
 */
export function normalizeNumericRates(config) {
  if (!config || Number(config.numericVersion) !== NUMERIC_VERSION || config.__numericRatesNormalized) return config;

  const visitEffect = effect => {
    if (!effect || typeof effect !== 'object') return;
    const type = effect.type;
    for (const [key, value] of Object.entries(effect)) {
      if (key === 'reward' || key === 'fullReward') continue;
      if (Array.isArray(value)) {
        if (key === 'tiers') value.forEach(tier => visitEffect({ type, ...tier }));
        continue;
      }
      if (!Number.isFinite(Number(value))) continue;
      if ((RATE_TYPES.has(type) && RATE_KEYS.has(key)) || key === 'chance' || key === 'retention') effect[key] = fromBp(value);
    }
    if (effect.reward && typeof effect.reward === 'object') visitEffect(effect.reward);
    if (effect.fullReward && typeof effect.fullReward === 'object') visitEffect(effect.fullReward);
    if (Array.isArray(effect.tiers)) effect.tiers.forEach(tier => {
      if (!tier || typeof tier !== 'object') return;
      if (Number.isFinite(Number(tier.value))) tier.value = fromBp(tier.value);
      if (tier.reward && typeof tier.reward === 'object') visitEffect(tier.reward);
    });
    if (effect.when && Number.isFinite(Number(effect.when.inspirationRatioMin))) {
      effect.when.inspirationRatioMin = fromBp(effect.when.inspirationRatioMin);
    }
  };

  const effectsOf = list => (Array.isArray(list) ? list : []).forEach(item => {
    if (item && typeof item === 'object') visitEffect(item.effect || item);
  });
  effectsOf(config.talents);
  effectsOf(config.sky);
  for (const card of (config.sky || [])) for (const choice of (card && card.choices || [])) {
    const effect = choice && choice.effect;
    if (!effect || typeof effect !== 'object') continue;
    if (effect.type === 'sky_strategy' && effect.key === 'battle_attack_pct' && Number.isFinite(Number(effect.value))) effect.value = fromBp(effect.value);
  }
  for (const card of (config.album || [])) {
    if (card && card.effect) visitEffect(card.effect);
    for (const branch of (card && card.branches || [])) for (const effect of (branch && branch.effects || [])) visitEffect(effect);
  }
  effectsOf((config['sidequest-talents'] || {}).talents);
  for (const upgrade of Object.values(config['talent-upgrade'] || {})) effectsOf(upgrade && upgrade.levels);
  for (const upgrade of Object.values((config['sidequest-talents'] || {}).upgrades || {})) effectsOf(upgrade && upgrade.levels);
  for (const synergy of (config.synergies || [])) effectsOf(synergy && synergy.effects);

  const affinity = config.affinity || {};
  for (const [key, value] of Object.entries(affinity.matrix || {})) if (Number.isFinite(Number(value))) affinity.matrix[key] = fromBp(value);
  for (const key of ['homeMannerBonus', 'homeAdaptiveBonus', 'zeitgeistThemeBonus', 'zeitgeistMannerBonus', 'momentumPer']) {
    if (Number.isFinite(Number(affinity[key]))) affinity[key] = fromBp(affinity[key]);
  }
  if (affinity.experimentalManner) {
    for (const key of ['minPct', 'maxPct']) if (Number.isFinite(Number(affinity.experimentalManner[key]))) affinity.experimentalManner[key] = fromBp(affinity.experimentalManner[key]);
  }

  const attrs = config.attrs || {};
  const strategy = attrs.abilitySystem && attrs.abilitySystem.strategy;
  if (strategy && strategy.plans && strategy.plans.switch && Number.isFinite(Number(strategy.plans.switch.scorePct))) {
    strategy.plans.switch.scorePct = fromBp(strategy.plans.switch.scorePct);
  }
  if (attrs.styleSystem) for (const style of Object.values(attrs.styleSystem)) {
    if (!style || typeof style !== 'object') continue;
    for (const key of ['lowMult', 'highMult', 'highPct', 'switchPct']) if (Number.isFinite(Number(style[key]))) style[key] = fromBp(style[key]);
  }
  for (const key of ['talentDropRate']) if (Number.isFinite(Number(attrs[key]))) attrs[key] = fromBp(attrs[key]);
  for (const key of ['midRate', 'highRate']) if (attrs.diminish && Number.isFinite(Number(attrs.diminish[key]))) attrs.diminish[key] = fromBp(attrs.diminish[key]);
  // exp 是曲线指数而非比例，不能随 bp 还原。
  for (const key of ['min', 'max']) if (attrs.winScale && Number.isFinite(Number(attrs.winScale[key]))) attrs.winScale[key] = fromBp(attrs.winScale[key]);

  const inspiration = config.inspiration || {};
  for (const key of ['dicePct', 'extraDicePct']) if (Number.isFinite(Number(inspiration[key]))) inspiration[key] = fromBp(inspiration[key]);

  for (const school of (config.schools || [])) {
    const mechanic = school && school.schoolMechanics;
    if (!mechanic || typeof mechanic !== 'object') continue;
    for (const key of ['inspirationBonusRate', 'upgradeCostRate', 'talentDropRate', 'talentDropCap']) {
      if (Number.isFinite(Number(mechanic[key]))) mechanic[key] = fromBp(mechanic[key]);
    }
    const conversion = mechanic.talentConversion;
    if (conversion && Number.isFinite(Number(conversion.chance))) conversion.chance = fromBp(conversion.chance);
  }

  const normalizeNpcTier = tier => {
    if (!tier || typeof tier !== 'object') return;
    if (Array.isArray(tier && tier.range)) tier.range = tier.range.map(fromBp);
    for (const npc of (tier.npcs || [])) {
      normalizeNpcRates(npc && npc.mech);
    }
  };
  const NPC_RATE_KEYS = new Set(['bias', 'bottom', 'cap', 'floorPct', 'intentBias', 'minWeaknessRetention', 'pct', 'playerBonus', 'retention', 'weaknessDampen', 'extraShutdown']);
  function normalizeNpcRates(value) {
    if (Array.isArray(value)) return value.forEach(normalizeNpcRates);
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (NPC_RATE_KEYS.has(key) && Number.isFinite(Number(child))) value[key] = fromBp(child);
      else if (key === 'threshold' && Number.isFinite(Number(child)) && Math.abs(Number(child)) <= SCALE.bp) value[key] = fromBp(child);
      else normalizeNpcRates(child);
    }
  }
  for (const tier of (config.npcs || [])) normalizeNpcTier(tier);
  for (const route of Object.values((config['sidequest-npcs'] || {}).routes || {})) normalizeNpcTier({ npcs: Object.values(route && route.npcs || {}) });
  normalizeNpcRates(config['sidequest-npcs']);
  normalizeNpcRates(config['npc-mechanics']);
  const npcBudget = config['npc-mechanics'] && config['npc-mechanics'].budget;
  if (npcBudget) for (const key of ['signatureMain', 'signatureWeakRatio', 'weaknessShutdown', 'playerBonus', 'intentBottom']) {
    const group = npcBudget[key];
    if (!group || typeof group !== 'object') continue;
    for (const [tier, value] of Object.entries(group)) {
      if (Array.isArray(value)) group[tier] = value.map(fromBp);
      else if (Number.isFinite(Number(value))) group[tier] = fromBp(value);
    }
  }

  const normalizeNestedRates = (value, parentKey = '') => {
    if (Array.isArray(value)) return value.forEach(item => normalizeNestedRates(item, parentKey));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if ((['nextBattlePct', 'scorePct', 'chance', 'ratio', 'retention', 'inspirationRatioMin'].includes(key) || parentKey === 'scorePctByMerit') && Number.isFinite(Number(child))) value[key] = fromBp(child);
      else normalizeNestedRates(child, key);
    }
  };
  normalizeNestedRates(config.sidequests);

  Object.defineProperty(config, '__numericRatesNormalized', { value: true, configurable: true });
  return config;
}
