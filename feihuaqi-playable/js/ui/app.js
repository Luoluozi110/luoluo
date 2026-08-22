/**
 * app.js —— 主控制器：装配 引擎(Game) + 表现层(BoardView/Hud/Modals/BattleStage/AlbumUI)
 * 并实现 game.js 所需的 ui 适配器接口，
 * 串起「选流派 → 装配名篇 → 对局 → 新解锁 → 结算」全流程。
 */
import { loadConfig, configSource, applyProjectOverride, loadCloudUrl } from '../engine/config.js?v=20260822secretfinal1';
import { Game } from '../engine/game.js?v=20260822secretfinal1';
import { BoardView } from './board.js?v=20260822secretfinal1';
import { Hud, radarSVG } from './hud.js?v=20260822secretfinal1';
import { Modals } from './modals.js?v=20260822secretfinal1';
import { BattleStage } from './battle.js?v=20260822secretfinal1';
import { AlbumUI } from './album.js?v=20260822secretfinal1';
import { CodexUI } from './codex.js?v=20260822secretfinal1';
import { SCHOOL_EMBLEM, ensureDefs } from './svg.js?v=20260822secretfinal1';
import { initQuality, getTier, setTier } from './quality.js?v=20260822secretfinal1';
import { ATTR_NAMES } from '../engine/rules.js?v=20260822secretfinal1';
import * as Album from '../engine/album.js?v=20260822secretfinal1';
import * as Codex from '../engine/codex.js?v=20260822secretfinal1';
import { initAudio } from './audio.js?v=20260822secretfinal1';
import { setScene, setTension, setStage } from './music.js?v=20260822secretfinal1';
import { saveRun, loadRun, hasRun, clearRun, deserializeRun, loadBestRun, listRuns, RUN_SAVE_KEY, RUN_SAVE_MANUAL_KEY } from '../engine/save.js?v=20260822secretfinal1';
import { Leaderboard } from './leaderboard.js?v=20260822secretfinal1';
import { personalize } from './namefmt.js?v=20260822secretfinal1';
import { ContentTestUI } from './contentTest.js?v=20260822contenttest1';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

let cfg, cloudBaseCfg, cloudProject = null, customProject = null, board, hud, modals, battle, schoolEl, resultEl, albumUI, codexUI, contentTestUI;
let game = null;
let rolling = false;
let menuEl = null;
let menuOv = null;
let customConfigActive = false;
let cloudConfigUrl = '';     // 云端配置地址（部署级 cloud.json 或本机 localStorage 覆盖）
let cloudConfigActive = false;
let cloudSyncPromise = Promise.resolve(null);
let cloudSyncRunning = false;
let cloudSyncNotice = '';
let leaderboardInitPromise = null;

// 云端工程配置须兼顾“编辑器发布后可更新”与“弱网不拖住首屏”。
// 成功结果会被本机缓存，下一次启动先用已验证版本显示菜单，再在后台限时检查更新。
// 三圈版本使用独立缓存槽，避免旧单环工程配置覆盖正式地图。
const CLOUD_CACHE_KEY = 'feihua_cloud_config_cache_v3_staged_rings';
const LEGACY_CLOUD_CACHE_KEY = 'feihua_cloud_config_cache_v2_ringfix';
const CLOUD_REQUEST_TIMEOUT_MS = 3500;

/** index.html 已带静态骨架；缺失时补建，保证 app.js 单独引用也能跑 */
function ensureSkeleton() {
  if ($('#scene')) return;
  $('#app').innerHTML = `
    <div id="scene"></div>
    <div id="hud"></div>
    <div id="modalLayer"></div>
    <div id="battleStage"></div>
    <div id="schoolScreen"></div>
    <div id="loadout-screen"></div>
    <div id="album-screen"></div>
    <div id="codex-screen"></div>
    <div id="content-test-screen"></div>
    <div id="resultScreen"></div>
    <div id="topLayer"></div>
    <button id="soundToggle" type="button"></button>`;
}

async function boot() {
  ensureSkeleton();
  initQuality();  // 尽早定档：在 <html> 写 data-quality，board 构建前生效
  ensureDefs();   // 共享体积资源：格子图标/名胜/流派徽记引用

  // 音效：挂解锁钩子（首次交互后才建 AudioContext）+ 全局点击音 + 静音开关
  initAudio($('#soundToggle'));
  // 配乐：待机/标题界面 BGM（首次交互后真正起播）
  setScene('idle');

  // 主菜单与图鉴/名篇操作只需配置，不需要预先构建完整棋盘与 HUD。
  // 先用本地已验证的云端缓存（若有）合并，立即显示菜单；网络刷新在后台限时进行。
  await prepareCloudConfig();
  schoolEl = $('#schoolScreen');
  resultEl = $('#resultScreen');
  modals = new Modals($('#modalLayer'), cfg);
  albumUI = new AlbumUI({
    loadoutEl: $('#loadout-screen'),
    albumEl: $('#album-screen'),
    layerEl: $('#modalLayer'),
    topEl: $('#topLayer'),
    cards: cfg.album || []
  });
  codexUI = new CodexUI({ el: $('#codex-screen'), cfg });
  contentTestUI = new ContentTestUI({ el: $('#content-test-screen'), cfg });

  buildMenu();
  openSchoolScreen({ resync: false });
  if (new URLSearchParams(location.search).get('test') === 'content') openContentTest();
  if (cloudSyncNotice) announceCloudSync();
}

/**
 * 首次真正进入棋局时再创建高成本的棋盘/HUD；重复调用安全。
 * 创建前先等待后台云端同步收尾，保证 BoardView 基建在完成合并后的 cfg 上、
 * 复现地图编辑器覆盖，同时菜单首屏不受云端请求拖延。
 */
async function ensureGameUi() {
  await waitForCloudBeforeGame();   // 同步 Promise 不忙时立即通过
  // 云端/本机工程覆盖可以替换 board；已有棋盘必须同源重建，不能让 Game 与 BoardView 各持一份地图。
  if (!board) board = new BoardView(cfg, $('#scene'));
  // ensureGameUi 只在“新局 / 读档”边界调用；此时允许原子重建，保证引擎和棋盘使用同一份 cfg。
  else if (board.cfg !== cfg) board.rebuild(cfg, null);
  if (battle && battle.cfg !== cfg) battle.cfg = cfg;
  if (!hud) {
    hud = new Hud($('#hud'));
    if (cfg.inspiration && cfg.inspiration.lowWarning) hud.lowWarning = cfg.inspiration.lowWarning;
    hud.onTalent = t => modals.showTalentDetail(t);
    hud.onRoll(onRoll);
    hud.onPlan(onPlan);
    hud.onAbility(onAbility);
    hud.onViewAngle(() => {
      if (!board) return;
      const state = board.cycleViewAngle();
      hud.setViewAngleState(state);
      hud.toast(`地图视角：${state.label} ${state.angle}°`);
    });
  }
  board.onViewChange = state => hud.setViewAngleState(state);
  hud.setViewAngleState(board.getViewAngleState());
  if (!battle) battle = new BattleStage($('#battleStage'), cfg);
  ensureLeaderboard();
}

/** 排行榜配置不进入首屏关键路径；首次需要排行榜能力或开启对局时再读取。 */
function ensureLeaderboard() {
  if (!leaderboardInitPromise) leaderboardInitPromise = Leaderboard.init(modals).catch(() => false);
  return leaderboardInitPromise;
}


/* ---------------------------------------------------- 阶段 → 配乐移调 */

/**
 * 把游戏进度(0..1)映射为科考阶段 0..4，驱动配乐「五声调式内移调」。
 * 阈值与 config/npcs.json 的 tier.range 对齐：童生[0,0.25)→0，秀才[0.25,0.5)→1，
 * 举人[0.5,0.75)→2，进士[0.75,1)→3，主考官(殿试,=1)→4。
 */
function stageFromProgress(p) {
  if (p >= 1) return 4;
  if (p >= 0.75) return 3;
  if (p >= 0.5) return 2;
  if (p >= 0.25) return 1;
  return 0;
}

/* ---------------------------------------------------- 选流派屏 */
function openSchoolScreen(opts = {}) {
  if (opts.resync !== false) maybeResyncCloud();   // 返回主菜单时再静默检查更新，首次启动避免重复请求
  showMenuButton(false);
  setScene('idle');            // 返回待机/标题界面：恢复待机配乐
  setStage(game ? stageFromProgress(game.progress()) : 0); // 待机主题按当前所处阶段移调
  clearRunIfFinished();
  buildSchoolScreen();
  resultEl.classList.remove('on');
  albumUI.closeLoadout();
  albumUI.closeAlbum();
  codexUI.close();
  schoolEl.classList.add('on');
}

/** 本局已结束时，清理「继续上局」入口（逐槽检查，只清已结束的槽） */
function clearRunIfFinished() {
  for (const r of listRuns()) if (r.over) clearRun(r.slot);
}

/* ------------------------------------------------ 存档管线（v2） */
let lastAutoSave = 0;

/** 把自动保存挂到引擎的「安全保存点」回调上 */
function wireGameSaves(g) {
  g.onSavePoint = () => autoSaveRun(g);
  // 升级等「玩家主动推进」操作调用：立即落盘，避免升级后到下一存档点前重载导致回退。
  // 同步手动槽（若存在且未结束），保证「继续上局」从自动/手动任一槽读都反映最新进度。
  g.onForceSave = () => forceSaveRun(g);
}

/**
 * 强制落盘（升级等主动推进时调用）：写入自动槽，并同步手动槽（若存在且未结束）。
 * 与 autoSaveRun 的区别：跳过防抖、且把手动槽一并刷新，确保「继续上局」无论读哪个槽都拿到最新进度。
 */
function forceSaveRun(g) {
  if (!g || !g.s || g.s.over) return;
  const a = saveRun(g, RUN_SAVE_KEY);
  const m = loadRun(RUN_SAVE_MANUAL_KEY);
  if (m && !m.__corrupt && m.state && !m.state.over) saveRun(g, RUN_SAVE_MANUAL_KEY);
  if (a.where !== 'local') hud.toast('本地存储不可用，本次进度仅暂存于内存/会话（关闭页面将丢失）');
  else if (a.tooBig) hud.toast('存档体积较大，建议及时结算本局');
}

/**
 * 自动存档（写入自动槽）。带 300ms 防抖：殿试等流程一回合内可能触发多次保存点。
 * force=true 时跳过防抖（开局首存）。
 */
function autoSaveRun(g, force = false) {
  if (!g || !g.s || g.s.over) return;
  const now = Date.now();
  if (!force && now - lastAutoSave < 300) return;
  lastAutoSave = now;
  const r = saveRun(g);
  if (!r.ok) return;
  if (r.where !== 'local') hud.toast('本地存储不可用，本次进度仅暂存于内存/会话（关闭页面将丢失）');
  else if (r.tooBig) hud.toast('存档体积较大，建议及时结算本局');
}

function buildSchoolScreen() {
  const store = Album.loadStore();
  const masteryOf = sch => (store.mastery && store.mastery[sch.id]) || { xp: 0, level: 1 };
  const cards = cfg.schools.map(sch => {
    const tal = (cfg.talents || []).find(t => t.id === sch.talent);
    const bonusTxt = `入门 ${ATTR_NAMES[sch.attr]} +${cfg.attrs.schoolBonus ?? 3} · 初授文心「${tal ? tal.name : '—'}」`;
    const m = masteryOf(sch);
    const isMax = m.level >= Album.MASTERY_LEVELS;
    const next = isMax ? null : Album.MASTERY_THRESHOLDS[m.level];
    const prev = Album.MASTERY_THRESHOLDS[m.level - 1];
    const widthPct = next == null ? 100 : Math.min(100, Math.max(0, ((m.xp - prev) / (next - prev)) * 100));
    const masteryLine = isMax
      ? `<div style="color:var(--zhu);font-size:var(--text-meta);letter-spacing:.08em">造诣 ${Album.masteryLevelName(m.level)}</div>`
      : `<div style="display:flex;align-items:center;gap:6px;font-size:var(--text-micro);color:var(--mo-3);letter-spacing:.06em;min-width:0">
           <span>造诣 Lv${m.level} ${Album.masteryLevelName(m.level)}</span>
           <span style="flex:1;min-width:40px;height:4px;background:rgba(128,112,96,.15);border-radius:2px;overflow:hidden">
             <span style="display:block;height:100%;width:${widthPct.toFixed(1)}%;background:var(--zhu)"></span>
           </span>
           <span>${m.xp}/${next}</span>
         </div>`;
    return `
      <button class="school-card" data-id="${sch.id}">
        <div class="emblem">${SCHOOL_EMBLEM[sch.attr] || ''}</div>
        <h3>${sch.name}</h3>
        ${sch.motto ? `<div class="motto">${sch.motto}</div>` : ''}
        ${sch.flavor ? `<div class="flavor">${sch.flavor}</div>` : ''}
        ${masteryLine}
        <div class="meta">${esc(bonusTxt)}</div>
      </button>`;
  }).join('');

  const src = Object.entries(configSource).map(([k, v]) => `${k}←${v}`).join('　');
  const canContinue = hasRun();
  // 续玩存档摘要：槽位（手动/自动）+ 回合 + 时间
  const contRun = canContinue
    ? (listRuns().filter(r => !r.over).find(r => r.manual) || listRuns().filter(r => !r.over)[0])
    : null;
  const contInfo = contRun
    ? `${contRun.manual ? '手动存档' : '自动存档'} · 第 ${contRun.turn} 回合 · ${contRun.savedAt ? new Date(contRun.savedAt).toLocaleTimeString('zh-CN', { hour12: false }) : ''}`
    : '检测到未完成的存档，可从中断处续玩';

  // 图鉴阁入口：展示已邂逅对手数（跨局累计）
  const npcs = cfg.npcs || [];
  const foesTotal = npcs.reduce((a, t) => a + ((t.npcs || []).length || 0), 0);
  const foesGot = npcs.reduce((a, t) =>
    a + (t.npcs || []).filter(n => Codex.hasFoe(t.id, n.name)).length, 0);

  schoolEl.innerHTML = `
    <div class="school-inner scroll-frame paper" style="max-width:min(1080px,calc(100vw - var(--safe-left) - var(--safe-right) - 24px));border-radius:14px">
      <div class="title-ink" style="font-size:40px;text-align:center">選 擇 流 派</div>
      <div class="subtitle" style="text-align:center;margin-top:6px">三派各有所长，落子无悔，且赴科场。</div>
      ${canContinue ? `<div style="text-align:center;margin:10px 0 4px"><button class="btn btn-primary" data-continue style="font-size:18px;padding:12px 30px;letter-spacing:.12em">▶ 继续上局</button>
        <div style="font-size:var(--text-meta);color:var(--mo-3);margin-top:6px;line-height:1.6">${contInfo}</div></div>` : ''}
      <div class="school-grid">${cards}</div>
      <div class="school-actions" style="text-align:center;margin-top:16px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-ink" data-album>传世名篇（已解锁 ${store.unlocked.length}/${(cfg.album || []).length}）</button>
        <button class="btn btn-ink" data-codex>图鉴阁（已邂逅 ${foesGot}/${foesTotal}）</button>
        <button class="btn btn-ink" data-save-transfer>存档码（导入／导出）</button>
        <button class="btn btn-test" data-content-test>版本测试 · 全内容解锁</button>
      </div>
      <div style="font-size:var(--text-meta);color:var(--mo-3);letter-spacing:.08em;margin-top:8px;text-align:center;line-height:1.65">
        择定流派后，可于「装配名篇」中携带至多 ${Album.LOADOUT_MAX} 张图鉴卡入局。
      </div>
      <div style="text-align:center;font-size:var(--text-micro);color:var(--mo-3);letter-spacing:.1em;margin-top:12px;line-height:1.55">
        配置来源：${src}
      </div>
    </div>`;

  schoolEl.querySelectorAll('.school-card').forEach(b =>
    b.addEventListener('click', () => openLoadout(b.dataset.id)));
  schoolEl.querySelector('[data-album]').addEventListener('click', () =>
    albumUI.openAlbum({ onBack: () => { buildSchoolScreen(); } }));
  schoolEl.querySelector('[data-codex]')?.addEventListener('click', () => codexUI.open('foes'));
  schoolEl.querySelector('[data-save-transfer]')?.addEventListener('click', () => albumUI.openSaveTransfer());
  schoolEl.querySelector('[data-content-test]')?.addEventListener('click', openContentTest);
  const cont = schoolEl.querySelector('[data-continue]');
  if (cont) cont.addEventListener('click', () => loadGame());
}

/* ---------------------------------------------------- 版本测试页 */
function openContentTest() {
  schoolEl.classList.remove('on');
  albumUI.closeLoadout();
  albumUI.closeAlbum();
  codexUI.close();
  setScene('menu');
  contentTestUI.open({
    onBack: () => openSchoolScreen({ resync: false }),
    onChanged: () => { if (schoolEl.classList.contains('on')) buildSchoolScreen(); }
  });
}

/* ---------------------------------------------------- 装配屏 */
function openLoadout(schoolId) {
  const school = cfg.schools.find(s => s.id === schoolId) || cfg.schools[0];
  schoolEl.classList.remove('on');
  setScene('menu');           // 装配名篇：菜单配乐
  albumUI.openLoadout({
    schoolName: school.name,
    onStart: picked => openNameScreen(schoolId, picked),
    onBack: () => openSchoolScreen(),
    onAlbum: () => albumUI.openAlbum({ onBack: () => {} })
  });
}

/* ---------------------------------------------------- 开局起名屏 */
/** 装配名篇后、真正开局前，让玩家为自己的角色起名；点「返回」回装配屏 */
async function openNameScreen(schoolId, loadout) {
  albumUI.closeLoadout();   // 收起装配屏，名号弹窗独占画面
  const name = await modals.showNamePrompt('');
  if (name === null) { openLoadout(schoolId); return; }
  await startGame(schoolId, loadout, name);
}

async function startGame(schoolId, loadout, playerName) {
  await ensureGameUi();   // 保证棋盘/HUD 就绪，且基于已完成合并的云端配置构建
  schoolEl.classList.remove('on');
  resultEl.classList.remove('on');
  albumUI.closeLoadout();
  albumUI.closeAlbum();
  board.setVisibleRing?.('outer');
  board.setPiecePos(0);
  board.clearHint();
  board.cellEls.forEach(e => e.classList.remove('active'));

  game = new Game(cfg, makeUi(), Math.random);
  wireGameSaves(game);
  game.onVictory = (nm, sc) => Leaderboard.submit(nm, sc).catch(() => {});   // 通关 → 提交云端排行榜
  const cards = loadout || [];
  const s = game.start(schoolId, { loadout: cards, name: playerName || '' });
  modals.playerName = s.playerName || '';   // 叙事文本据此替换「你」
  modals.game = game;                       // 文心升级：详情弹窗调用引擎 upgradeTalent
  // 新局进入棋盘前先展示序章；序章只出现一次，并随存档记录。
  if (!s.prologueSeen && typeof modals.showPrologue === 'function') {
    await modals.showPrologue();
    s.prologueSeen = true;
  }
  if (cards.length) hud.toast(`行囊生效：${cards.map(c => `「${c.name}」`).join('')}`);
  hud.render(s);
  showMenuButton(true);
  setScene('board');          // 进入对局：行进配乐
  setTension(0);
  setStage(stageFromProgress(game.progress())); // 按当前科考阶段移调（宫→商→角→徵→羽）
  autoSaveRun(game, true); // 开局即存（跳过防抖），关闭后可从「继续上局」恢复
  hud.toast('手机端可拖动棋盘平移、双指缩放；随时点右上角菜单存档');
  enableRoll();
}

/* ---------------------------------------------------- ui 适配器 */
function makeUi() {
  return {
    floatAttrs(out, anchor, reason) {
      const txt = Object.entries(out)
        .map(([k, v]) => `${ATTR_NAMES[k]} ${v > 0 ? '+' : ''}${v}`).join('　');
      if (txt) board.float(txt, 'ink-up');
      hud.recordChange({ kind: 'attr', values: out, reason });
    },
    floatInspiration(real, reason) {
      board.float(`灵感 ${real > 0 ? '+' : ''}${real}`, real >= 0 ? 'ink-up' : 'ink-down');
      hud.recordChange({ kind: 'inspiration', value: real, reason });
    },
    floatInspirationMax(real, reason) {
      board.float(`灵感上限 +${real}`, 'ink-up');
      hud.recordChange({ kind: 'inspiration-max', value: real, reason });
    },
    recordLog: entry => hud.recordLog(entry),
    showTalentGain: t => modals.showTalentGain(t),
    askReplaceTalent: (t, list) => modals.askReplaceTalent(t, list),
    onState(s) { hud.render(s); },
    skyExpired(card) { hud.toast(`${card.name} 之效已散`); },
    showDice: d => board.showDice(d),
    showPlannedMovePrompt: gameRef => modals.showPlannedMovePrompt(gameRef),
    movePiece: s => board.movePiece(s),
    toast: t => hud.toast(t),
    showChoiceEcho: echo => hud.choiceEcho({
      choiceText: personalize(echo.choiceText, modals.playerName),
      resultText: personalize(echo.resultText, modals.playerName)
    }),
    highlightCell: c => board.highlight(c),
    showQuiz: (q, opt) => modals.showQuiz(q, opt),
    showQuizResult: (q, ans, ok) => modals.showQuizResult(q, ans, ok),
    showEvent: ev => modals.showEvent(ev),
    showBowenChoice: () => modals.showBowenChoice(),
    showSky: c => modals.showSky(c),
    showPrologue: () => modals.showPrologue(),
    showLap2Intro: () => modals.showLap2Intro(),
    // 引擎明确要求同步圈层；不再让阶段弹窗承担唯一的状态切换职责。
    syncStageRing: s => board.revealRouteState(s),
    showStageChange: async gate => {
      if (modals.showStageChange) await modals.showStageChange(gate);
    },
    showZeitgeist: z => modals.showZeitgeist(z),
    askScenic: (cell, cost, curInsp) => modals.askScenic(cell, cost, curInsp),
    runBattle: async sess => {
      setScene('battle');     // 挥毫论战：切 combat 配乐
      setTension(0.7);
      const out = await battle.run(sess);
      setScene('board');      // 战后回到对局配乐
      setTension(0);
      setStage(stageFromProgress(game.progress())); // 战后阶段可能已进阶，重新移调
      return out;
    },
    showPalaceIntro: () => modals.showPalaceIntro(),
    askHiddenFinal: meta => modals.askHiddenFinal(meta),
    showHiddenFinalRing: async () => {
      setScene('board');
      setTension(0.25);
      if (board.showHiddenFinalRing) await board.showHiddenFinalRing();
      setTension(0.55);
    },
    showHiddenFinalVictory: (out, npc) => modals.showHiddenFinalVictory(out, npc),
    showHiddenFinalDefeat: (out, npc) => modals.showHiddenFinalDefeat(out, npc),
    showResult: sum => showResult(sum)
  };
}

function enableRoll() {
  if (!game || game.s.over) return;
  board.hintRange(game.s);
  hud.setRollEnabled(true, '掷骰');
}

async function onRoll() {
  if (!game || game.s.over || rolling) return;
  rolling = true;
  hud.setRollEnabled(false);
  board.clearHint();
  try {
    await game.playTurn();
  } catch (e) {
    console.error(e);
    hud.toast('对局异常：' + (e && e.message || e));
  }
  rolling = false;
  if (game && !game.s.over) enableRoll();
  // 每回合的自动落盘已改由引擎「安全保存点」回调（onSavePoint）触发，此处不再重复存档
}

/** 布局谋篇：玩家主动点击 HUD 的「布局谋篇」按钮时触发（非阻塞）。
 *  打开定策弹窗，定策值写入 game.s.plannedMoveDice，于下一次掷骰时生效。 */
function onPlan() {
  if (!game || game.s.over || rolling) return;
  if (!game.s.active.some(t => (t.effect || {}).type === 'planned_dice')) return;
  if (game.s.plannedMoveDice != null) return;
  modals.showPlannedMovePrompt(game);
}

/** 三功修习：集中管理心得、研修位与稿本，避免每场战后连续弹窗。 */
function onAbility() {
  if (!game || game.s.over || rolling) return;
  modals.showAbilityPanel(game);
}

/* ---------------------------------------------------- 菜单 / 随时存档 */
const MENU_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2.4" fill="currentColor" stroke="none"/><circle cx="8" cy="18" r="2.4" fill="currentColor" stroke="none"/></svg>`;

function buildMenu() {
  if (menuEl) return;
  const btn = document.createElement('button');
  btn.id = 'menuBtn';
  btn.type = 'button';
  btn.title = '菜单 / 存档';
  btn.setAttribute('aria-label', '菜单');
  btn.innerHTML = MENU_ICON;
  btn.style.display = 'none';
  btn.addEventListener('click', toggleMenu);
  document.body.appendChild(btn);
  menuEl = btn;
}

function showMenuButton(on) {
  if (menuEl) menuEl.style.display = on ? 'flex' : 'none';
}

function toggleMenu() {
  if (menuOv) { closeMenu(); return; }
  showMenu();
}

function closeMenu() {
  if (menuOv) { modals.close(menuOv); menuOv = null; }
  if (menuEl) menuEl.classList.remove('on');
}

function showMenu() {
  const canSave = !!(game && !game.s.over);
  const canLoad = hasRun();
  // 存档摘要：优先手动槽（保留关键节点），其次自动槽
  const runs = listRuns().filter(r => !r.over);
  const best = runs.find(r => r.manual) || runs[0] || null;
  const fmt = t => t ? new Date(t).toLocaleTimeString('zh-CN', { hour12: false }) : '';
  const loadLabel = best
    ? `读取存档（${best.manual ? '手动' : '自动'} · 第${best.turn}回合 · ${fmt(best.savedAt)}）`
    : '没有可用存档';
  const html = `
    <div class="modal paper compact-modal" style="width:min(360px,calc(100vw - var(--safe-left) - var(--safe-right) - 24px))">
      <div class="mtitle"><h2>桃 花 棋 · 菜 单</h2></div>
      <div class="menu-list">
        <button class="btn btn-ink menu-item" data-save ${canSave ? '' : 'disabled'}>${canSave ? '保存当前进度（手动存档）' : '暂无进行中的对局'}</button>
        <button class="btn btn-ink menu-item" data-load ${canLoad ? '' : 'disabled'}>${loadLabel}</button>
        <button class="btn btn-ink menu-item" data-save-transfer>存档码（导入／导出）</button>
        <button class="btn btn-ink menu-item" data-codex>图鉴阁</button>
        <button class="btn btn-ink menu-item" data-leaderboard>☁ 云端排行榜</button>
        <button class="btn btn-ink menu-item" data-custom>载入自定义配置（高级）</button>
        <button class="btn btn-ink menu-item" data-restart>返回主菜单</button>
        <button class="btn btn-ink menu-item" data-quality>${getTier() === 'low' ? '切换高画质' : '切换省电档'}</button>
        <button class="btn btn-ink menu-item" data-close>关闭</button>
      </div>
      <div style="font-size:12px;color:var(--mo-3);text-align:center;margin-top:12px;letter-spacing:.05em;line-height:1.7">
        每回合结束自动存档；「保存当前进度」另存为手动档，不被覆盖。<br/>
        关闭页面后，可从「主菜单 · 继续上局」恢复（读取时手动档优先）。
      </div>
    </div>`;
  const ov = modals.open(html, 'gameMenu');
  menuOv = ov;
  if (menuEl) menuEl.classList.add('on');
  ov.querySelector('[data-save]')?.addEventListener('click', () => { saveGame(); closeMenu(); });
  ov.querySelector('[data-load]')?.addEventListener('click', () => { closeMenu(); loadGame(); });
  ov.querySelector('[data-save-transfer]')?.addEventListener('click', () => {
    closeMenu();
    albumUI.openSaveTransfer({
      // 局内导出前把当前瞬时状态强制写入自动槽，避免导出上一个安全存档点。
      beforeExport: () => { if (game && game.s && !game.s.over) forceSaveRun(game); }
    });
  });
  ov.querySelector('[data-codex]')?.addEventListener('click', () => { closeMenu(); codexUI.open('foes'); });
  ov.querySelector('[data-leaderboard]')?.addEventListener('click', () => {
    closeMenu();
    ensureLeaderboard().then(() => Leaderboard.openModal());
  });
  ov.querySelector('[data-custom]')?.addEventListener('click', () => { closeMenu(); openCustomConfig(); });
  ov.querySelector('[data-restart]')?.addEventListener('click', () => { closeMenu(); openSchoolScreen(); });
  ov.querySelector('[data-quality]')?.addEventListener('click', () => {
    const next = getTier() === 'low' ? 'high' : 'low';
    setTier(next);
    if (board && board.applyQuality) board.applyQuality();   // 花瓣按新档重生成
    closeMenu(); showMenu();                                  // 重开菜单刷新标签
  });
  ov.querySelector('[data-close]')?.addEventListener('click', () => closeMenu());
  ov.addEventListener('click', e => { if (e.target === ov) closeMenu(); });
}

/* ------------------------------------------------------ 云端自动同步（编辑器发布 → 所有玩家共享） */

function isRingProject(project) {
  // 当前正式版本为 192 格三圈路线；不仅校验数量，也校验阶段门、route→cell id 和圈层语义。
  // 否则一份“看起来也是 192 格”的旧工程会让 Game 进入中圈、BoardView 却无法定位或揭示棋子。
  const board = project && project.board;
  if (!board || typeof board !== 'object') return true;
  const rings = Array.isArray(board.rings) ? board.rings : [];
  const sizes = rings.map(r => (r.cells || []).length);
  if (board.layout !== 'concentric_spiral'
    || !Array.isArray(board.mainRing) || board.mainRing.length !== 192
    || sizes.join(',') !== '72,64,56'
    || !Array.isArray(board.route) || board.route.length !== 192) return false;

  const cells = new Map(rings.flatMap(r => (r.cells || []).map(c => [Number(c.id), { cell: c, ring: r.id }])));
  const validStep = (index, ring, phase, transition) => {
    const step = board.route[index];
    const id = Number(step && (step.cellId ?? step.id));
    const physical = cells.get(id);
    const logical = board.mainRing[index];
    const gate = logical && logical.phaseGate;
    return step && step.ring === ring
      && physical && physical.ring === ring
      && logical && Number(logical.id) === id && logical.ring === ring
      && gate && gate.phase === phase && gate.transition === transition;
  };
  return validStep(72, 'middle', 'juren', 'middle')
    && validStep(136, 'inner', 'jinshi', 'inner');
}

function readCloudCache(url) {
  try {
    const cached = JSON.parse(localStorage.getItem(CLOUD_CACHE_KEY) || 'null');
    if (cached && cached.url === url && cached.project && typeof cached.project === 'object' && isRingProject(cached.project)) {
      return cached.project;
    }
    // 旧缓存只允许继续提供非地图内容；含旧单环 board 的缓存必须失效。
    const legacy = JSON.parse(localStorage.getItem(LEGACY_CLOUD_CACHE_KEY) || 'null');
    if (legacy && legacy.url === url && legacy.project && typeof legacy.project === 'object' && isRingProject(legacy.project)) {
      return legacy.project;
    }
  } catch (_) { /* 缓存损坏或旧格式直接忽略 */ }
  return null;
}

function writeCloudCache(url, project) {
  try { localStorage.setItem(CLOUD_CACHE_KEY, JSON.stringify({ url, project, savedAt: Date.now() })); }
  catch (_) { /* 缓存不可写不影响同步结果 */ }
}

/** 拉取云端配置：以 no-cache 复用 HTTP 缓存（ETag/304 不重下），并以 AbortController 限制弱网等待。
 *  不再追加 _cb 时间戳击穿缓存——GitHub raw 带 ETag，内容更新时条件请求会回 200 新体，
 *  未更新时回 304，重复访问零重传；同时保留「编辑器发布即生效」的语义。 */
async function fetchCloudConfig(url, opts = {}) {
  const timeoutMs = Number(opts.timeoutMs) || CLOUD_REQUEST_TIMEOUT_MS;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer;
  try {
    timer = setTimeout(() => controller && controller.abort(), timeoutMs);
    const res = await fetch(url, {
      cache: 'no-cache',
      signal: controller ? controller.signal : undefined
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const obj = await res.json();
    if (!obj || typeof obj !== 'object') throw new Error('云端配置格式无效');
    return obj;
  } catch (e) {
    if (!opts.silent && hud && hud.toast) {
      const msg = e && e.name === 'AbortError' ? '云端配置同步超时，已使用本地内容' : '云端配置拉取失败：' + (e.message || e);
      hud.toast(msg);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function composeProjects() {
  let next = cloudBaseCfg || cfg;
  if (cloudProject) next = applyProjectOverride(next, cloudProject, { requireType: true });
  if (customProject) next = applyProjectOverride(next, customProject, { requireType: true });
  return next;
}

function refreshConfigBoundUi() {
  if (modals) modals.cfg = cfg;
  if (albumUI) albumUI.cards = cfg.album || [];
  if (codexUI) codexUI.cfg = cfg;
  // 正在对局时不热重建棋盘，避免中途跳画面；返回菜单后 ensureGameUi 会以同一份 cfg 重建。
}

/** 合并一份已验证的云端工程配置，并将它缓存给下一次首屏。 */
function applyCloudProject(url, project, notice) {
  if (!isRingProject(project)) {
    cloudSyncNotice = '已忽略阶段门或路线映射不完整的云端地图，继续使用正式三圈地图';
    return false;
  }
  const previous = cloudProject;
  cloudProject = project;
  try { cfg = composeProjects(); }
  catch (error) {
    cloudProject = previous;
    cloudSyncNotice = `已忽略不符合配置契约的云端工程：${error.message || error}`;
    return false;
  }
  cloudConfigActive = true;
  writeCloudCache(url, project);
  refreshConfigBoundUi();
  if (notice) cloudSyncNotice = notice;
  return true;
}

/**
 * 启动云端同步：先立即采用本机缓存，再后台限时拉取最新版本。
 * 不把远端 Raw 请求放在菜单首屏的硬等待链上；真正进局时会等待同一 Promise，
 * 因而 BoardView 始终根据完成合并后的 cfg 建立。
 */
async function prepareCloudConfig() {
  try {
    cloudConfigUrl = localStorage.getItem('feihua_cloud_config_url') || await loadCloudUrl() || '';
  } catch (_) { cloudConfigUrl = ''; }
  if (!cloudConfigUrl) return;

  const cached = readCloudCache(cloudConfigUrl);
  if (cached) {
    applyCloudProject(cloudConfigUrl, cached, '已使用本机缓存的云端配置，并在后台检查更新');
  }
  cloudSyncRunning = true;
  cloudSyncPromise = fetchCloudConfig(cloudConfigUrl, { silent: true }).then(project => {
    if (!project) return null;
    applyCloudProject(cloudConfigUrl, project, cached ? '云端配置已刷新，下一局将使用最新内容' : '已从云端同步最新配置');
    return project;
  }).finally(() => { cloudSyncRunning = false; });
}

function announceCloudSync() {
  if (!cloudSyncNotice) return;
  if (hud) hud.toast(cloudSyncNotice);
  cloudSyncNotice = '';
}

/** 返回主菜单时静默拉取；有进行中的棋盘时不热替换地图，避免画面与规则配置脱节。 */
function maybeResyncCloud() {
  if (!cloudConfigUrl || cloudSyncRunning) return;
  cloudSyncRunning = true;
  cloudSyncPromise = fetchCloudConfig(cloudConfigUrl, { silent: true }).then(project => {
    if (project) applyCloudProject(cloudConfigUrl, project, '云端配置已刷新，下一局将使用最新内容');
    return project;
  }).finally(() => { cloudSyncRunning = false; });
}

/** 第一次进入对局：缓存配置已在 boot 阶段（prepareCloudConfig）应用，故进局直接用，
 *  不再硬等远端校验，避免弱网/跨境链路把首局卡住数秒。仅给一个很短的宽限窗口收尾，
 *  远端刷新仍在后台进行，返回主菜单时由 maybeResyncCloud 应用到下一局。 */
async function waitForCloudBeforeGame() {
  try {
    await Promise.race([
      cloudSyncPromise,
      new Promise(resolve => setTimeout(resolve, 600))
    ]);
  } catch (_) { /* fetchCloudConfig 已降级为 null */ }
  announceCloudSync();
}

/* ------------------------------------------------------ 载入自定义配置（编辑器导出 → 本机生效） */
function openCustomConfig() {
  const cur = localStorage.getItem('feihua_custom_config');
  const html = `
    <div class="modal paper" style="width:min(620px,calc(100vw - var(--safe-left) - var(--safe-right) - 24px))">
      <div class="mtitle"><h2>载 入 自 定 义 配 置</h2></div>
      <div style="font-size:13px;color:var(--mo-3);line-height:1.85;margin:4px 2px 12px">
        把「内容编辑器」导出的 <code>feihua-content.json</code> 粘贴或上传到此处，<br/>
        即可让<b>当前浏览器里的游戏</b>立即使用你改过的题库 / 奇遇 / 文心 / NPC / 相性——<b>无需重新部署</b>。<br/>
        配置仅存于本机（刷新仍生效）；点「恢复默认配置」可清除。
      </div>
      <textarea id="cfgTA" class="cfg-ta" placeholder="在此粘贴 feihua-content.json 的内容…"></textarea>
      <div class="modal-actions" style="margin-top:12px">
        <label class="btn" style="cursor:pointer">上传文件<input type="file" id="cfgFile" accept=".json,application/json" style="display:none"/></label>
        <button class="btn primary" id="cfgApply">应用配置</button>
        <button class="btn" id="cfgReset">恢复默认配置</button>
        <button class="btn" id="cfgClose">关闭</button>
      </div>
      <div id="cfgMsg" style="font-size:12px;margin-top:10px;min-height:16px"></div>

      <hr style="border:none;border-top:1px dashed var(--mo-4);margin:16px 0 12px" />
      <div style="font-size:13px;color:var(--mo-2);line-height:1.8">
        <b>云端自动同步（所有玩家共享）</b><br/>
        填入「内容编辑器」发布后给出的云端地址；保存后<b>本机及所有玩家启动时自动拉取</b>，无需手动载入。
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap">
        <input id="cloudUrlInput" class="cfg-url" style="flex:1;min-width:220px"
          placeholder="https://raw.githubusercontent.com/.../feihua-content.json" value="${esc(cloudConfigUrl)}" />
        <button class="btn primary" id="cloudSave">保存并同步</button>
        <button class="btn" id="cloudClear">清除</button>
      </div>
      <div id="cloudMsg" style="font-size:12px;margin-top:8px;min-height:16px"></div>
    </div>`;
  const ov = modals.open(html, 'customConfig');
  const ta = ov.querySelector('#cfgTA');
  if (cur) { try { ta.value = JSON.stringify(JSON.parse(cur), null, 2); } catch (_) { ta.value = cur; } }
  ov.querySelector('#cfgFile').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { ta.value = r.result; };
    r.readAsText(f); e.target.value = '';
  });
  const setMsg = (t, bad) => { const m = ov.querySelector('#cfgMsg'); m.textContent = t; m.style.color = bad ? 'var(--bad)' : 'var(--mo-2)'; };
  const setCloudMsg = (t, bad) => { const m = ov.querySelector('#cloudMsg'); m.textContent = t; m.style.color = bad ? 'var(--bad)' : 'var(--mo-2)'; };
  ov.querySelector('#cfgClose').addEventListener('click', () => modals.close(ov));
  ov.querySelector('#cfgReset').addEventListener('click', () => {
    localStorage.removeItem('feihua_custom_config');
    customProject = null; customConfigActive = false; cfg = composeProjects(); refreshConfigBoundUi();
    modals.close(ov); hud.toast('已恢复默认配置');
  });
  ov.querySelector('#cfgApply').addEventListener('click', () => {
    let obj;
    try { obj = JSON.parse(ta.value); }
    catch (err) { setMsg('JSON 解析失败：' + err.message, true); return; }
    const proj = (obj && typeof obj === 'object') ? obj : null;
    const keys = ['questions', 'events', 'talents', 'talent-upgrade', 'npcs', 'affinity', 'synergies', 'board', 'sky', 'album'].filter(k => proj && proj[k] !== undefined);
    if (!keys.length) { setMsg('文件中未找到 questions / events / talents / talent-upgrade / npcs / affinity / synergies / board / sky / album 任一键。', true); return; }
    if (!isRingProject(proj)) {
      setMsg('地图配置缺少三圈阶段门或路线映射，已拒绝载入；请从最新版内容编辑器重新导出。', true);
      return;
    }
    try { customProject = proj; cfg = composeProjects(); }
    catch (err) { setMsg('合并失败：' + err.message, true); return; }
    refreshConfigBoundUi();
    localStorage.setItem('feihua_custom_config', JSON.stringify(proj));
    customConfigActive = true;
    modals.close(ov);
    hud.toast(`已载入自定义配置（${keys.join('/')}），下一局起生效`);
  });
  // 云端同步地址：保存即拉取一次，持久化到本机
  ov.querySelector('#cloudSave').addEventListener('click', async () => {
    const url = ov.querySelector('#cloudUrlInput').value.trim();
    if (!url) { setCloudMsg('请先填入云端地址。', true); return; }
    setCloudMsg('正在同步…');
    const proj = await fetchCloudConfig(url);
    if (!proj) { setCloudMsg('拉取失败，请检查地址或网络。', true); return; }
    if (!isRingProject(proj)) {
      setCloudMsg('地图配置缺少三圈阶段门或路线映射，未保存该云端地址。', true);
      return;
    }
    try { cloudProject = proj; cfg = composeProjects(); }
    catch (err) { setCloudMsg('合并失败：' + err.message, true); return; }
    refreshConfigBoundUi();
    localStorage.setItem('feihua_cloud_config_url', url);
    cloudConfigUrl = url; cloudConfigActive = true;
    setCloudMsg('已同步并保存云端地址，所有玩家启动即生效。');
    hud.toast('云端配置已同步');
  });
  ov.querySelector('#cloudClear').addEventListener('click', () => {
    localStorage.removeItem('feihua_cloud_config_url');
    cloudProject = null; cloudConfigUrl = ''; cloudConfigActive = false; cfg = composeProjects(); refreshConfigBoundUi();
    ov.querySelector('#cloudUrlInput').value = '';
    setCloudMsg('已清除云端同步地址。');
  });
  ov.addEventListener('click', e => { if (e.target === ov) modals.close(ov); });
}

function saveGame() {
  if (!game || game.s.over) { hud.toast('当前没有进行中的对局'); return; }
  const r = saveRun(game, RUN_SAVE_MANUAL_KEY);   // 手动槽：与每回合自动槽分离，关键节点不被覆盖
  if (!r.ok) { hud.toast('存档失败（浏览器存储不可用）'); return; }
  const t = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  hud.toast(r.where === 'local'
    ? `已存档 ✓（${t}）`
    : '已暂存（本地存储不可用，关闭页面后将丢失）');
}

async function loadGame() {
  await ensureGameUi();          // 从主菜单直接“继续上局”时，棋盘/HUD 尚未构建，须先补齐再使用
  const best = loadBestRun();
  if (!best) { hud.toast('没有可读取的存档'); return; }
  if (best.obj.__corrupt) {
    hud.toast('存档数据已损坏，无法读取');
    if (confirm('检测到存档已损坏。是否清除该存档？')) clearRun(best.slot);
    return;
  }
  const res = deserializeRun(best.obj, cfg);
  if (!res.ok) {
    hud.toast('存档无法读取：' + res.error);
    if (confirm(`存档校验未通过（${res.error}）。是否清除该存档？`)) clearRun(best.slot);
    return;
  }
  // 用存档重建一局，再覆盖运行时状态并重建派生引用
  game = new Game(cfg, makeUi(), Math.random);
  wireGameSaves(game);
  game.onVictory = (nm, sc) => Leaderboard.submit(nm, sc).catch(() => {});   // 通关 → 提交云端排行榜
  game.s = res.state;
  modals.playerName = game.s.playerName || '';   // 续玩沿用存档中的名号
  modals.game = game;                            // 文心升级：详情弹窗调用引擎 upgradeTalent
  schoolEl.classList.remove('on');
  resultEl.classList.remove('on');
  albumUI.closeLoadout();
  albumUI.closeAlbum();
  const st = game.s;
  const curCell = game.currentCell();
  // routeIndex 是三圈位置的唯一真源；旧存档中遗留的 ringId 不得让棋盘回退到错误圈层。
  if (cfg.board.layout === 'concentric_spiral') board.revealRouteState(st);
  else {
    board.setVisibleRing?.(st.ringId === 'inner' ? 'inner' : st.ringId === 'middle' ? 'middle' : 'outer');
    board.setPiecePos(curCell ? curCell.id : st.pos);
  }
  board.clearHint();
  board.cellEls.forEach(e => e.classList.remove('active'));
  game.rehydrate();            // 重算羁绊等派生态（内部会 hud.render）
  hud.render(st);
  showMenuButton(true);
  enableRoll();
  hud.toast('已读取存档，继续科场之路');
  for (const w of res.warnings.slice(0, 2)) hud.toast('⚠ ' + w);  // 配置变更导致的失效引用提示
}

/* ---------------------------------------------------- 结算屏 */
async function showResult(sum) {
  setScene('result');         // 科场结算：结算配乐
  // 先演「本局新解锁」，再落结算卷轴
  await albumUI.showNewUnlocks(sum.newUnlocks || []);

  // 主角名号：有则显「「名」」，否则「你」
  const pname = (game && game.s && game.s.playerName) || '';

  // 流派熟练度：本局获得 + 是否升级
  const mk = sum.mastery;
  const masteryBlock = mk ? (() => {
    const schId = sum.state && sum.state.school && sum.state.school.id;
    const sch = (cfg.schools || []).find(x => x.id === schId);
    const schName = sch ? sch.name : (schId || '');
    const lvName = Album.masteryLevelName(mk.after.level);
    const upmark = mk.leveledUp ? `<span style="color:var(--zhu);font-weight:bold"> 精进！→ Lv${mk.after.level} ${Album.masteryLevelName(mk.after.level)}</span>` : '';
    return `<div class="result-mastery paper" style="margin-top:10px;padding:10px 14px;font-size:13px;letter-spacing:.1em">
      <div style="font-size:14px;letter-spacing:.16em;color:var(--mo-2);margin-bottom:4px">流派造诣 · ${schName}</div>
      <div>本局习得 <span style="color:var(--zhu);font-weight:bold">+${mk.gained}</span> 熟练度
        <span style="color:var(--mo-3)">（${Album.masterySummary(mk.before)} → Lv${mk.after.level} ${lvName}）</span>${upmark}</div>
    </div>`;
  })() : '';

  // 两列紧凑网格：六维一屏看全（Critic V3）。明细每维最多列 3 条，余者折为「其余 N 项」
  const PARTS_SHOWN = 3;
  const dims = sum.dims.map((d, i) => {
    const ps = d.parts || [];
    const head = ps.slice(0, PARTS_SHOWN)
      .map(p => `<div><span>${esc(p.label)}</span><span>${p.value}</span></div>`).join('');
    const restN = ps.length - PARTS_SHOWN;
    const restV = ps.slice(PARTS_SHOWN).reduce((a, p) => a + (Number(p.value) || 0), 0);
    const rest = restN > 0 ? `<div><span>其余 ${restN} 项</span><span>${restV}</span></div>` : '';
    return `
    <div class="dim-row on" style="animation-delay:${i * 0.07}s">
      <div class="dh"><span class="nm">${esc(d.name)}</span><span class="sc">${d.score}</span></div>
      <div class="parts">${head}${rest}</div>
    </div>`;
  }).join('');

  const st = sum.state || {};
  const b = st.battle || {};
  const mini = [
    `胜 ${b.win || 0}　平 ${b.draw || 0}　负 ${b.loss || 0}`,
    `最高连胜 ${b.maxStreak || 0}`,
    `奇遇 ${st.events ? st.events.total : 0} 次`,
    `文心 ${st.passive ? st.passive.length : 0} 被动 / ${st.active ? st.active.length : 0} 主动`,
    `用时 ${st.turn || 0} 回合`
  ].map(t => `<span>${t}</span>`).join('');

  const unlocks = (sum.newUnlocks || []).map(c => `
    <div class="unlock-card pop-in">
      <div class="uc-tag">图鉴点亮</div>
      <div class="uc-name">${esc(c.name)}</div>
      <div class="uc-reward">${esc(c.rewardDesc || '')}</div>
    </div>`).join('');
  const unlockBlock = unlocks
    ? `<div class="result-unlocks paper"><div style="font-size:14px;letter-spacing:.16em;color:var(--zhu);margin-bottom:6px">本局新解锁</div>
       <div class="unlock-row">${unlocks}</div></div>`
    : '';

  resultEl.innerHTML = `
    <div class="result-wrap">
      <div class="result-head">
        <div class="grade-scroll paper">
          <div class="gname">${esc(sum.grade.name)}</div>
          <div class="gtotal">总评 ${sum.total}</div>
          <div class="gcomment">${esc(sum.comment || '')}</div>
          <div class="greward">${esc(sum.reasonText || '')}</div>
          <div class="pname" style="font-size:13px;color:var(--mo-3);letter-spacing:.12em;margin-top:10px">${pname ? `主角 · ${esc(pname)}` : '主角 · 你'}</div>
        </div>
      </div>
      <div class="result-body">
        <div class="result-radar paper">
          <div style="font-size:15px;letter-spacing:.16em;color:var(--mo-2);margin-bottom:8px">六维才学</div>
          ${radarSVG(st.attrs || {})}
          <div class="mini-stats" style="margin-top:8px">${mini}</div>
        </div>
        <div class="result-dims paper">
          <div style="font-size:16px;letter-spacing:.16em;margin-bottom:6px">六维评分</div>
          <div class="dim-grid">${dims}</div>
          ${unlockBlock}
          ${masteryBlock}
        </div>
      </div>
      <div class="result-actions">
        <button class="btn btn-ink" data-shot>生成成绩图</button>
        <button class="btn btn-ink" data-album2>传世名篇</button>
        <button class="btn btn-primary" data-again>再来一局</button>
      </div>
    </div>`;

  resultEl.classList.add('on');
  resultEl.querySelector('[data-again]').addEventListener('click', () => openSchoolScreen());
  resultEl.querySelector('[data-album2]').addEventListener('click', () =>
    albumUI.openAlbum({ onBack: () => {} }));
  resultEl.querySelector('[data-shot]').addEventListener('click', () => albumUI.openScoreCard(sum));
}

/* ------------------------------------------------------ 启动 */
(async function () {
  try {
    cfg = await loadConfig();
    // cloudBaseCfg 是不可变本地基线；每次云端/自定义工程覆盖都从它重建，禁止把多次覆盖叠加成未知地图。
    cloudBaseCfg = cfg;
    // 应用上次「载入自定义配置」留下的覆盖（本机持久，刷新仍生效）。
    // 旧版本只按格子数量判断，可能留下“引擎进中圈、棋盘无法切圈”的半合法地图；现直接忽略并清除。
    try {
      const raw = localStorage.getItem('feihua_custom_config');
      if (raw) {
        const project = JSON.parse(raw);
        if (isRingProject(project)) { customProject = project; cfg = composeProjects(); customConfigActive = true; }
        else localStorage.removeItem('feihua_custom_config');
      }
    } catch (_) { localStorage.removeItem('feihua_custom_config'); }
  } catch (e) {
    document.body.innerHTML =
      `<div style="color:#f6f0e2;font-family:var(--font-kai);padding:40px;line-height:1.9">
       配置加载失败：${e.message}<br/>请用 <code>python -m http.server</code> 在本目录启动，
       并确保 config/ 或 config-dev/ 下存在全部 11 个 json 文件。</div>`;
    return;
  }
  boot();
})();
