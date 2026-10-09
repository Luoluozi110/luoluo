// 引擎装配层
// 把「配置 → Game 实例 → UI 适配器 → 视图模型」这条链路收在一处，页面只消费结果。
//
// 三条约束：
// 1. 配置在小程序里不再 fetch，来自 scripts/build-engine.mjs 编译出的 embed-config.js。
// 2. Game 实例与 cfg 只存在于 JS 层，绝不进 setData —— 渲染只吃 project() 产出的视图模型。
// 3. normalizeConfig 会就地补派生结构，每次开局必须给深拷贝，否则多局之间互相污染。

import { RAW_CONFIG } from '../engine/embed-config.js';
import { normalizeConfig } from '../engine/config.js';
import { Game } from '../engine/game.js';
import { ATTR_NAMES, CREATIVE_KEYS, BASIC_KEYS } from '../engine/rules.js';
import * as Save from '../engine/save.js';
import { createUiAdapter } from './ui-adapter.js';

const ATTR_ORDER = CREATIVE_KEYS.concat(BASIC_KEYS);

/**
 * 流派列表：schools 是纯文案配置，normalizeConfig 不处理它，
 * 因此可以直接读原始数据，省去一次昂贵的归一化。
 */
export function listSchools() {
  const list = Array.isArray(RAW_CONFIG.schools) ? RAW_CONFIG.schools : [];
  return list.map((sc) => ({
    id: sc.id,
    name: sc.name || '未名流派',
    desc: sc.desc || sc.slogan || '',
    homeManner: sc.homeManner || null,
  }));
}

export function getSchool(schoolId) {
  return listSchools().find((s) => s.id === schoolId) || null;
}

/** 构造一份可供 Game 使用的归一化配置 */
export function buildConfig() {
  return normalizeConfig(JSON.parse(JSON.stringify(RAW_CONFIG)));
}

/**
 * 开一局。返回的 game 挂在页面实例上，不要放进 data。
 * @param {object} opts
 * @param {string} opts.schoolId
 * @param {string} opts.playerName
 * @param {Array}  opts.loadout   开局携带的文心
 * @param {(evt:object)=>void} opts.sink UI 事件出口
 */
export function startGame(opts = {}) {
  const cfg = buildConfig();
  const events = [];
  const sink = (evt) => {
    events.push(evt);
    if (typeof opts.sink === 'function') opts.sink(evt);
  };

  const ui = createUiAdapter({ autoAnswer: true, sink });
  const game = new Game(cfg, ui, Math.random);
  const schoolId = opts.schoolId || (listSchools()[0] && listSchools()[0].id);
  game.start(schoolId, {
    loadout: opts.loadout || [],
    name: opts.playerName || '',
  });

  // 引擎在关键节点会调用 onForceSave（战斗前后、阶段推进、答题结算等），
  // 宿主负责真正落盘；缺了这个钩子，对局中断就会整局丢失。
  game.onForceSave = () => saveCurrentRun(game);

  return { game, ui, events, cfg };
}

/* ---------------- 存档 ---------------- */

/** 是否存在可续玩的存档 */
export function hasSavedRun() {
  try {
    return Save.hasRun();
  } catch (err) {
    console.warn('[runtime] 存档检查失败', err);
    return false;
  }
}

/** 落盘当前对局（引擎通过 onForceSave 自动调用） */
export function saveCurrentRun(game) {
  if (!game || !game.s || game.s.over) return { ok: false, reason: 'no-run' };
  try {
    return Save.saveRun(game);
  } catch (err) {
    // 存档失败不能影响对局本身
    console.error('[runtime] 存档失败', err);
    return { ok: false, error: String(err && err.message) };
  }
}

/** 清除自动存档槽（对局结束或重开新局时） */
export function clearSavedRun() {
  try {
    Save.clearRun(Save.RUN_SAVE_KEY);
  } catch (err) {
    console.warn('[runtime] 清除存档失败', err);
  }
}

/**
 * 续玩存档。
 *
 * deserializeRun 只还原可序列化数据，依赖运行时引用的部分（羁绊集合、派生结构）
 * 必须再调 rehydrate 补齐 —— 漏掉这一步会表现为「属性对但羁绊全失效」。
 *
 * @returns {{ok:boolean, game?:object, error?:string, turn?:number}}
 */
export function resumeGame(opts = {}) {
  let best = null;
  try {
    best = Save.loadBestRun();
  } catch (err) {
    return { ok: false, error: '存档读取异常' };
  }
  if (!best || !best.obj) return { ok: false, error: '没有可续玩的存档' };
  if (best.obj.__corrupt) {
    clearSavedRun();
    return { ok: false, error: '存档已损坏，已清除' };
  }

  const cfg = buildConfig();
  const res = Save.deserializeRun(best.obj, cfg);
  if (!res || !res.ok) {
    return { ok: false, error: (res && res.error) || '存档校验未通过' };
  }

  const sink = opts.sink || (() => {});
  const ui = createUiAdapter({ autoAnswer: true, sink });
  const game = new Game(cfg, ui, Math.random);
  game.s = res.state;
  game.onForceSave = () => saveCurrentRun(game);
  game.rehydrate();

  return { ok: true, game, cfg, turn: Number(game.s && game.s.turn) || 0 };
}

/**
 * 推进一步：一个完整回合。
 * @returns {Promise<boolean>} 是否还能继续（false 表示已结算）
 */
export async function playTurn(game) {
  if (!game || !game.s || game.s.over) return false;
  await game.playTurn();
  return !(game.s && game.s.over);
}

/**
 * 视图模型：把引擎状态投影成渲染真正需要的最小字段集。
 * 刻意保持扁平与轻量 —— 这是唯一允许进入 setData 的东西。
 */
export function project(game) {
  const s = game && game.s;
  if (!s) return null;

  const cell = typeof game.currentCell === 'function' ? game.currentCell() : null;
  const attrs = s.attrs || {};
  const battle = s.battle || {};
  const log = Array.isArray(s.log) ? s.log : [];

  return {
    playerName: s.playerName || '',
    schoolName: (s.school && s.school.name) || '',
    turn: Number(s.turn) || 0,
    lap: Number(s.lap) || 1,
    phase: s.phase || '',
    inspiration: Number(s.inspiration) || 0,
    inspirationMax: Number(s.inspirationMax) || 0,
    pos: Number(s.pos) || 0,
    cellName: (cell && cell.name) || '',
    cellType: (cell && cell.type) || '',
    attrRows: ATTR_ORDER.map((key) => ({
      key,
      name: ATTR_NAMES[key] || key,
      value: Number(attrs[key]) || 0,
    })),
    battle: {
      win: Number(battle.win) || 0,
      draw: Number(battle.draw) || 0,
      loss: Number(battle.loss) || 0,
      streak: Number(battle.streak) || 0,
    },
    passiveCount: (s.passive || []).length,
    activeCount: (s.active || []).length,
    // 引擎的日志条目是 { turn, text, ...meta }，只取渲染需要的两个字段
    logRows: log.slice(-6).map((entry) => ({
      turn: Number(entry && entry.turn) || 0,
      text: String((entry && entry.text) || entry || ''),
    })),
    over: !!s.over,
    endReason: s.endReason || '',
  };
}

/** 把 summary 转成结算页可直接渲染的形状 */
export function projectSummary(summary) {
  if (!summary) return null;
  return {
    total: Number(summary.total) || 0,
    reason: summary.reason || '',
    reasonText: summary.reasonText || '对局结束',
    grade: summary.grade ? { id: summary.grade.id, name: summary.grade.name } : null,
    sixDim: Array.isArray(summary.sixDim)
      ? summary.sixDim.map((d) => ({ key: d.key, name: d.name || d.key, score: Number(d.score) || 0 }))
      : [],
    endScroll: summary.endScroll || null,
    inkEpilogue: summary.inkEpilogue || '',
    narrativeEpilogue: summary.narrativeEpilogue || '',
  };
}
