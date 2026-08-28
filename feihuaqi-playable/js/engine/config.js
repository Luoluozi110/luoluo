/**
 * config.js —— 配置加载：优先 config/，缺文件或解析失败时回退 config-dev/
 * 契约见 SCHEMA.md。所有内容均来自配置，代码不硬编码题目/事件/棋盘。
 */

import './config-contract.js';

const CONTRACT = globalThis.FeihuaConfigContract;

const FILES = [
  'attrs', 'inspiration', 'board', 'questions', 'events',
  'talents', 'schools', 'affinity', 'npcs', 'sky', 'grades'
];
/** 可选配置：缺失时降级为空数组/空对象，不阻断启动 */
const OPTIONAL_FILES = ['album', 'synergies', 'npc-mechanics', 'talent-upgrade', 'narrative', 'sidequests', 'sidequest-talents'];
const OPTIONAL_DEFAULTS = {
  album: [], synergies: [], 'npc-mechanics': {}, 'talent-upgrade': {}, narrative: {}, sidequests: { version: 1, routes: [], final: {} }, 'sidequest-talents': { talents: [], upgrades: {}, offers: {} }
};
const NPC_ID_RE = /^[a-z][a-z0-9_-]*$/;

/**
 * 为历史工程补齐每位具名 NPC 的稳定 ID。编辑器现在会在创建时生成 ID，
 * 但游戏端仍需容纳旧导出文件，避免其因为空 ID 而无法正常遭遇或丢失机制历史。
 */
export function normalizeNpcIds(cfg) {
  if (!cfg || !Array.isArray(cfg.npcs)) return cfg;
  const used = new Set();
  const nextId = tierId => {
    const safeTier = String(tierId || 'tier').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^[_-]+|[_-]+$/g, '') || 'tier';
    const base = `npc_${safeTier}`;
    let n = 1, id = `${base}_${n}`;
    while (used.has(id)) id = `${base}_${++n}`;
    return id;
  };
  for (const tier of cfg.npcs) {
    if (!tier || !Array.isArray(tier.npcs)) continue;
    for (const npc of tier.npcs) {
      if (!npc || typeof npc !== 'object') continue;
      const id = String(npc.id || '').trim().toLowerCase();
      if (NPC_ID_RE.test(id) && !used.has(id)) {
        npc.id = id;
      } else if (!id && tier.id === 'zhukaoguan' && npc.name === '康尔玉' && !used.has('kang_er_yu')) {
        // 旧编辑器曾丢失康尔玉 ID；恢复官方 ID，才能继续命中其殿试必遇规则。
        npc.id = 'kang_er_yu';
      } else {
        npc.id = nextId(tier.id);
      }
      used.add(npc.id);
    }
  }
  return cfg;
}

function cloneProjectNpcData(project) {
  if (!project || !Array.isArray(project.npcs)) return project;
  return {
    ...project,
    npcs: project.npcs.map(tier => tier && typeof tier === 'object'
      ? { ...tier, npcs: Array.isArray(tier.npcs) ? tier.npcs.map(npc => npc && typeof npc === 'object' ? { ...npc } : npc) : tier.npcs }
      : tier)
  };
}

export const configSource = {};   // { attrs: 'config' | 'config-dev' }

async function loadOne(name) {
  for (const dir of ['config', 'config-dev']) {
    try {
      // no-cache：浏览器仍发条件请求复用（304 不重下），兼顾「部署即更新」与「重复访问不重传」。
      const res = await fetch(`${dir}/${name}.json`, { cache: 'no-cache' });
      if (!res.ok) continue;
      const text = await res.text();
      const data = JSON.parse(text.replace(/^\uFEFF/, ''));
      configSource[name] = dir;
      return data;
    } catch (err) {
      /* 继续尝试下一个目录 */
    }
  }
  throw new Error(`配置缺失：config/${name}.json 与 config-dev/${name}.json 均不可用`);
}

export async function loadConfig() {
  // 必需与可选配置同批发起，避免先等 11 个必需文件、再多等一轮可选文件的网络往返。
  // HTTP/2 下这些小型 JSON 可复用同一连接；任一可选文件缺失仍只按原约定降级，不阻断启动。
  const required = FILES.map(async n => [n, await loadOne(n)]);
  const optional = OPTIONAL_FILES.map(async n => {
    try { return [n, await loadOne(n)]; }
    catch (_) { configSource[n] = '缺失'; return [n, OPTIONAL_DEFAULTS[n]]; }
  });
  const cfg = Object.fromEntries(await Promise.all([...required, ...optional]));
  normalizeNpcIds(cfg);
  CONTRACT.assertConfig(cfg);
  return normalizeConfig(cfg);
}

/**
 * 读取「云端同步地址」：优先 config/cloud.json，其次 config-dev/cloud.json。
 * 形如 { "url": "https://raw.githubusercontent.com/.../feihua-content.json" }。
 * 游戏启动时会拉取该地址的内容并合并进 cfg，使所有玩家自动同步编辑器的改动。
 * 返回字符串 url；缺失或为空则返回 ''。
 */
export async function loadCloudUrl() {
  for (const dir of ['config', 'config-dev']) {
    try {
      const res = await fetch(`${dir}/cloud.json`, { cache: 'no-cache' });
      if (!res.ok) continue;
      const o = JSON.parse(await res.text());
      if (o && typeof o.url === 'string' && o.url.trim()) return o.url.trim();
    } catch (_) { /* 文件不存在或解析失败则忽略 */ }
  }
  return '';
}

/**
 * 运行时配置覆盖：把「内容编辑器」导出的工程文件（feihua-content.json）合并进已加载的 cfg。
 * project 形如 { _type:'feihua-content', questions, events, talents, 'talent-upgrade', npcs, affinity,
 *   synergies, board, sky, album, schools, grades, narrative }（部分键可缺省）。
 * 只覆盖存在的键；文心与升级表作为同一内容契约同步，其他未提供配置保持原值。返回合并并重新归一化后的新对象。
 * 注：schools / grades / narrative 为「叙事文案编辑器」产出的纯文案覆盖（流派口号/沉浸叙事、段位评语/奖励、
 * 评分文案、开局与阶段切换弹窗文案），直接整体替换对应配置；normalize() 不触碰这几份配置的结构，故覆盖安全。
 */
export function applyProjectOverride(baseCfg, project, options = {}) {
  if (!project || typeof project !== 'object') return baseCfg;
  project = normalizeNpcIds(cloneProjectNpcData(project));
  // 引擎内部与测试可直接传配置补丁（无工程包装层）；外部编辑器发布仍由 assertProject 默认严格校验 _type。
  CONTRACT.assertProject(project, { requireComplete: false, requireType: !!options.requireType });
  const next = Object.assign({}, baseCfg);
  for (const key of ['questions', 'events', 'talents', 'talent-upgrade', 'npcs', 'affinity', 'synergies', 'board', 'npc-mechanics', 'sky', 'album', 'schools', 'grades', 'narrative', 'sidequests']) {
    if (project[key] !== undefined && project[key] !== null) next[key] = project[key];
  }
  // 内容编辑器的棋盘工程只描述主路线；隐藏终圈属于玩法契约，旧工程未携带时不得把本地配置抹掉。
  if (project.board && !project.board.hiddenFinalRing && baseCfg.board && baseCfg.board.hiddenFinalRing) {
    next.board = { ...next.board, hiddenFinalRing: baseCfg.board.hiddenFinalRing };
  }
  CONTRACT.assertConfig(next);
  return normalizeConfig(next);
}

export const validateConfig = CONTRACT.validateConfig;
export const validateProject = CONTRACT.validateProject;

/** 归一化：补齐派生结构，容忍内容方省略可选字段 */
export function normalizeConfig(cfg) {
  normalizeNpcIds(cfg);
  const board = cfg.board;
  board.layout = board.layout || 'single_ring';
  board.route = Array.isArray(board.route) && board.route.length
    ? board.route.map((x, i) => ({ ring: x.ring || 'outer', cellId: Number(x.cellId ?? x.id ?? i) }))
    : (board.mainRing || []).map((c, i) => ({ ring: c.ring || 'main', cellId: Number(c.id ?? i) }));
  board.phaseGates = Array.isArray(board.phaseGates) ? board.phaseGates : [];
  if (board.hiddenFinalRing && typeof board.hiddenFinalRing === 'object') {
    const hidden = board.hiddenFinalRing;
    hidden.id = String(hidden.id || 'secret');
    hidden.grid = Math.max(3, Number(hidden.grid) || 3);
    hidden.cells = Array.isArray(hidden.cells) ? hidden.cells.map((cell, i) => ({
      ...cell,
      id: Number(cell.id ?? (1000 + i)),
      ringIndex: Number(cell.ringIndex ?? i),
      type: cell.type || 'secret_path',
      name: cell.name || `桃径·${i + 1}`
    })) : [];
    hidden.startCellId = Number(hidden.startCellId ?? (hidden.cells[0] && hidden.cells[0].id));
    hidden.battleCellId = Number(hidden.battleCellId ?? (hidden.cells[hidden.cells.length - 1] && hidden.cells[hidden.cells.length - 1].id));
    hidden.requirements = Object.assign({ allAlbums: true, masteryLevel: 5, palaceScoreRatio: 2 }, hidden.requirements || {});
  }

  // 支线格类型：优先用 branchCells，否则按契约 "ping/quiz/event/battle/landmark" 顺序推导
  const BRANCH_TYPES = ['ping', 'quiz', 'event', 'battle', 'landmark'];
  const byId = new Map();
  for (const c of board.mainRing) byId.set(c.id, { ...c, ring: 'main' });

  const declared = new Map();
  for (const c of (board.branchCells || [])) declared.set(c.id, c);

  for (const [bid, br] of Object.entries(board.branches || {})) {
    br.id = bid;
    br.cells.forEach((cid, i) => {
      const d = declared.get(cid) || {};
      const base = { ...d };
      delete base.id; delete base.branch; delete base.branchIndex; delete base.ring;
      byId.set(cid, {
        ...base,
        id: cid,
        type: d.type || BRANCH_TYPES[i] || 'ping',
        name: d.name || `${br.landmark}·${i + 1}`,
        branch: bid, branchIndex: i, ring: 'branch'
      });
    });
  }
  board.cellById = byId;
  board.routeCells = board.route.map((step, i) => {
    const cell = byId.get(step.cellId) || board.mainRing[i];
    return cell ? { ...cell, id: i, routeIndex: i, ring: step.ring || cell.ring || 'main' } : null;
  }).filter(Boolean);
  board.routeSize = board.routeCells.length;
  board.ringOfRouteIndex = new Map(board.routeCells.map(c => [c.routeIndex, c.ring]));
  board.gateOf = {};
  for (const [gid, bid] of Object.entries(board.branchGates || {})) board.gateOf[bid] = Number(gid);
  board.laps = Number(board.laps) || 2;
  board.ringSize = board.mainRing.length;
  board.routeSize = board.routeSize || board.mainRing.length;

  // 题库：只保留 enabled !== false
  cfg.questions = (cfg.questions || []).filter(q => q.enabled !== false);
  cfg.events = (cfg.events || []).filter(e => e.enabled !== false);

  // 相性：补默认名称
  const af = cfg.affinity;
  af.themeNames = af.themeNames || { yongwu: '咏物', songbie: '送别', shanshui: '山水', biansai: '边塞', huaigu: '怀古', jieling: '节令' };
  af.mannerNames = af.mannerNames || { wanyue: '婉约', haofang: '豪放', zheli: '哲理' };
  af.matrix = af.matrix || {};

  // 支线限定文心始终由本地独立配置补入：云端内容工程尚未同步它们时也不能把
  // 这批路线专属卡抹掉；同 ID 则以限定配置为准，避免旧缓存产生两张卡。
  const sideTalentCfg = (cfg['sidequest-talents'] && typeof cfg['sidequest-talents'] === 'object') ? cfg['sidequest-talents'] : {};
  const sideTalents = Array.isArray(sideTalentCfg.talents) ? sideTalentCfg.talents.filter(t => t && t.id) : [];
  const sideIds = new Set(sideTalents.map(t => t.id));
  cfg.talents = [...(Array.isArray(cfg.talents) ? cfg.talents : []).filter(t => !sideIds.has(t && t.id)), ...sideTalents];
  cfg['talent-upgrade'] = { ...(cfg['talent-upgrade'] || {}), ...(sideTalentCfg.upgrades || {}) };
  sideTalentCfg.offers = sideTalentCfg.offers && typeof sideTalentCfg.offers === 'object' ? sideTalentCfg.offers : {};
  cfg['sidequest-talents'] = sideTalentCfg;
  cfg.talentById = new Map((cfg.talents || []).map(t => [t.id, t]));

  // 名胜支线：内容缺失时退化为空，不影响旧工程与旧存档继续开局。
  const sidequests = (cfg.sidequests && typeof cfg.sidequests === 'object') ? cfg.sidequests : {};
  sidequests.version = Math.max(1, Number(sidequests.version) || 1);
  sidequests.routes = Array.isArray(sidequests.routes) ? sidequests.routes : [];
  sidequests.routeById = new Map(sidequests.routes.filter(r => r && r.id).map(r => [r.id, r]));
  sidequests.final = Object.assign({ carryCost: 2, scorePctByMerit: { 1: 0.06, 2: 0.10 }, releaseInspirationByMerit: { 1: 2, 2: 4 } }, sidequests.final || {});
  cfg.sidequests = sidequests;

  // 文心升级系统：id → { quality, maxLevel, upCost[], levels:[{effect,cost?}] }
  cfg.talentUpgradeById = new Map(Object.entries(cfg['talent-upgrade'] || {}));

  // NPC 三机制模板库：缺失/非法时回退为空对象，引擎按「无机制」行驶，不阻断启动。
  const nm = cfg['npc-mechanics'];
  if (!nm || typeof nm !== 'object' || Array.isArray(nm)) cfg['npc-mechanics'] = {};
  const m = cfg['npc-mechanics'];
  m.signatureTemplates = m.signatureTemplates || {};
  m.weaknessTemplates = m.weaknessTemplates || {};
  m.intentTemplates = m.intentTemplates || {};
  m.budget = m.budget || {};
  return cfg;
}
