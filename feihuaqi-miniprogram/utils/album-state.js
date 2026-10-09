// 传世名篇装配层
//
// 「装配」指的是开局前从已解锁的名篇中挑最多 LOADOUT_MAX 张随身携带：
// 每张的基础奖励开局即得，两条成长路线按等级逐级生效。
//
// 存储由引擎的 album.js 负责（store.loadout 存 id 数组，store.progress 存等级与路线），
// 本模块只做两件事：把存储读成界面能直接渲染的形状，以及把玩家的选择写回存储。

import { RAW_CONFIG } from '../engine/embed-config.js';
import * as Album from '../engine/album.js';

export const LOADOUT_MAX = Album.LOADOUT_MAX;

const STYLE_NAMES = { shi: '诗', ci: '词', lian: '联' };

/** 把 unlock 配置翻成人话；未知类型退回原文，便于内容方新增后仍可见 */
function describeUnlock(unlock) {
  if (!unlock || typeof unlock !== 'object') return '未知条件';
  const min = Number(unlock.min) || 0;
  switch (unlock.type) {
    case 'styleWins':
      return `以${STYLE_NAMES[unlock.style] || unlock.style}出战获胜 ${min} 次`;
    case 'quizzes':
      return `答对考题 ${min} 道`;
    case 'fengbi':
      return `经历封笔（灵感耗尽）${min} 次`;
    case 'palaceSweep':
      return `殿试全胜 ${min} 次`;
    case 'wins':
      return `累计论战获胜 ${min} 场`;
    case 'events':
      return `经历奇遇 ${min} 则`;
    case 'games':
      return `完成 ${min} 局对弈`;
    case 'maxTotal':
      return `单局总分达到 ${min}`;
    default:
      return unlock.desc || `条件：${unlock.type || '未说明'}`;
  }
}

/** 开局奖励的说明文字 */
function describeReward(reward) {
  if (!reward || typeof reward !== 'object') return '';
  switch (reward.type) {
    case 'attr':
      return `开局 ${reward.attr || ''} +${Number(reward.value) || 0}`;
    case 'inspiration':
      return `开局灵感 +${Number(reward.value) || 0}`;
    case 'talent':
      return `开局携带文心「${reward.name || reward.talent || ''}」`;
    case 'title':
      return `获得称号「${reward.title || ''}」`;
    default:
      return reward.desc || '';
  }
}

/**
 * 读出装配界面所需的全部状态。
 * 已解锁与未解锁都返回 —— 未解锁的卡展示解锁条件，本身就有引导作用。
 */
export function getAlbumView() {
  const store = Album.loadStore();
  const unlocked = new Set(store.unlocked || []);
  const progress = store.progress || {};
  const selected = Array.isArray(store.loadout) ? store.loadout : [];
  const cards = Array.isArray(RAW_CONFIG.album) ? RAW_CONFIG.album : [];

  return {
    max: LOADOUT_MAX,
    selected,
    selectedCount: selected.length,
    unlockedCount: unlocked.size,
    totalCount: cards.length,
    cards: cards.map((card) => {
      const p = progress[card.id] || {};
      const level = Number(p.level) || 0;
      const branches = (card.branches || []).map((b) => ({
        id: b.id,
        name: b.name,
        desc: b.desc || '',
        minLevel: Number(b.minLevel) || 1,
        reachable: level >= (Number(b.minLevel) || 1),
      }));
      return {
        id: card.id,
        name: card.name,
        text: card.text || '',
        rewardDesc: card.rewardDesc || describeReward(card.reward),
        unlocked: unlocked.has(card.id),
        unlockText: describeUnlock(card.unlock),
        level,
        levelName: level > 0 ? Album.albumLevelName(level) : '',
        branch: p.branch || '',
        branchLocked: !!p.branchLocked,
        branches,
        chosen: selected.indexOf(card.id) >= 0,
      };
    }),
  };
}

/**
 * 切换某张名篇是否随行。
 * 超过上限时先移除最早选中的一张（与 H5 版行为一致）。
 * @returns {{ok:boolean, reason?:string, selected:string[]}}
 */
export function toggleLoadout(cardId) {
  const store = Album.loadStore();
  const unlocked = new Set(store.unlocked || []);
  if (!unlocked.has(cardId)) return { ok: false, reason: '该名篇尚未解锁', selected: store.loadout || [] };

  let list = Array.isArray(store.loadout) ? store.loadout.slice() : [];
  const at = list.indexOf(cardId);
  if (at >= 0) {
    list.splice(at, 1);
  } else {
    if (list.length >= LOADOUT_MAX) list.shift();
    list.push(cardId);
  }
  store.loadout = list.slice(0, LOADOUT_MAX);
  Album.saveStore(store);
  return { ok: true, selected: store.loadout };
}

/**
 * 为某张名篇选定成长路线。路线一经选定即锁定（引擎的 chooseAlbumBranch 决定）。
 */
export function chooseBranch(cardId, branchId) {
  const store = Album.loadStore();
  const card = (RAW_CONFIG.album || []).find((c) => c && c.id === cardId);
  if (!card) return { ok: false, reason: '名篇不存在' };

  const res = Album.chooseAlbumBranch(store, card, branchId);
  if (res && res.ok) Album.saveStore(res.store);
  return { ok: !!(res && res.ok), reason: (res && res.reason) || '', progress: res && res.progress };
}

/**
 * 取名篇卡对象数组，供 game.start 的 loadout 参数使用。
 * 引擎要求的是 card 对象而不是 id，这里做一次映射。
 */
export function getLoadoutCards() {
  return Album.loadoutCards(RAW_CONFIG.album || [], Album.loadStore());
}

/** 上一次装配的名篇名称，用于在界面上做提示 */
export function getSelectedNames() {
  const store = Album.loadStore();
  const ids = Array.isArray(store.loadout) ? store.loadout : [];
  return ids
    .map((id) => (RAW_CONFIG.album || []).find((c) => c && c.id === id))
    .filter(Boolean)
    .map((c) => c.name);
}
