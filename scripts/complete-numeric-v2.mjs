#!/usr/bin/env node
/**
 * 补全数值 v2 首轮迁移中遗漏的比例字段。
 *
 * 仅处理已经是 numericVersion=2 的工程，且只放大仍以小数书写的比例／倍率；
 * 已是 bp 的整数保持原样。它把正式配置、云端工程和编辑器种子一起写回，
 * 使三个入口不再出现同一字段两种单位。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = path.join(ROOT, 'config');
const BP = 10000;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const isNumber = value => Number.isFinite(Number(value));
// 已迁移的 bp 至少为 3；原始比例／倍率在本工程均落在 [-2, 2]。
// 这样可以补齐 JSON 把 1.0 解析为整数 1 的情况，又能安全重复执行。
const toBp = value => Math.abs(Number(value)) <= 2 ? Math.round(Number(value) * BP) : Number(value);

const EFFECT_RATE_KEYS = new Set([
  'cap', 'chance', 'fraction', 'mult', 'penalty', 'ratio', 'retention',
  'inspirationRatioMin', 'lowMult', 'highMult', 'minPct', 'maxPct', 'highPct',
  'scorePct', 'nextBattlePct', 'perStepValue', 'fullValue', 'highValue', 'lowValue',
  'themeFlat', 'synergyPct', 'convertPct', 'previousWinBonus', 'previousNonWinBonus',
  'fillRatio', 'thresholdRatio', 'upgradeCostRate', 'inspirationBonusRate', 'attrRatio',
  'midRate', 'highRate'
]);
const RATE_VALUE_TYPES = new Set([
  'attr_pct', 'battle_history_pct', 'comeback', 'copy_affinity', 'dice_commitment',
  'dice_pattern', 'dice_transform', 'extra_dice_chain', 'extra_dice_pct', 'lucky_six',
  'manuscript_pct', 'next_battle_pct', 'palace_pct', 'restraint_pct', 'seal_signature',
  'streak_mult', 'streak_pct', 'style_pct', 'style_switch_pct', 'syn_pct', 'theme_pct',
  'weakness_reward'
]);
const NPC_RATE_KEYS = new Set([
  'bias', 'bottom', 'cap', 'floorPct', 'intentBias', 'minWeaknessRetention', 'pct',
  'playerBonus', 'retention', 'weaknessDampen', 'extraShutdown'
]);

function scaleEffect(effect) {
  if (!effect || typeof effect !== 'object') return;
  const type = String(effect.type || '');
  for (const [key, value] of Object.entries(effect)) {
    if (!isNumber(value)) continue;
    if (EFFECT_RATE_KEYS.has(key)) effect[key] = toBp(value);
    else if (key === 'value' && RATE_VALUE_TYPES.has(type)) effect[key] = toBp(value);
    else if (type === 'sky_strategy' && key === 'value' && effect.key === 'battle_attack_pct') effect[key] = toBp(value);
    // 「避风收笔」是灵感损失减免，采用灵感十倍单位；其余天象应势 value 为次数／格数／进度，由各自分支处理。
    else if (type === 'sky_strategy' && key === 'value' && effect.key === 'battle_guard' && Math.abs(Number(value)) <= 2) effect[key] = Math.round(Number(value) * 10);
    else if (type === 'sky_strategy' && key === 'value' && effect.key === 'ping_fragment' && Math.abs(Number(value)) <= 2) effect[key] = Math.round(Number(value) * 1000);
  }
  if (effect.when && typeof effect.when === 'object') {
    if (isNumber(effect.when.inspirationRatioMin)) effect.when.inspirationRatioMin = toBp(effect.when.inspirationRatioMin);
  }
  if (effect.reward) scaleEffect(effect.reward);
  if (effect.fullReward) scaleEffect(effect.fullReward);
  for (const tier of (effect.tiers || [])) {
    if (isNumber(tier && tier.value)) tier.value = toBp(tier.value);
    if (tier && tier.reward) scaleEffect(tier.reward);
  }
}

function scaleNpcRates(value) {
  if (Array.isArray(value)) return value.forEach(scaleNpcRates);
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (NPC_RATE_KEYS.has(key) && isNumber(child)) value[key] = toBp(child);
    // NPC 的小数 threshold 只用于分差／招牌百分比；骰点阈值保持整数。
    else if (key === 'threshold' && isNumber(child) && !Number.isInteger(Number(child))) value[key] = toBp(child);
    else scaleNpcRates(child);
  }
}

function scaleNpcBudget(library) {
  const budget = library && library.budget;
  if (!budget || typeof budget !== 'object') return;
  for (const key of ['signatureMain', 'signatureWeakRatio', 'weaknessShutdown', 'playerBonus', 'intentBottom']) {
    const group = budget[key];
    if (!group || typeof group !== 'object') continue;
    for (const [tier, value] of Object.entries(group)) {
      if (Array.isArray(value)) group[tier] = value.map(toBp);
      else if (isNumber(value)) group[tier] = toBp(value);
    }
  }
}

function scaleEffectsIn(value) {
  if (Array.isArray(value)) return value.forEach(scaleEffectsIn);
  if (!value || typeof value !== 'object') return;
  if (value.type) scaleEffect(value);
  for (const child of Object.values(value)) scaleEffectsIn(child);
}

function scaleProject(project) {
  scaleEffectsIn(project.talents);
  scaleEffectsIn(project['talent-upgrade']);
  scaleEffectsIn(project['sidequest-talents']);
  scaleEffectsIn(project.synergies);
  scaleEffectsIn(project.sky);
  scaleEffectsIn(project.album);
  scaleNpcRates(project.npcs);
  scaleNpcRates(project['sidequest-npcs']);
  scaleNpcRates(project['npc-mechanics']);
  scaleNpcBudget(project['npc-mechanics']);
  for (const school of (project.schools || [])) {
    const conversion = school && school.schoolMechanics && school.schoolMechanics.talentConversion;
    if (conversion && isNumber(conversion.chance)) conversion.chance = toBp(conversion.chance);
  }
  if (project.grades && Array.isArray(project.grades.dimensions)) {
    project.grades.numericVersion = 2;
    for (const dim of project.grades.dimensions) {
      if (dim && dim.coeff && isNumber(dim.coeff.softRate)) dim.coeff.softRate = toBp(dim.coeff.softRate);
    }
  }
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

// 云端工程是正式配置的完整镜像。显式列出它能覆盖的每一块，避免某个
// 编辑器未触及的比例字段继续停留在旧的小数单位。
const names = [
  'questions', 'events', 'talents', 'talent-upgrade', 'npcs', 'affinity',
  'synergies', 'board', 'sky', 'album', 'schools', 'grades', 'narrative',
  'sidequests', 'sidequest-npcs', 'sidequest-talents', 'npc-mechanics'
];
const cfg = Object.fromEntries(names.map(name => [name, read(path.join(CONFIG, `${name}.json`))]));
if (Number(read(path.join(CONFIG, 'attrs.json')).numericVersion) !== 2) throw new Error('仅可对 numericVersion=2 工程补全迁移。');
scaleProject(cfg);
for (const [name, value] of Object.entries(cfg)) write(path.join(CONFIG, `${name}.json`), value);

const editor = path.join(ROOT, 'feihua-editors', 'assets', 'js');
for (const [file, name, value] of [
  ['seed-sky.js', 'GAME_SKY', cfg.sky],
  ['seed-npcs.js', 'GAME_NPCS', cfg.npcs],
  ['seed-talents.js', 'GAME_TALENTS', cfg.talents],
  ['seed-talent-upgrade.js', 'GAME_TALENT_UPGRADE', cfg['talent-upgrade']],
  ['seed-synergies.js', 'GAME_SYNERGIES', cfg.synergies],
  ['seed-copy.js', 'GAME_SCHOOLS', cfg.schools],
  ['seed-copy.js', 'GAME_GRADES', cfg.grades],
  ['seed-sidequests.js', 'GAME_SIDEQUEST_NPCS', cfg['sidequest-npcs']],
  ['seed-sidequests.js', 'GAME_SIDEQUEST_TALENTS', cfg['sidequest-talents'].talents],
  ['seed-sidequests.js', 'GAME_SIDEQUEST_TALENT_UPGRADE', cfg['sidequest-talents'].upgrades]
]) replaceEditorSeed(path.join(editor, file), name, value);

const contentFile = path.join(ROOT, 'feihua-content.json');
const content = read(contentFile);
if (Number(content.numericVersion) !== 2) throw new Error('云端工程不是 numericVersion=2。');
const contentBefore = JSON.stringify(content);
for (const name of names) {
  // npc-mechanics 不是当前编辑器工程字段，仍在正式配置中保留；其余字段
  // 全部按同一份已迁移配置写入云端工程，保证覆盖后单位没有分叉。
  if (name !== 'npc-mechanics') content[name] = cfg[name];
}
content.numericVersion = 2;
if (JSON.stringify(content) !== contentBefore) {
  content._version = (Number(content._version) || 1) + 1;
  write(contentFile, content);
}
console.log('数值 v2 比例字段补全完成：正式配置、云端工程与编辑器种子已同步。');
