/**
 * content-test.js —— 版本测试用「全内容解锁」数据工具。
 *
 * 只操作跨局测试存档（图鉴阁 + 传世名篇 + 流派造诣），不改动对局中的临时状态。
 * 首次写入前会保存一份本机快照，方便测试结束后恢复原进度。
 */

import * as Album from './album.js';
import * as Codex from './codex.js';

export const CONTENT_TEST_BACKUP_KEY = 'feihua_content_test_backup_v1';

let memoryBackup = null;

function hasLocalStorage() {
  try { return typeof localStorage !== 'undefined' && localStorage !== null; }
  catch (_) { return false; }
}

function readBackup() {
  if (!hasLocalStorage()) return memoryBackup;
  try {
    const raw = localStorage.getItem(CONTENT_TEST_BACKUP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function writeBackup(value) {
  if (!hasLocalStorage()) { memoryBackup = value; return; }
  try { localStorage.setItem(CONTENT_TEST_BACKUP_KEY, JSON.stringify(value)); }
  catch (_) { memoryBackup = value; }
}

function clearBackup() {
  memoryBackup = null;
  if (hasLocalStorage()) {
    try { localStorage.removeItem(CONTENT_TEST_BACKUP_KEY); } catch (_) { /* ignore */ }
  }
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function maxAlbumXp() {
  return Album.ALBUM_LEVEL_THRESHOLDS[Album.ALBUM_LEVEL_THRESHOLDS.length - 1] || 16;
}

function fullMasteryXp() {
  return Album.MASTERY_THRESHOLDS[Album.MASTERY_LEVELS - 1] || 340;
}

function upgradeOf(cfg, id) {
  if (cfg && cfg.talentUpgradeById instanceof Map) return cfg.talentUpgradeById.get(id) || null;
  return cfg && cfg['talent-upgrade'] && cfg['talent-upgrade'][id] || null;
}

function allFoes(cfg) {
  const out = [];
  for (const tier of (cfg && cfg.npcs) || []) {
    for (const npc of tier.npcs || []) {
      if (!tier.id || !npc.name) continue;
      const key = Codex.foeKey(tier.id, npc.name);
      const foeId = npc.mech && npc.id ? npc.id : tier.id;
      out.push({ tier, npc, key, foeId });
    }
  }
  return out;
}

/** 保存测试前的跨局进度；已有快照时不覆盖，确保可恢复到最初状态。 */
export function captureContentTestBackup() {
  if (readBackup()) return { ok: true, created: false };
  const backup = {
    v: 1,
    savedAt: Date.now(),
    album: Album.loadStore(),
    codex: Codex.loadCodex()
  };
  writeBackup(backup);
  return { ok: true, created: true };
}

export function hasContentTestBackup() {
  return !!readBackup();
}

/** 将所有内容标记为可见，并把相关条件补到可达值，便于测试页直接看到完成态。 */
export function applyFullContentUnlock(cfg) {
  const backup = captureContentTestBackup();
  const cards = (cfg && cfg.album) || [];
  const schools = (cfg && cfg.schools) || [];
  const talents = (cfg && cfg.talents) || [];
  const synergies = (cfg && cfg.synergies) || [];
  const sky = (cfg && cfg.sky) || [];
  const foes = allFoes(cfg);

  const store = Album.loadStore();
  store.unlocked = unique([...store.unlocked, ...cards.map(c => c.id)]);

  // 同步补齐所有图鉴解锁条件，避免「卡已亮但条件仍显示未完成」。
  store.stats.styleWins = store.stats.styleWins || { shi: 0, ci: 0, lian: 0 };
  for (const card of cards) {
    const unlock = card.unlock || {};
    const need = Math.max(1, Number(unlock.min) || 1);
    if (unlock.type === 'styleWins') {
      store.stats.styleWins[unlock.style] = Math.max(Number(store.stats.styleWins[unlock.style]) || 0, need);
    } else if (unlock.type && unlock.type in store.stats) {
      store.stats[unlock.type] = Math.max(Number(store.stats[unlock.type]) || 0, need);
    }

    const current = Album.normalizeAlbumProgress(store.progress && store.progress[card.id]);
    current.xp = Math.max(current.xp, maxAlbumXp());
    current.level = Album.albumLevelFromXp(current.xp);
    // 不替测试者预选成长路线：Lv4 后两条路线都保持可选。
    current.branch = '';
    current.branchLocked = false;
    store.progress[card.id] = current;
  }
  for (const school of schools) {
    if (!school || !school.id || !store.mastery[school.id]) continue;
    store.mastery[school.id] = { xp: Math.max(Number(store.mastery[school.id].xp) || 0, fullMasteryXp()), level: Album.MASTERY_LEVELS };
  }
  Album.saveStore(store);

  const codex = Codex.loadCodex();
  codex.foes = unique([...codex.foes, ...foes.map(x => x.key)]);
  codex.talents = unique([...codex.talents, ...talents.map(t => t.id)]);
  codex.synergies = unique([...codex.synergies, ...synergies.map(s => s.id)]);
  codex.sky = unique([...codex.sky, ...sky.map(s => s.id)]);
  for (const foe of foes) {
    const oldStats = codex.foeStats[foe.key] || {};
    codex.foeStats[foe.key] = {
      w: Math.max(Number(oldStats.w) || 0, 1),
      d: Math.max(Number(oldStats.d) || 0, 0),
      l: Math.max(Number(oldStats.l) || 0, 0)
    };
    const oldCog = codex.foeCognition[foe.foeId] || {};
    codex.foeCognition[foe.foeId] = {
      level: 3,
      meets: Math.max(Number(oldCog.meets) || 0, 3),
      weaknessHits: Math.max(Number(oldCog.weaknessHits) || 0, 1)
    };
  }
  for (const talent of talents) {
    const maxLevel = Math.max(1, Number((upgradeOf(cfg, talent.id) || {}).maxLevel) || 1);
    codex.talentLevels[talent.id] = Math.max(Number(codex.talentLevels[talent.id]) || 1, maxLevel);
  }
  Codex.saveCodex(codex);

  return {
    backupCreated: backup.created,
    summary: getContentTestSummary(cfg)
  };
}

/** 恢复首次执行测试解锁前的本机快照。 */
export function restoreContentTestBackup() {
  const backup = readBackup();
  if (!backup || !backup.album || !backup.codex) return { ok: false, reason: '没有可恢复的测试前进度' };
  Album.saveStore(backup.album);
  Codex.saveCodex(backup.codex);
  clearBackup();
  return { ok: true, summary: { album: Album.loadStore(), codex: Codex.loadCodex() } };
}

export function getContentTestSummary(cfg) {
  const store = Album.loadStore();
  const codex = Codex.loadCodex();
  const cards = (cfg && cfg.album) || [];
  const talents = (cfg && cfg.talents) || [];
  const synergies = (cfg && cfg.synergies) || [];
  const sky = (cfg && cfg.sky) || [];
  const foes = allFoes(cfg);
  return {
    album: { got: cards.filter(c => store.unlocked.includes(c.id)).length, total: cards.length },
    mastery: {
      got: ((cfg && cfg.schools) || []).filter(s => store.mastery[s.id] && store.mastery[s.id].level >= Album.MASTERY_LEVELS).length,
      total: ((cfg && cfg.schools) || []).length
    },
    foes: { got: foes.filter(x => codex.foes.includes(x.key)).length, total: foes.length },
    talents: { got: talents.filter(t => codex.talents.includes(t.id)).length, total: talents.length },
    synergies: { got: synergies.filter(s => codex.synergies.includes(s.id)).length, total: synergies.length },
    sky: { got: sky.filter(s => codex.sky.includes(s.id)).length, total: sky.length },
    hasBackup: hasContentTestBackup()
  };
}
