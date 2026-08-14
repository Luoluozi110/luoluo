/**
 * config.js —— 配置加载：优先 config/，缺文件或解析失败时回退 config-dev/
 * 契约见 SCHEMA.md。所有内容均来自配置，代码不硬编码题目/事件/棋盘。
 */

const FILES = [
  'attrs', 'inspiration', 'board', 'questions', 'events',
  'talents', 'schools', 'affinity', 'npcs', 'sky', 'grades'
];
/** 可选配置：缺失时降级为空数组，不阻断启动 */
const OPTIONAL_FILES = ['album', 'synergies'];

export const configSource = {};   // { attrs: 'config' | 'config-dev' }

async function loadOne(name) {
  for (const dir of ['config', 'config-dev']) {
    try {
      const res = await fetch(`${dir}/${name}.json`, { cache: 'no-store' });
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
  const entries = await Promise.all(FILES.map(async n => [n, await loadOne(n)]));
  const cfg = Object.fromEntries(entries);
  await Promise.all(OPTIONAL_FILES.map(async n => {
    try { cfg[n] = await loadOne(n); } catch (e) { cfg[n] = []; configSource[n] = '缺失'; }
  }));
  return normalize(cfg);
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
      const res = await fetch(`${dir}/cloud.json`, { cache: 'no-store' });
      if (!res.ok) continue;
      const o = JSON.parse(await res.text());
      if (o && typeof o.url === 'string' && o.url.trim()) return o.url.trim();
    } catch (_) { /* 文件不存在或解析失败则忽略 */ }
  }
  return '';
}

/**
 * 运行时配置覆盖：把「内容编辑器」导出的工程文件（feihua-content.json）合并进已加载的 cfg。
 * project 形如 { _type:'feihua-content', questions, events, talents, npcs, affinity }（部分键可缺省）。
 * 只覆盖存在的键；board/attrs/schools/grades 等不在编辑器范围内，保持原值。返回合并并重新归一化后的新对象。
 */
export function applyProjectOverride(baseCfg, project) {
  if (!project || typeof project !== 'object') return baseCfg;
  const next = Object.assign({}, baseCfg);
  for (const key of ['questions', 'events', 'talents', 'npcs', 'affinity', 'synergies']) {
    if (project[key] !== undefined && project[key] !== null) next[key] = project[key];
  }
  return normalize(next);
}

/** 归一化：补齐派生结构，容忍内容方省略可选字段 */
function normalize(cfg) {
  const board = cfg.board;

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
      byId.set(cid, {
        id: cid,
        type: d.type || BRANCH_TYPES[i] || 'ping',
        name: d.name || `${br.landmark}·${i + 1}`,
        branch: bid, branchIndex: i, ring: 'branch'
      });
    });
  }
  board.cellById = byId;
  board.gateOf = {};
  for (const [gid, bid] of Object.entries(board.branchGates || {})) board.gateOf[bid] = Number(gid);
  board.laps = Number(board.laps) || 2;
  board.ringSize = board.mainRing.length;

  // 题库：只保留 enabled !== false
  cfg.questions = (cfg.questions || []).filter(q => q.enabled !== false);
  cfg.events = (cfg.events || []).filter(e => e.enabled !== false);

  // 相性：补默认名称
  const af = cfg.affinity;
  af.themeNames = af.themeNames || { yongwu: '咏物', songbie: '送别', shanshui: '山水', biansai: '边塞', huaigu: '怀古', jieling: '节令' };
  af.mannerNames = af.mannerNames || { wanyue: '婉约', haofang: '豪放', zheli: '哲理' };
  af.matrix = af.matrix || {};

  cfg.talentById = new Map((cfg.talents || []).map(t => [t.id, t]));
  return cfg;
}
