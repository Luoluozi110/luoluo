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

export function pickNpc(game, forPalace) {
  const list = game.cfg.npcs || [];
  let tier;
  if (forPalace) {
    tier = list.find(n => n.id === 'zhukaoguan')
      || list.find(n => (n.range || [])[0] >= 1)
      || list[list.length - 1];
  } else {
    const p = game.progress();
    tier = list.find(n => n.range && p >= n.range[0] && p < n.range[1]) || list[0];
  }
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
  return npcFromPick(tier, R.pickNpcByWeight(pool, game.rand) || pool[0]);
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

