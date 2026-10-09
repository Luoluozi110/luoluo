// 文心装配页（传世名篇）
//
// 开局链的第二站：选流派 → **装配名篇 + 起名** → 对局。
// 名篇来自跨局解锁（图鉴），每张开局给基础奖励，两条成长路线按等级逐级生效。
// 新账号这里会是空的——那正是展示解锁条件的时机，本身就是引导。

import { getAlbumView, toggleLoadout, chooseBranch, LOADOUT_MAX } from '../../utils/album-state.js';
import { getSchool } from '../../utils/engine-runtime.js';
import storage from '../../utils/storage.js';

Page({
  data: {
    schoolName: '',
    schoolId: '',
    max: LOADOUT_MAX,
    cards: [],
    selected: [],
    selectedCount: 0,
    unlockedCount: 0,
    totalCount: 0,
    playerName: '',
    expandedId: '',
  },

  onLoad(query) {
    const schoolId = query && query.schoolId ? decodeURIComponent(query.schoolId) : '';
    const school = getSchool(schoolId);
    this.setData({
      schoolId,
      schoolName: (school && school.name) || '未定流派',
      playerName: storage.getItem('playerName') || '',
    });
    this.refresh();
  },

  refresh() {
    const view = getAlbumView();
    // 展开项：优先保持原展开，否则展开第一张已选中的卡
    let expandedId = this.data.expandedId;
    const stillExists = view.cards.some((c) => c.id === expandedId);
    if (!stillExists) {
      const firstChosen = view.cards.find((c) => c.chosen);
      expandedId = firstChosen ? firstChosen.id : '';
    }
    this.setData({
      cards: view.cards,
      selected: view.selected,
      selectedCount: view.selectedCount,
      unlockedCount: view.unlockedCount,
      totalCount: view.totalCount,
      max: view.max,
      expandedId,
    });
  },

  toggleCard(e) {
    const id = e.currentTarget.dataset.id;
    const res = toggleLoadout(id);
    if (!res.ok) {
      wx.showToast({ title: res.reason || '不可装配', icon: 'none' });
      return;
    }
    // 选中后自动展开，方便顺手选路线
    const cards = this.data.cards || [];
    const nowChosen = res.selected.indexOf(id) >= 0;
    this.setData({ expandedId: nowChosen ? id : this.data.expandedId });
    this.refresh();
    this.syncCards();
  },

  // 名篇一旦被移出装配，展开态也应收回
  syncCards() {
    const cards = (this.data.cards || []).map((c) => ({
      ...c,
      chosen: this.data.selected.indexOf(c.id) >= 0,
    }));
    this.setData({ cards });
  },

  toggleDetail(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ expandedId: this.data.expandedId === id ? '' : id });
  },

  pickBranch(e) {
    const { id, branch } = e.currentTarget.dataset;
    const card = (this.data.cards || []).find((c) => c.id === id);
    if (card && card.branchLocked && card.branch && card.branch !== branch) {
      wx.showToast({ title: '该名篇路线已定型', icon: 'none' });
      return;
    }
    const res = chooseBranch(id, branch);
    if (!res.ok) {
      wx.showToast({ title: res.reason || '当前无法选择此路线', icon: 'none' });
      return;
    }
    this.refresh();
  },

  onNameInput(e) {
    this.setData({ playerName: e.detail.value });
  },

  back() {
    wx.navigateBack();
  },

  start() {
    const name = String(this.data.playerName || '').trim();
    // 名号用于叙事第二人称的称呼，留空则以「无名氏」开局
    storage.setItem('playerName', name);
    wx.redirectTo({
      url:
        `/pages/game/game?schoolId=${encodeURIComponent(this.data.schoolId)}` +
        `&name=${encodeURIComponent(name)}`,
    });
  },
});
