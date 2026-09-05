#!/usr/bin/env node
/**
 * 将正式配置从数值 v1 迁移至 v2。
 *
 * 这是一次性、显式运行的内容迁移，不在浏览器中偷偷改写配置。执行前用 Git
 * 审查差异；再次执行会因 numericVersion=2 直接拒绝，避免二次放大。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = path.join(ROOT, 'config');
const SCALE = { attr: 10, insp: 10, insight: 10, progress: 1000, bp: 10000 };
const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const integer = value => Math.round(n(value));
const scale = (value, unit) => integer(n(value) * SCALE[unit]);
const attrKeys = new Set(['shi', 'ci', 'lian', 'bi', 'xue', 'si']);
const rateKeys = new Set(['pct', 'ratio', 'fraction', 'retention', 'chance', 'minPct', 'maxPct', 'highPct', 'lowMult', 'highMult', 'scorePct', 'nextBattlePct', 'singleDieBonus', 'perStepValue', 'fullValue', 'highValue', 'lowValue', 'themeFlat', 'synergyPct', 'convertPct', 'previousWinBonus', 'previousNonWinBonus', 'fillRatio', 'thresholdRatio', 'inspirationRatioMin', 'upgradeCostRate', 'inspirationBonusRate', 'attrRatio', 'midRate', 'highRate', 'softRate']);
const rateTypes = new Set(['style_pct', 'theme_pct', 'syn_pct', 'palace_pct', 'dice_pattern', 'extra_dice_pct', 'comeback', 'battle_history_pct', 'armory_pct', 'style_switch_pct', 'manuscript_pct', 'streak_pct', 'restraint_pct', 'weakness_reward', 'dice_commitment', 'copy_affinity', 'borrow_signature', 'extra_dice_chain', 'dice_transform', 'seal_signature', 'attr_pct', 'next_battle_pct', 'lucky_six', 'streak_mult']);
const insightTypes = new Set(['on_win_bonus', 'draw_bonus', 'study_bonus']);
const inspirationTypes = new Set(['insp_on_win', 'insp_turn_regen', 'insp_floor', 'palace_insp', 'insp_on_quiz', 'insp_battle_recover', 'insp_max']);

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const scaleAttrs = attrs => {
  if (!attrs || typeof attrs !== 'object') return;
  for (const key of attrKeys) if (key in attrs) attrs[key] = scale(attrs[key], 'attr');
};
const scaleReward = reward => {
  if (!reward || typeof reward !== 'object') return;
  if (!('value' in reward)) return;
  if (reward.type === 'fragment') reward.value = scale(reward.value, 'progress');
  else if (reward.type === 'inspiration' || reward.type === 'inspirationMax') reward.value = scale(reward.value, 'insp');
  else if (reward.type === 'insight') reward.value = scale(reward.value, 'insight');
  else if (reward.type === 'attr') reward.value = scale(reward.value, 'attr');
};
function scaleEffect(effect) {
  if (!effect || typeof effect !== 'object') return;
  const type = effect.type || '';
  if (effect.attrs) scaleAttrs(effect.attrs);
  for (const [key, value] of Object.entries(effect)) {
    if (!Number.isFinite(Number(value))) continue;
    if (key === 'value') {
      if (type === 'attr_flat') effect[key] = scale(value, 'attr');
      else if (insightTypes.has(type)) effect[key] = scale(value, 'insight');
      else if (inspirationTypes.has(type)) effect[key] = scale(value, 'insp');
      else if (rateTypes.has(type)) effect[key] = scale(value, 'bp');
      continue;
    }
    if (rateKeys.has(key) && !(key === 'softRate' && !rateTypes.has(type))) effect[key] = scale(value, 'bp');
    else if (['cost', 'refund', 'baseCost', 'costStep', 'firstCostDiscount', 'conditionalFirstCostDiscount', 'startInspiration', 'startValue', 'onTalent', 'inspThreshold', 'maxInspiration', 'minInspiration'].includes(key)) effect[key] = scale(value, 'insp');
    else if (['threshold'].includes(key) && ['comeback', 'insp_battle_recover'].includes(type)) effect[key] = scale(value, 'insp');
  }
  if (effect.reward) scaleReward(effect.reward);
  if (effect.fullReward) scaleReward(effect.fullReward);
  for (const tier of (effect.tiers || [])) {
    if (Number.isFinite(Number(tier.value))) tier.value = scale(tier.value, 'bp');
    if (tier.reward) scaleReward(tier.reward);
  }
  // 军械库按设计分别修正六维或本场得分，消除同一效果被两条链路重复结算的歧义。
  if (type === 'armory_pct' && !effect.target) effect.target = effect.effectId === 'S22-E1' ? 'score' : 'attrs';
}
function scaleCommon(value, parentKey = '') {
  if (Array.isArray(value)) return value.forEach(item => scaleCommon(item, parentKey));
  if (!value || typeof value !== 'object') return;
  if (value.attrs) scaleAttrs(value.attrs);
  for (const [key, child] of Object.entries(value)) {
    if (key === 'attrs') continue;
    if (Number.isFinite(Number(child))) {
      if (['inspiration', 'inspirationMax'].includes(key)) value[key] = scale(child, 'insp');
      else if (key === 'insight') value[key] = scale(child, 'insight');
      else if (key === 'fragment') value[key] = scale(child, 'progress');
      else if (['nextBattlePct', 'scorePct', 'chance', 'pct', 'ratio', 'retention', 'inspirationRatioMin'].includes(key)) value[key] = scale(child, 'bp');
      else if (key === 'carryCost') value[key] = scale(child, 'insp');
      else if (parentKey === 'releaseInspirationByMerit') value[key] = scale(child, 'insp');
      else if (parentKey === 'scorePctByMerit') value[key] = scale(child, 'bp');
      else if (key === 'threshold' && parentKey === 'inspiration') value[key] = scale(child, 'insp');
    } else scaleCommon(child, key);
  }
}
function scaleAttrsConfig(attrs) {
  attrs.numericVersion = 2;
  scaleAttrs(attrs.initial);
  for (const key of ['schoolBonus', 'quizCorrectGain', 'zeCellGain', 'branchLandmarkGain']) attrs[key] = scale(attrs[key], 'attr');
  for (const key of ['battleWinGain']) if (Array.isArray(attrs[key])) attrs[key] = attrs[key].map(v => scale(v, 'attr'));
  for (const group of ['battleDrawGain', 'battleLoseGain']) if (attrs[group]) for (const [key, value] of Object.entries(attrs[group])) attrs[group][key] = scale(value, 'attr');
  const a = attrs.abilitySystem;
  if (a) {
    a.version = 3;
    const g = a.growth || {};
    for (const key of ['insightWin','insightDraw','insightLose','insightUpset','firstStylePerPhase','baseCost','catchupCost','specialistCost']) g[key] = scale(g[key], 'insight');
    for (const key of ['catchupGap','specialistGap']) g[key] = scale(g[key], 'attr');
    const study = a.study || {};
    study.baseInsightCap = scale(study.baseInsightCap, 'insight');
    study.insightCapPerXue = scale(study.insightCapPerXue, 'attr');
    study.slotPerXue = scale(study.slotPerXue, 'attr');
    study.slotMilestones = (study.slotMilestones || []).map(v => scale(v, 'attr'));
    study.progressNeed = scale(study.progressNeed, 'progress');
    study.progressPerXue = 4;
    const strategy = a.strategy || {};
    strategy.chargePerSi = scale(strategy.chargePerSi, 'attr');
    strategy.capPerSi = scale(strategy.capPerSi, 'attr');
    if (strategy.plans?.steady) strategy.plans.steady.fragmentGain = scale(strategy.plans.steady.fragmentGain, 'progress');
    if (strategy.plans?.guard) strategy.plans.guard.lossReduce = scale(strategy.plans.guard.lossReduce, 'insp');
    if (strategy.plans?.switch) strategy.plans.switch.scorePct = scale(strategy.plans.switch.scorePct, 'bp');
    const manuscript = a.manuscript || {};
    manuscript.capPerBi = scale(manuscript.capPerBi, 'attr');
    manuscript.fragmentPerBi = 5;
    manuscript.fragmentNeed = scale(manuscript.fragmentNeed, 'progress');
    for (const key of ['fragmentFastBi','bonusPageBi','volumeRefundBi']) manuscript[key] = scale(manuscript[key], 'attr');
    manuscript.polishDiscount = scale(manuscript.polishDiscount, 'insp');
    manuscript.publishInspiration = scale(manuscript.publishInspiration, 'insp');
  }
  for (const style of Object.values(attrs.styleSystem || {})) {
    for (const key of ['lowMult','highMult','highPct','switchPct']) if (key in style) style[key] = scale(style[key], 'bp');
    if ('singleDieInsight' in style) style.singleDieInsight = scale(style.singleDieInsight, 'insight');
    if ('firstExtraDiscount' in style) style.firstExtraDiscount = scale(style.firstExtraDiscount, 'insp');
    if ('catchupGap' in style) style.catchupGap = scale(style.catchupGap, 'attr');
    if ('lossInspirationReduce' in style) style.lossInspirationReduce = scale(style.lossInspirationReduce, 'insp');
  }
  attrs.talentDropRate = scale(attrs.talentDropRate, 'bp');
  if (attrs.diminish) {
    attrs.diminish.soft = scale(attrs.diminish.soft, 'attr');
    attrs.diminish.hard = scale(attrs.diminish.hard, 'attr');
    attrs.diminish.midRate = scale(attrs.diminish.midRate, 'bp');
    attrs.diminish.highRate = scale(attrs.diminish.highRate, 'bp');
    attrs.diminish.minGain = scale(attrs.diminish.minGain, 'attr');
  }
  if (attrs.winScale) {
    attrs.winScale.min = scale(attrs.winScale.min, 'bp');
    attrs.winScale.max = scale(attrs.winScale.max, 'bp');
  }
}
function scaleInspirationConfig(inspiration) {
  for (const [key, value] of Object.entries(inspiration)) {
    if (['dicePct','extraDicePct'].includes(key)) inspiration[key] = scale(value, 'bp');
    else if (!['maxExtraDice', 'numericVersion'].includes(key)) inspiration[key] = scale(value, 'insp');
  }
  inspiration.numericVersion = 2;
}
function scaleAffinity(affinity) {
  affinity.numericVersion = 2;
  for (const [key, value] of Object.entries(affinity.matrix || {})) affinity.matrix[key] = scale(value, 'bp');
  for (const key of ['homeMannerBonus','homeAdaptiveBonus','zeitgeistThemeBonus','zeitgeistMannerBonus','momentumPer']) affinity[key] = scale(affinity[key], 'bp');
  for (const key of ['minPct','maxPct']) if (affinity.experimentalManner && key in affinity.experimentalManner) affinity.experimentalManner[key] = scale(affinity.experimentalManner[key], 'bp');
}
function scaleSchools(schools) {
  for (const school of schools) {
    const m = school.schoolMechanics || {};
    if ('knowledgeInsight' in m) m.knowledgeInsight = scale(m.knowledgeInsight, 'insight');
    if ('differentStyleInsight' in m) m.differentStyleInsight = scale(m.differentStyleInsight, 'insight');
    for (const key of ['inspirationBonusRate','upgradeCostRate','talentDropRate','talentDropCap']) if (key in m) m[key] = scale(m[key], 'bp');
    const conversion = m.talentConversion;
    if (conversion && conversion.resource === 'insight') conversion.cost = scale(conversion.cost, 'insight');
  }
}
function scaleNpcs(npcs) {
  for (const tier of npcs) {
    if (Array.isArray(tier.range)) tier.range = tier.range.map(v => scale(v, 'bp'));
    for (const npc of (tier.npcs || [])) {
      scaleAttrs(npc.attrs);
      const mech = npc.mech || {};
      const sig = mech.signature || {};
      for (const key of ['pct','floorPct']) if (key in sig) sig[key] = scale(sig[key], 'bp');
      const weak = mech.weakness || {};
      if (weak.partialReduction?.retention != null) weak.partialReduction.retention = scale(weak.partialReduction.retention, 'bp');
      if (weak.playerBonus != null) weak.playerBonus = scale(weak.playerBonus, 'battleScore');
    }
  }
}
function scaleSky(sky) { for (const card of sky) scaleEffect(card.effect); }
function scaleAlbumEffect(effect) {
  if (!effect || typeof effect !== 'object' || !('value' in effect)) return;
  if (effect.type === 'attr') effect.value = scale(effect.value, 'attr');
  else if (effect.type === 'inspiration' || effect.type === 'inspirationMax') effect.value = scale(effect.value, 'insp');
  else if (effect.type === 'insight') effect.value = scale(effect.value, 'insight');
  else if (effect.type === 'pct') effect.value = scale(effect.value, 'bp');
}
function scaleAlbum(album) {
  for (const card of album || []) {
    scaleAlbumEffect(card.reward);
    for (const branch of card.branches || []) for (const effect of branch.effects || []) scaleAlbumEffect(effect);
  }
}
function scaleTalentCollection(talents, upgrades) {
  for (const talent of talents || []) { scaleEffect(talent.effect); if (Number.isFinite(Number(talent.cost))) talent.cost = scale(talent.cost, 'insp'); }
  for (const up of Object.values(upgrades || {})) {
    if (Array.isArray(up.upCost)) up.upCost = up.upCost.map(v => scale(v, 'insp'));
    for (const level of (up.levels || [])) { scaleEffect(level.effect); if (Number.isFinite(Number(level.cost))) level.cost = scale(level.cost, 'insp'); }
  }
}
function scaleSynergies(synergies) { for (const synergy of synergies || []) for (const effect of synergy.effects || []) scaleEffect(effect); }
function scaleNpcMechanics(m) { scaleCommon(m); }
function scaleProject(project) {
  project.numericVersion = 2;
  scaleTalentCollection(project.talents, project['talent-upgrade']);
  scaleTalentCollection((project['sidequest-talents'] || {}).talents, (project['sidequest-talents'] || {}).upgrades);
  scaleSynergies(project.synergies);
  if (project.affinity) scaleAffinity(project.affinity);
  if (project.npcs) scaleNpcs(project.npcs);
  if (project.sky) scaleSky(project.sky);
  if (project.album) scaleAlbum(project.album);
  if (project['sidequest-npcs']) scaleNpcs(Object.values(project['sidequest-npcs'].routes || {}).map(route => ({ npcs: Object.values(route?.npcs || {}) })));
  // 终局评分保持旧量级；仅其输入属性/灵感由规则层换算，不改等级配置。
  for (const key of ['events', 'sidequests']) scaleCommon(project[key]);
}

function replaceEditorSeed(file, name, value) {
  const source = fs.readFileSync(file, 'utf8');
  const marker = `window.${name} = `;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`编辑器种子缺少 ${name}：${file}`);
  const jsonStart = start + marker.length;
  let quote = false, escape = false, depth = 0, end = -1;
  for (let i = jsonStart; i < source.length; i++) {
    const ch = source[i];
    if (quote) { if (escape) escape = false; else if (ch === '\\') escape = true; else if (ch === '"') quote = false; continue; }
    if (ch === '"') { quote = true; continue; }
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') { if (--depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) throw new Error(`编辑器种子 ${name} JSON 未闭合：${file}`);
  fs.writeFileSync(file, `${source.slice(0, jsonStart)}${JSON.stringify(value, null, 2)}${source.slice(end)}`, 'utf8');
}

const changedFiles = ['attrs.json', 'inspiration.json', 'affinity.json', 'schools.json', 'npcs.json', 'sidequest-npcs.json', 'sky.json', 'talents.json', 'talent-upgrade.json', 'sidequest-talents.json', 'synergies.json', 'events.json', 'album.json', 'sidequests.json'];
const configs = Object.fromEntries(changedFiles.map(name => [name, read(path.join(CONFIG, name))]));
if (Number(configs['attrs.json']?.numericVersion) === 2) throw new Error('配置已是 numericVersion=2，拒绝二次迁移。');
scaleAttrsConfig(configs['attrs.json']);
scaleInspirationConfig(configs['inspiration.json']);
scaleAffinity(configs['affinity.json']);
scaleSchools(configs['schools.json']);
scaleNpcs(configs['npcs.json']);
scaleNpcs(Object.values(configs['sidequest-npcs.json']?.routes || {}).map(route => ({ npcs: Object.values(route?.npcs || {}) })));
scaleSky(configs['sky.json']);
scaleTalentCollection(configs['talents.json'], configs['talent-upgrade.json']);
scaleTalentCollection(configs['sidequest-talents.json']?.talents, configs['sidequest-talents.json']?.upgrades);
scaleSynergies(configs['synergies.json']);
scaleAlbum(configs['album.json']);
for (const name of ['events.json','sidequests.json']) scaleCommon(configs[name]);
for (const [name, value] of Object.entries(configs)) write(path.join(CONFIG, name), value);

const EDITOR = path.join(ROOT, 'feihua-editors', 'assets', 'js');
for (const [file, name, value] of [
  ['seed-affinity.js', 'GAME_AFFINITY', configs['affinity.json']],
  ['seed-sky.js', 'GAME_SKY', configs['sky.json']],
  ['seed-events.js', 'GAME_EVENTS', configs['events.json']],
  ['seed-album.js', 'GAME_ALBUM', configs['album.json']],
  ['seed-npcs.js', 'GAME_NPCS', configs['npcs.json']],
  ['seed-talents.js', 'GAME_TALENTS', configs['talents.json']],
  ['seed-talent-upgrade.js', 'GAME_TALENT_UPGRADE', configs['talent-upgrade.json']],
  ['seed-synergies.js', 'GAME_SYNERGIES', configs['synergies.json']],
  ['seed-copy.js', 'GAME_SCHOOLS', configs['schools.json']],
  ['seed-sidequests.js', 'GAME_SIDEQUEST_NPCS', configs['sidequest-npcs.json']],
  ['seed-sidequests.js', 'GAME_SIDEQUESTS', configs['sidequests.json']],
  ['seed-sidequests.js', 'GAME_SIDEQUEST_TALENTS', configs['sidequest-talents.json'].talents],
  ['seed-sidequests.js', 'GAME_SIDEQUEST_TALENT_UPGRADE', configs['sidequest-talents.json'].upgrades],
  ['seed-sidequests.js', 'GAME_SIDEQUEST_TALENT_OFFERS', configs['sidequest-talents.json'].offers]
]) replaceEditorSeed(path.join(EDITOR, file), name, value);

const contentPath = path.join(ROOT, 'feihua-content.json');
const content = read(contentPath);
if (Number(content.numericVersion) !== 2) {
  scaleProject(content);
  content._version = (Number(content._version) || 1) + 1;
  write(contentPath, content);
}
// 首轮负责资源、属性与已知效果单位；补全器继续处理 NPC 行为倍率、天象选择与评分软上限。
// 两步同属一次迁移命令，避免任一入口保留小数比例。
execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'complete-numeric-v2.mjs')], { stdio: 'inherit' });
console.log(`数值 v2 迁移完成：${changedFiles.length} 份正式配置、云端工程与编辑器种子。`);
