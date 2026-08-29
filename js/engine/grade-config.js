/**
 * 评分配置适配层：负责内容格式 → 引擎格式转换、缺省值合并与按配置对象缓存。
 * 纯评分计算仍由 rules.js 提供。
 */

export const DEFAULT_GRADES = {
  dims: {
    wencai: { name: '文采分', mult: 10, soft: 0, softRate: 0.5,
      allHigh: { threshold: 14, bonus: 100, label: '三绝并进' },
      dominant: { bonus: 50, label: '一枝独秀' },
      peak: { threshold: 26, bonus: 80, label: '破壁' } },
    gongli: { name: '功力分', mult: 8, soft: 0, softRate: 0.5,
      balance: { maxRange: 3, bonus: 80, label: '根基匀称' },
      peak: { threshold: 22, bonus: 150, label: '偏锋独绝' } },
    zhanji: { name: '战绩分', win: 50, draw: 20, loss: -10, streak: 25, upset: 30,
      winFull: 99, streakCap: 99,
      allStyles: { minWins: 2, bonus: 100, label: '诗词联三栖' } },
    qiyu: { name: '奇遇分', event: 15, rare: 30, legend: 80, talent: 40, item: 20 },
    liupai: { name: '流派分',
      specialist: { minAttr: 24, minWins: 4, bonus: 200 },
      sanjue: { threshold: 14, bonus: 180, label: '三绝' },
      names: { shi: '诗仙', ci: '词宗', lian: '联圣' } },
    yuanman: { name: '圆满分', reach: 200, perInspiration: 5,
      swift: { maxTurns: 32, bonus: 150, label: '捷才' },
      steady: { maxTurns: 38, minInspiration: 5, bonus: 100, label: '从容' },
      palaceSweep: 150, finalWin: 150 }
  },
  tiers: [
    { name: '童生', min: 0, max: 599 }, { name: '秀才', min: 600, max: 1099 },
    { name: '举人', min: 1100, max: 1699 }, { name: '进士', min: 1700, max: 2199 },
    { name: '探花', min: 2200, max: 2599 }, { name: '榜眼', min: 2600, max: 2999 },
    { name: '状元', min: 3000, max: 3399 }, { name: '翰林', min: 3400, max: 3799 },
    { name: '文宗', min: 3800, max: 999999 }
  ],
  comments: {
    wencai: '锦心绣口，落笔成章——文采冠绝一时。',
    gongli: '根基深厚，厚积薄发——功力不显山水而自重。',
    zhanji: '百战文场，杀伐果断——笔为刀兵，无往不利。',
    qiyu: '奇遇连连，福至心灵——文章本天成，妙手偶得之。',
    liupai: '一门深入，卓然成家——专精一道，自成宗风。',
    yuanman: '行稳致远，功德圆满——科举一途，善始善终。'
  }
};

/**
 * 把内容侧 config/grades.json 的书写结构（dimensions[] / grades[]）
 * 翻译成引擎内部结构（dims{} / tiers[]）。
 * 内容方按 SCHEMA 写「维度数组 + 加成数组」，引擎读「具名字段」，此处是唯一的转换点。
 * 传入已是内部结构（dims/tiers）时原样返回，两种写法都能吃。
 */
export function adaptGradesConfig(raw) {
  if (!raw || typeof raw !== 'object') return {};
  if (!Array.isArray(raw.dimensions) && !Array.isArray(raw.grades)) return raw;

  const out = {};
  const byKey = new Map((raw.dimensions || []).map(d => [d.key, d]));
  const bonusOf = (dim, id) => ((dim && dim.bonuses) || []).find(b => b.id === id);
  const tierOf = (dim, id) => ((dim && dim.tiers) || []).find(t => t.id === id);
  const dims = {};

  const put = (obj, path, value) => {
    if (value === undefined || value === null) return;
    const keys = path.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) cur = (cur[keys[i]] = cur[keys[i]] || {});
    cur[keys[keys.length - 1]] = value;
  };

  /* 文采分 */
  const wc = byKey.get('wencai');
  if (wc) {
    const d = dims.wencai = {};
    put(d, 'name', wc.name);
    put(d, 'mult', (wc.coeff || {}).shi);
    put(d, 'soft', (wc.coeff || {}).soft);
    put(d, 'softRate', (wc.coeff || {}).softRate);
    const a = bonusOf(wc, 'sanjuejunheng'), b = bonusOf(wc, 'yizhiduxiu'), c = bonusOf(wc, 'pobi');
    if (a) { put(d, 'allHigh.threshold', (a.cond || {}).value); put(d, 'allHigh.bonus', a.score); put(d, 'allHigh.label', a.name); }
    if (b) { put(d, 'dominant.bonus', b.score); put(d, 'dominant.label', b.name); }
    if (c) { put(d, 'peak.threshold', (c.cond || {}).value); put(d, 'peak.bonus', c.score); put(d, 'peak.label', c.name); }
  }

  /* 功力分 */
  const gl = byKey.get('gongli');
  if (gl) {
    const d = dims.gongli = {};
    put(d, 'name', gl.name);
    put(d, 'mult', (gl.coeff || {}).bi);
    put(d, 'soft', (gl.coeff || {}).soft);
    put(d, 'softRate', (gl.coeff || {}).softRate);
    const a = bonusOf(gl, 'genjishenhou'), b = bonusOf(gl, 'pianfeng');
    if (a) { put(d, 'balance.maxRange', (a.cond || {}).value); put(d, 'balance.bonus', a.score); put(d, 'balance.label', a.name); }
    if (b) { put(d, 'peak.threshold', (b.cond || {}).value); put(d, 'peak.bonus', b.score); put(d, 'peak.label', b.name); }
  }

  /* 战绩分 */
  const zj = byKey.get('zhanji');
  if (zj) {
    const d = dims.zhanji = {}, co = zj.coeff || {};
    put(d, 'name', zj.name);
    put(d, 'win', co.win); put(d, 'draw', co.draw); put(d, 'loss', co.lose);
    put(d, 'streak', co.maxStreak); put(d, 'upset', co.upset);
    put(d, 'winFull', co.winFull); put(d, 'streakCap', co.maxStreakCap);
    const a = bonusOf(zj, 'santijiesheng');
    if (a) { put(d, 'allStyles.minWins', (a.cond || {}).value); put(d, 'allStyles.bonus', a.score); put(d, 'allStyles.label', a.name); }
  }

  /* 奇遇分 */
  const qy = byKey.get('qiyu');
  if (qy) {
    const d = dims.qiyu = {}, co = qy.coeff || {};
    put(d, 'name', qy.name);
    put(d, 'event', co.eventCount); put(d, 'rare', co.rareCount);
    put(d, 'legend', co.legendCount); put(d, 'talent', co.talentCount); put(d, 'item', co.itemCount);
  }

  /* 流派分 */
  const lp = byKey.get('liupai');
  if (lp) {
    const d = dims.liupai = {};
    put(d, 'name', lp.name);
    const sx = tierOf(lp, 'shixian'), sj = tierOf(lp, 'sanjue');
    if (sx) {
      put(d, 'specialist.minAttr', (sx.cond || {}).attrMin);
      put(d, 'specialist.minWins', (sx.cond || {}).winMin);
      put(d, 'specialist.bonus', sx.score);
    }
    if (sj) { put(d, 'sanjue.threshold', (sj.cond || {}).value); put(d, 'sanjue.bonus', sj.score); put(d, 'sanjue.label', sj.name); }
    const names = {};
    for (const [key, id] of [['shi', 'shixian'], ['ci', 'cizong'], ['lian', 'liansheng']]) {
      const t = tierOf(lp, id);
      if (t && t.name) names[key] = t.name;
    }
    if (Object.keys(names).length) put(d, 'names', names);
  }

  /* 圆满分 */
  const ym = byKey.get('yuanman');
  if (ym) {
    const d = dims.yuanman = {}, co = ym.coeff || {};
    put(d, 'name', ym.name);
    put(d, 'reach', co.arrive); put(d, 'perInspiration', co.inspirationLeft);
    const a = bonusOf(ym, 'jiecai'), b = bonusOf(ym, 'congrong'), c = bonusOf(ym, 'jinbangtiming');
    if (a) { put(d, 'swift.maxTurns', (a.cond || {}).value); put(d, 'swift.bonus', a.score); put(d, 'swift.label', a.name); }
    if (b) {
      put(d, 'steady.maxTurns', (b.cond || {}).value);
      put(d, 'steady.minInspiration', (b.cond || {}).inspirationMin);
      put(d, 'steady.bonus', b.score); put(d, 'steady.label', b.name);
    }
    if (c) {
      put(d, 'finalWin', c.score);
      // 旧配置兼容：若调用方仍读取 palaceSweep，保留同一奖励值。
      put(d, 'palaceSweep', c.score);
    }
  }

  if (Object.keys(dims).length) out.dims = dims;

  if (Array.isArray(raw.grades) && raw.grades.length) {
    out.tiers = raw.grades.map(g => ({
      name: g.name,
      min: Number(g.min) || 0,
      max: g.max === null || g.max === undefined ? 999999 : Number(g.max)
    }));
  }
  if (raw.comments) out.comments = raw.comments;
  if (raw.battle) out.battle = raw.battle;
  return out;
}

/**
 * 深合并：以 DEFAULT_GRADES 为底，用外部配置覆盖（容忍配置缺字段）。
 *
 * 结果按 cfg 的对象标识记忆化：正式对局里每局只调一次无所谓，但数值台
 * （tools/r3_fit.mjs）要在同一份配置上跑几百万次结算，每次深拷贝一遍 DEFAULT_GRADES
 * 会让拟合从秒级退化到分钟级。配置对象在运行期不被就地改写，故按标识缓存是安全的。
 */
const gradesCache = new WeakMap();
export function normalizeGrades(cfg) {
  if (cfg && typeof cfg === 'object') {
    const hit = gradesCache.get(cfg);
    if (hit) return hit;
    const out = deepMerge(clone(DEFAULT_GRADES), adaptGradesConfig(cfg));
    gradesCache.set(cfg, out);
    return out;
  }
  return deepMerge(clone(DEFAULT_GRADES), adaptGradesConfig(cfg));
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function deepMerge(base, over) {
  for (const k of Object.keys(over || {})) {
    const v = over[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      deepMerge(base[k], v);
    } else if (v !== undefined && v !== null) {
      base[k] = v;
    }
  }
  return base;
}

