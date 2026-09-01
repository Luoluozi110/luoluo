/**
 * end-scroll.js —— 「终局成卷」纯数据层。
 *
 * 只记录叙事信号并从策划模板中选句，不改变属性、胜负、随机数或评分。
 * 这样旧存档可以安全补全，新 UI 也能在没有额外点击的情况下采用默认句。
 */

export const POETRY_CHAPTERS = Object.freeze(['outer', 'middle', 'inner']);

const FALLBACK_LINES = Object.freeze({
  outer: { id: 'fallback_outer', chapter: 'outer', motif: '启程', tone: '清润', text: '一卷初开，来路先落下淡墨。' },
  middle: { id: 'fallback_middle', chapter: 'middle', motif: '取舍', tone: '沉静', text: '行至半途，取舍渐有自己的章法。' },
  inner: { id: 'fallback_inner', chapter: 'inner', motif: '回望', tone: '明朗', text: '金殿在前，旧日诸笔都来相照。' }
});

const FALLBACK_ENDINGS = Object.freeze({
  jinbang: { line: '金殿收卷时，来路仍在墨中。', seal: '金榜题名' },
  palace: { line: '未署榜首之名，也已写成自己的来路。', seal: '行卷有痕' },
  turnlimit: { line: '时辰催卷，未尽之意留待来日。', seal: '余墨待续' },
  fengbi: { line: '灵思暂歇，纸上所得仍可珍藏。', seal: '墨意犹存' },
  taoyuan: { line: '万卷归心之后，脚下的路不再由棋盘标明。', seal: '桃源出卷' },
  secret_loss: { line: '金榜已定，桃源一问留待下卷。', seal: '花笺留问' },
  default: { line: '一局既终，沿途取舍都已成章。', seal: '此卷已成' }
});

const cleanText = (value, max = 240) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
const cleanId = value => cleanText(value, 80);
const isChapter = value => POETRY_CHAPTERS.includes(value);

function blankCounts() {
  return { themes: {}, manners: {}, inkTags: {}, momentTypes: {} };
}

function sanitizeCounts(raw) {
  const out = blankCounts();
  for (const key of Object.keys(out)) {
    const src = raw && raw[key] && typeof raw[key] === 'object' ? raw[key] : {};
    for (const [id, value] of Object.entries(src)) {
      const safeId = cleanId(id);
      const count = Math.max(0, Math.min(999, Math.floor(Number(value) || 0)));
      if (safeId && count) out[key][safeId] = count;
    }
  }
  return out;
}

export function emptyPoetryState() {
  return {
    version: 1,
    chapterDrafts: { outer: null, middle: null, inner: null },
    chapterStats: { outer: blankCounts(), middle: blankCounts(), inner: blankCounts() },
    moments: []
  };
}

/** 清洗来自旧档或用户工程的叙事状态；永远返回可用结构。 */
export function normalizePoetryState(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = emptyPoetryState();
  out.version = Math.max(1, Number(src.version) || 1);

  for (const chapter of POETRY_CHAPTERS) {
    out.chapterStats[chapter] = sanitizeCounts(src.chapterStats && src.chapterStats[chapter]);
    const draft = src.chapterDrafts && src.chapterDrafts[chapter];
    if (!draft || typeof draft !== 'object') continue;
    const candidateIds = Array.from(new Set((Array.isArray(draft.candidateIds) ? draft.candidateIds : [])
      .map(cleanId).filter(Boolean))).slice(0, 2);
    const selectedId = cleanId(draft.selectedId);
    if (!candidateIds.length) continue;
    out.chapterDrafts[chapter] = {
      chapter,
      candidateIds,
      selectedId: candidateIds.includes(selectedId) ? selectedId : candidateIds[0],
      lockedAtTurn: Math.max(0, Number(draft.lockedAtTurn) || 0)
    };
  }

  const moments = Array.isArray(src.moments) ? src.moments : [];
  out.moments = moments.slice(-12).map(item => ({
    type: cleanId(item && item.type) || 'event',
    chapter: isChapter(item && item.chapter) ? item.chapter : 'outer',
    turn: Math.max(0, Number(item && item.turn) || 0),
    refId: cleanId(item && item.refId),
    theme: cleanId(item && item.theme),
    manner: cleanId(item && item.manner),
    result: cleanId(item && item.result),
    resultText: cleanText(item && item.resultText, 180),
    inkTags: Array.from(new Set((Array.isArray(item && item.inkTags) ? item.inkTags : [])
      .map(cleanId).filter(Boolean))).slice(0, 6)
  }));
  return out;
}

export function chapterFromState(state) {
  const s = state || {};
  const ring = cleanId(s.ringId);
  const routeIndex = Math.max(0, Number(s.routeIndex) || 0);
  if (['inner', 'palace', 'secret'].includes(ring) || routeIndex >= 136 || s.reachedEnd) return 'inner';
  if (ring === 'middle' || routeIndex >= 72) return 'middle';
  return 'outer';
}

function bump(bucket, key, amount = 1) {
  const id = cleanId(key);
  if (!id) return;
  bucket[id] = Math.min(999, (Number(bucket[id]) || 0) + Math.max(1, Number(amount) || 1));
}

/**
 * 记录一个已发生事实。普通战斗只进入聚合计数；关键战斗、抉择和奇遇才占用 12 条记忆槽。
 */
export function recordPoetryMoment(poetryState, moment) {
  const state = poetryState;
  if (!state || typeof state !== 'object') return;
  const chapter = isChapter(moment && moment.chapter) ? moment.chapter : 'outer';
  const stats = state.chapterStats && state.chapterStats[chapter];
  if (!stats) return;
  bump(stats.themes, moment && moment.theme);
  bump(stats.manners, moment && moment.manner);
  bump(stats.momentTypes, moment && moment.type);
  for (const tag of (Array.isArray(moment && moment.inkTags) ? moment.inkTags : [])) bump(stats.inkTags, tag);

  if (!moment || (moment.type === 'battle' && !moment.important)) return;
  state.moments = Array.isArray(state.moments) ? state.moments : [];
  state.moments.push({
    type: cleanId(moment.type) || 'event', chapter,
    turn: Math.max(0, Number(moment.turn) || 0),
    refId: cleanId(moment.refId), theme: cleanId(moment.theme),
    manner: cleanId(moment.manner), result: cleanId(moment.result),
    resultText: cleanText(moment.resultText, 180),
    inkTags: Array.from(new Set((Array.isArray(moment.inkTags) ? moment.inkTags : [])
      .map(cleanId).filter(Boolean))).slice(0, 6)
  });
  if (state.moments.length > 12) state.moments.splice(0, state.moments.length - 12);
}

function lineTemplates(config, chapter) {
  const source = config && Array.isArray(config.chapterLines) ? config.chapterLines : [];
  const lines = source.filter(line => line && line.chapter === chapter && cleanId(line.id) && cleanText(line.text));
  return lines.length ? lines : [FALLBACK_LINES[chapter]];
}

function lineMap(config) {
  const map = new Map();
  for (const chapter of POETRY_CHAPTERS) {
    for (const line of lineTemplates(config, chapter)) map.set(cleanId(line.id), line);
  }
  return map;
}

function inferredHistoryChapter(item) {
  if (isChapter(item && item.chapter)) return item.chapter;
  const phase = cleanId(item && item.phase);
  if (['jinshi', 'palace', 'secret'].includes(phase)) return 'inner';
  if (phase === 'juren') return 'middle';
  return 'outer';
}

function stableHash(value) {
  let hash = 2166136261;
  for (const ch of String(value)) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function addCounts(target, values, factor = 1) {
  for (const [key, value] of Object.entries(values || {})) target[key] = (target[key] || 0) + (Number(value) || 0) * factor;
}

function chapterSignals(state, chapter, context) {
  const stats = state.chapterStats[chapter] || blankCounts();
  const signals = { themes: {}, manners: {}, inkTags: {}, momentTypes: {} };
  for (const key of Object.keys(signals)) addCounts(signals[key], stats[key]);
  for (const item of (Array.isArray(context && context.choiceHistory) ? context.choiceHistory : [])) {
    if (inferredHistoryChapter(item) !== chapter) continue;
    for (const tag of (Array.isArray(item.inkTags) ? item.inkTags : [])) bump(signals.inkTags, tag);
  }
  return signals;
}

function scoreLine(line, signals, usedMotifs, seed) {
  let score = Number(line.weight) || 0;
  for (const id of (Array.isArray(line.themes) ? line.themes : [])) score += (signals.themes[id] || 0) * 30;
  for (const id of (Array.isArray(line.manners) ? line.manners : [])) score += (signals.manners[id] || 0) * 20;
  for (const id of (Array.isArray(line.inkTags) ? line.inkTags : [])) score += (signals.inkTags[id] || 0) * 18;
  for (const id of (Array.isArray(line.momentTypes) ? line.momentTypes : [])) score += (signals.momentTypes[id] || 0) * 10;
  if (line.motif && usedMotifs.has(line.motif)) score -= 35;
  return score + (stableHash(`${seed}|${line.id}`) % 1000) / 1000000;
}

export function presentChapterDraft(poetryState, config, chapter) {
  const draft = poetryState && poetryState.chapterDrafts && poetryState.chapterDrafts[chapter];
  if (!draft) return null;
  const templates = lineMap(config);
  const candidates = draft.candidateIds.map(id => templates.get(id)).filter(Boolean).map(line => ({
    id: cleanId(line.id), text: cleanText(line.text), motif: cleanText(line.motif, 24), tone: cleanText(line.tone, 24)
  }));
  if (!candidates.length) return null;
  return { chapter, selectedId: candidates.some(x => x.id === draft.selectedId) ? draft.selectedId : candidates[0].id, candidates };
}

/** 首次到达章末时生成两个候选并立即保存默认项；再次打开不会重抽。 */
export function prepareChapterDraft(poetryState, config, chapter, context = {}) {
  if (!poetryState || !isChapter(chapter)) return null;
  const existing = presentChapterDraft(poetryState, config, chapter);
  if (existing) return existing;

  const usedMotifs = new Set();
  const templates = lineMap(config);
  for (const prior of POETRY_CHAPTERS) {
    if (prior === chapter) break;
    const draft = poetryState.chapterDrafts[prior];
    const chosen = draft && templates.get(draft.selectedId);
    if (chosen && chosen.motif) usedMotifs.add(chosen.motif);
  }
  const signals = chapterSignals(poetryState, chapter, context);
  const seed = `${cleanText(context.playerName, 40)}|${chapter}|${Number(context.turn) || 0}`;
  const ranked = lineTemplates(config, chapter)
    .map(line => ({ line, score: scoreLine(line, signals, usedMotifs, seed) }))
    .sort((a, b) => b.score - a.score || cleanId(a.line.id).localeCompare(cleanId(b.line.id)));
  const first = ranked[0].line;
  const secondEntry = ranked.slice(1).find(item => item.line.motif !== first.motif) || ranked[1];
  const chosen = [first, secondEntry && secondEntry.line].filter(Boolean);
  poetryState.chapterDrafts[chapter] = {
    chapter,
    candidateIds: chosen.map(line => cleanId(line.id)),
    selectedId: cleanId(first.id),
    lockedAtTurn: Math.max(0, Number(context.turn) || 0)
  };
  return presentChapterDraft(poetryState, config, chapter);
}

export function selectChapterLine(poetryState, chapter, selectedId) {
  const draft = poetryState && poetryState.chapterDrafts && poetryState.chapterDrafts[chapter];
  const id = cleanId(selectedId);
  if (!draft || !draft.candidateIds.includes(id)) return draft && draft.selectedId || '';
  draft.selectedId = id;
  return id;
}

function availableChapters(context) {
  const routeIndex = Math.max(0, Number(context && context.routeIndex) || 0);
  const ring = cleanId(context && context.ringId);
  const chapters = ['outer'];
  if (routeIndex >= 72 || ['middle', 'inner', 'palace', 'secret'].includes(ring)) chapters.push('middle');
  if (routeIndex >= 136 || ['inner', 'palace', 'secret'].includes(ring) || context && context.reachedEnd) chapters.push('inner');
  return chapters;
}

function topKey(counts) {
  return Object.entries(counts || {}).sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))[0]?.[0] || '';
}

function firstSentence(value, max = 58) {
  const text = cleanText(value, 180);
  if (!text) return '';
  const match = text.match(/^.*?[。！？；]/);
  const sentence = match ? match[0] : text;
  return sentence.length > max ? `${sentence.slice(0, max - 1)}…` : sentence;
}

function chooseTitle(config, chosenLines, endingKey, aggregate, context) {
  const titles = Array.isArray(config && config.titles) ? config.titles.filter(x => x && cleanText(x.text)) : [];
  if (!titles.length) return '此局成卷';
  const motifs = new Set(chosenLines.map(line => line.motif).filter(Boolean));
  const seed = `${cleanText(context.playerName, 40)}|${endingKey}|${chosenLines.map(x => x.id).join('|')}`;
  const ranked = titles.map(title => {
    let score = Number(title.weight) || 0;
    for (const motif of (Array.isArray(title.motifs) ? title.motifs : [])) if (motifs.has(motif)) score += 24;
    for (const theme of (Array.isArray(title.themes) ? title.themes : [])) score += (aggregate.themes[theme] || 0) * 8;
    for (const ending of (Array.isArray(title.endings) ? title.endings : [])) if (ending === endingKey) score += 30;
    return { title, score: score + (stableHash(`${seed}|${title.id || title.text}`) % 1000) / 1000000 };
  }).sort((a, b) => b.score - a.score);
  return cleanText(ranked[0].title.text, 32) || '此局成卷';
}

/** 合成最终展示对象；必要时为提前结束的旧档自动补一章默认句。 */
export function buildEndScroll(poetryState, config, context = {}) {
  const chapters = availableChapters(context);
  for (const chapter of chapters) prepareChapterDraft(poetryState, config, chapter, context);
  const templates = lineMap(config);
  const selected = chapters.map(chapter => {
    const draft = poetryState.chapterDrafts[chapter];
    return draft && templates.get(draft.selectedId);
  }).filter(Boolean);

  const aggregate = blankCounts();
  for (const chapter of chapters) {
    const stats = poetryState.chapterStats[chapter] || blankCounts();
    for (const key of Object.keys(aggregate)) addCounts(aggregate[key], stats[key]);
  }
  const endingKey = cleanId(context.endReason) || 'default';
  const ending = (config && config.endings && config.endings[endingKey]) || FALLBACK_ENDINGS[endingKey] || FALLBACK_ENDINGS.default;
  const labels = context.labels && typeof context.labels === 'object' ? context.labels : {};
  const theme = topKey(aggregate.themes);
  const manner = topKey(aggregate.manners);
  const facts = [];
  if (theme) facts.push(`此卷多见「${cleanText(labels.themes && labels.themes[theme] || theme, 16)}」`);
  if (manner) facts.push(`常以「${cleanText(labels.manners && labels.manners[manner] || manner, 16)}」落笔`);
  const remembered = [...(Array.isArray(poetryState.moments) ? poetryState.moments : [])].reverse()
    .find(item => item.resultText);
  const echo = firstSentence(remembered && remembered.resultText)
    || firstSentence(context.sideQuestEpilogue)
    || firstSentence(context.narrativeEpilogue)
    || cleanText(config && config.noteFallback, 80)
    || '一路所得没有另立库存，都已收进这几句里。';
  const note = `${facts.length ? `${facts.join('，')}。` : ''}${echo}`;
  const lines = selected.map(line => ({
    chapter: line.chapter, id: cleanId(line.id), text: cleanText(line.text),
    motif: cleanText(line.motif, 24), tone: cleanText(line.tone, 24)
  }));
  return {
    version: 1,
    title: chooseTitle(config, selected, endingKey, aggregate, context),
    byline: cleanText(context.playerName, 40) || '无名氏',
    lines,
    endingLine: cleanText(ending.line) || FALLBACK_ENDINGS.default.line,
    note: cleanText(note, 220),
    seal: cleanText(ending.seal, 16) || FALLBACK_ENDINGS.default.seal,
    sourceRefs: lines.map(line => line.id).concat(poetryState.moments.map(item => item.refId).filter(Boolean).slice(-3))
  };
}
