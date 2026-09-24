// UI 适配器：引擎回调 → 事件流，以及「玩家决策」的挂起通道
//
// 引擎不直接碰 DOM，它通过注入的 ui 对象反向调用：floatAttrs / showQuiz / runBattle …
// 小程序没有 DOM，这条通道改造成两条支路：
//
//  1. 通知类（飘字、提示、状态同步）：转成事件交给 sink，由页面自行决定要不要渲染。
//  2. 决策类（答题、战斗、抉择）：必须拿到返回值引擎才能继续。
//     适配器发一个 request 事件并挂起 Promise；页面渲染界面、玩家操作后调用 evt.resolve(value)，
//     引擎的 await 才得以继续。若页面返回 false（该界面还没实装），则回退自动应答，流程不会卡死。
//
// 这份适配器同时被小程序页面和 Node 自检复用，因此不能引用 wx。

import { ATTR_NAMES, CREATIVE_KEYS } from '../engine/rules.js';

const DEFAULT_PASSIVE_MAX = 8;

function pickStrongestStyle(session) {
  const attrs = session && session.playerAttrs ? session.playerAttrs : {};
  const pool = CREATIVE_KEYS.filter((st) => !session || session.canUseStyle(st));
  const usable = pool.length ? pool : ['shi'];
  let best = usable[0];
  for (const st of usable) if ((attrs[st] || 0) > (attrs[best] || 0)) best = st;
  return best;
}

/* ---------------- 投影：把引擎对象压成可进 setData 的扁平数据 ---------------- */

function projectQuiz(q, opt) {
  const options = Array.isArray(q && q.options) ? q.options : [];
  return {
    id: (q && q.id) || '',
    type: (q && q.type) || 'knowledge',
    category: (q && q.category) || '',
    stem: (q && q.stem) || '',
    scenario: (q && q.scenario) || '',
    options: options.map((text, i) => ({
      index: i,
      text: typeof text === 'string' ? text : String(text),
    })),
    seconds: (opt && opt.seconds) || 0,
    // 超时与答对与否由引擎判定，界面只负责回传玩家选了哪一项
    answer: Number.isInteger(q && q.answer) ? q.answer : 0,
    analysis: (q && q.analysis) || '',
  };
}

function projectEvent(ev) {
  if (!ev) return null;
  return {
    id: ev.id || '',
    name: ev.name || ev.title || '奇遇',
    text: ev.text || ev.desc || '',
    options: (ev.options || []).map((o, i) => ({
      index: i,
      text: o.text || o.label || '',
      desc: o.desc || '',
    })),
  };
}

function projectSky(card) {
  if (!card) return null;
  return {
    name: card.name || '天象',
    desc: card.desc || card.text || '',
    effect: card.effect || null,
  };
}

function projectBattle(session) {
  if (!session) return null;
  const manners = session.manners || [];
  const mannerNames = session.mannerNames || {};
  return {
    label: session.label || '挥毫论道',
    topic: session.topic || '',
    themeName: session.themeName || '',
    npcName: (session.npc && (session.npc.fullName || session.npc.name)) || '对手',
    npcDesc: (session.npc && (session.npc.desc || session.npc.title)) || '',
    inspiration: Number(session.inspiration) || 0,
    styles: CREATIVE_KEYS.map((key) => ({
      key,
      name: ATTR_NAMES[key] || key,
      score: Math.round(Number(session.styleScore ? session.styleScore(key) : 0) || 0),
      usable: session.canUseStyle ? session.canUseStyle(key) : true,
      hint: (session.styleHint && session.styleHint(key)) || '',
    })),
    manners: manners.map((key) => ({
      key,
      name: mannerNames[key] || key,
      affinity: Math.round(Number(session.affinityOf ? session.affinityOf(key) : 0) * 100) / 100,
      stars: (session.starsOf && session.starsOf(key)) || 0,
    })),
    // 主动文心：本场可消费的一次性能力
    actives: (session.activeTalents || []).map((t, i) => ({
      index: i,
      id: t.id,
      name: t.name,
      desc: (t.effect && t.effect.desc) || t.desc || '',
    })),
  };
}

function projectTalentChoice(talent, list) {
  return {
    incoming: talent ? { id: talent.id, name: talent.name, desc: talent.desc || '' } : null,
    owned: (list || []).map((t, i) => ({
      index: i,
      id: t.id,
      name: t.name,
      desc: t.desc || '',
    })),
  };
}

/**
 * @param {object} options
 * @param {(evt:object)=>boolean|void} options.sink 事件出口。
 *        收到 request 事件时返回 true 表示页面接管；返回 false/undefined 则自动应答。
 */
export function createUiAdapter(options = {}) {
  const sink = typeof options.sink === 'function' ? options.sink : () => {};
  const emit = (type, payload) => sink(Object.assign({ type }, payload || {}));

  /**
   * 发起一次「玩家决策」。
   * view 是可序列化的数据（进 setData），raw 是引擎原始对象（挂页面实例，绝不进 data）。
   */
  function request(key, view, raw, fallback) {
    return new Promise((resolve) => {
      let taken = false;
      try {
        taken = sink({ type: 'request', key, view, raw, resolve }) === true;
      } catch (err) {
        console.error('[ui-adapter] sink 处理 request 失败', key, err);
      }
      if (!taken) {
        // 该界面尚未实装：回退自动应答，保证链路不断
        resolve(typeof fallback === 'function' ? fallback() : fallback);
      }
    });
  }

  /* ---------------- 自动应答（兜底） ---------------- */
  const auto = {
    quiz: (q) => ({ index: Number.isInteger(q && q.answer) ? q.answer : 0, timedOut: false }),
    replaceTalent: (list) =>
      Array.isArray(list) && list.length >= DEFAULT_PASSIVE_MAX ? list.length - 1 : null,
    bowen: () => 'broad',
    scenic: () => false,
    scenicTalent: (candidates) => (Array.isArray(candidates) ? candidates[0] : null),
    sideQuest: (routes) => (Array.isArray(routes) ? routes[0] : null),
    sideQuestFinal: () => null,
    stageChange: () => '',
    plannedMove: () => null,
    palaceIntro: () => null,
    hiddenFinal: () => false,
    event: (ev) => (ev && Array.isArray(ev.options) && ev.options.length ? 0 : null),
  };

  return {
    /* ---------- 通知类 ---------- */
    floatAttrs: (out, _anchor, reason) => emit('attrs', { values: out, reason }),
    floatInspiration: (real, reason) => emit('inspiration', { value: real, reason }),
    floatInspirationMax: (real, reason) => emit('inspirationMax', { value: real, reason }),
    recordLog: (entry) => emit('log', { entry }),
    toast: (text) => emit('toast', { text }),
    onState: (s) => emit('state', { state: s }),
    showChoiceEcho: (echo) => emit('choiceEcho', { echo }),
    showEventEcho: (echo) => emit('eventEcho', { echo }),
    showDice: (d) => emit('dice', { value: d }),
    movePiece: (s) => emit('move', { state: s }),
    highlightCell: (c) => emit('highlight', { cell: c }),
    syncStageRing: (s) => emit('stageRing', { state: s }),
    skyExpired: (card) => emit('skyExpired', { card }),
    showZeitgeist: (z) => emit('zeitgeist', { z }),
    showQuizResult: (q, ans, ok) => emit('quizResult', { ok, ans }),
    showTalentGain: (t, meta) => emit('talentGain', { talent: t, meta }),
    showSideQuestAct: (route, act, meta) => emit('sideQuestAct', { route, act, meta }),
    showSideQuestComplete: (route, state) => emit('sideQuestComplete', { route, state }),
    showSideQuestJournal: (journal) => emit('sideQuestJournal', { journal }),

    /* ---------- 决策类 ---------- */
    async showQuiz(q, opt) {
      return request('quiz', projectQuiz(q, opt), q, () => auto.quiz(q));
    },

    async showEvent(ev) {
      return request('event', projectEvent(ev), ev, () => auto.event(ev));
    },

    async showSky(card) {
      return request('sky', projectSky(card), card, undefined);
    },

    async showBowenChoice() {
      return request('bowen', null, null, auto.bowen);
    },

    async askReplaceTalent(talent, list) {
      return request('replaceTalent', projectTalentChoice(talent, list), list, () =>
        auto.replaceTalent(list)
      );
    },

    async askScenic(_cell, _cost, _curInsp, _meta) {
      return request('scenic', null, null, auto.scenic);
    },

    async chooseScenicTalent(candidates) {
      return request('scenicTalent', null, candidates, () => auto.scenicTalent(candidates));
    },

    async chooseSideQuest(routes) {
      return request('sideQuest', null, routes, () => auto.sideQuest(routes));
    },

    async askSideQuestFinal(meta) {
      return request('sideQuestFinal', null, meta, auto.sideQuestFinal);
    },

    async showStageChange(gate, state) {
      return request('stageChange', { gate }, state, auto.stageChange);
    },

    async showPlannedMovePrompt(gameRef) {
      return request('plannedMove', null, gameRef, auto.plannedMove);
    },

    async showPalaceIntro(themes, names, inkSummary, questions, echoes, sideQuestFinal, draft) {
      return request(
        'palaceIntro',
        { themes, names, inkSummary, hasFinal: !!sideQuestFinal },
        draft,
        auto.palaceIntro
      );
    },

    async askHiddenFinal(meta) {
      return request('hiddenFinal', meta, null, auto.hiddenFinal);
    },

    showPrologue: () => emit('prologue', {}),
    showBattleTutorial: () => emit('battleTutorial', {}),
    showLap2Intro: () => emit('lap2Intro', {}),
    showHiddenFinalRing: () => emit('hiddenFinalRing', {}),
    showHiddenFinalVictory: (out) => emit('hiddenFinalVictory', { out }),
    showHiddenFinalDefeat: (out) => emit('hiddenFinalDefeat', { out }),

    /* ---------- 战斗：交给页面驱动六步对决 ---------- */
    async runBattle(session) {
      // 页面接管后自己在里面走完 选文体 → 选风格 → 掷骰 → 追加 → 收笔，
      // 最后把 session.resolve(...) 的结果交回引擎。
      return request('battle', projectBattle(session), session, () =>
        session && typeof session.resolve === 'function'
          ? session.resolve(pickStrongestStyle(session), (session.manners || [])[0] || 'wanyue', [
              1 + Math.floor(Math.random() * 6),
            ])
          : null
      );
    },

    /* ---------- 结算 ---------- */
    async showResult(summary) {
      emit('result', { summary });
    },
  };
}

export default createUiAdapter;
