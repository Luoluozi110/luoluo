#!/usr/bin/env node
/** 阶段 A/B/C：文心与羁绊强反馈配置迁移。可重复执行。 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CFG = path.join(ROOT, 'feihuaqi-playable', 'config');
const read = name => JSON.parse(fs.readFileSync(path.join(CFG, `${name}.json`), 'utf8'));
const write = (name, data) => fs.writeFileSync(path.join(CFG, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`);
const talents = read('talents');
const upgrades = read('talent-upgrade');
const attrs = read('attrs');
attrs.talentDropRate = 0.22;
write('attrs', attrs);

const COSTS = {
  common: [4, 7], rare: [5, 8, 12], epic: [6, 9, 13, 18], legend: [7, 10, 14, 19, 25]
};
const values = {
  T001: [2, 3, 5], T002: [2, 3, 5], T003: [2, 3, 5], T004: [3, 4, 6],
  T007: [.08, .10, .12, .14, .16], T012: [3, 4, 5, 7], T013: [3, 4, 5, 7],
  T014: [3, 4, 5, 7], T017: [2, 3, 4], T018: [2, 3, 5],
  T020: [.10, .12, .15, .18], T021: [.15, .18, .22, .25], T022: [.4, .5, .65, .8],
  T023: [16, 18, 20, 22, 24], T024: [1.25, 1.30, 1.35, 1.42, 1.50],
  T025: [.12, .14, .16, .20, .24], T032: [8, 10, 12, 14, 16],
  T033: [14, 16, 18, 22, 25, 28], T035: [.12, .15, .18, .24],
  T040: [.08, .10, .12, .14, .16], T099: [.15, .18, .21, .24, .27, .30],
  TA05: [.14, .18, .22, .28]
};

for (const [id, spec] of Object.entries(upgrades)) {
  const quality = spec.quality || 'common';
  spec.upCost = COSTS[quality].slice(0, Math.max(0, spec.maxLevel - 1));
  if (values[id]) spec.levels.forEach((lv, i) => { if (i < values[id].length) lv.effect.value = values[id][i]; });
}

const tune = (id, fn) => upgrades[id]?.levels?.forEach((lv, i) => fn(lv.effect, i));
tune('T004', (e, i) => { if (e.attrs) e.attrs.xue = [3, 4, 6][i]; });
tune('T007', (e, i) => { if (i === 4) e.reward = { type: 'fragment', value: 1, perMatch: false }; });
tune('T011', (e, i) => {
  e.ratio = [.8, .9, 1, 1, 1.1, 1.2][i];
  if (i >= 1) e.revealIntent = true;
  if (i >= 3) e.synergyPct = .04;
  if (i >= 4) e.themeFlat = .04;
  if (i >= 5) { e.convertWeakness = true; e.revealWeakness = true; }
});
tune('T019', (e, i) => { e.type = 'insp_turn_regen'; e.value = [1, 1, 2, 2][i]; e.thresholdRatio = [.5, .6, .6, .7][i]; e.onTalent = [2, 2, 3, 4][i]; });
tune('T020', (e, i) => { e.singleDieBonus = [0, .02, .03, .05][i]; });
tune('T021', (e, i) => { if (i >= 2) e.reward = { type: 'inspiration', value: i === 2 ? 1 : 2, perMatch: false }; });
tune('T024', (e, i) => { if (i === 4) e.reward = { type: 'inspiration', value: 1, perMatch: false }; });
tune('T025', (e, i) => { e.threshold = [12, 13, 14, 16, 18][i]; });
tune('T026', (e, i) => { e.step = [3, 3, 3, 2, 2][i]; e.value = [.04, .05, .06, .04, .05][i]; e.cap = [.12, .15, .18, .20, .25][i]; });
tune('T027', (e, i) => { e.value = [2, 3, 4, 5][i]; e.nextBattlePct = [.04, .06, .08, .08][i]; });
tune('T028', (e, i) => { e.value = [3, 3, 4, 4, 5][i]; e.startValue = [4, 5, 6, 7, 8][i]; e.scorePct = [0, .02, .04, .06, .08][i]; });
tune('T029', (e, i) => { e.value = [1, 1, 2, 2][i]; e.thresholdRatio = [.5, .6, .6, .7][i]; });
tune('T030', (e, i) => { e.value = [2, 2, 3, 3][i]; e.maxTriggers = [4, 5, 5, 6][i]; delete e.firstInsight; });
tune('T031', (e, i) => { e.value = [3, 3, 3, 4, 4][i]; e.threshold = [16, 18, 20, 20, 22][i]; e.maxTriggers = [3, 3, 4, 4, 5][i]; });
tune('T032', (e, i) => { e.fillRatio = [.5, .5, .75, .75, 1][i]; });
tune('T033', (e, i) => { e.fillRatio = [.5, .5, .6, .7, .8, 1][i]; });
tune('T034', (e, i) => { e.startInspiration = [8, 8, 10, 10, 12, 12][i]; });
tune('T035', (e, i) => { e.reward = { type: 'insight', value: [1, 1, 2, 3][i], perMatch: false }; });
tune('T040', (e, i) => { e.reward = { type: 'fragment', value: [1, 1.5, 2, 2.5, 3][i], perMatch: false }; });
tune('T099', (e, i) => { e.startInspiration = [4, 4, 5, 6, 7, 8][i]; delete e.firstWinInsight; });
tune('TA05', (e, i) => { e.cost = [2, 2, 1, 1][i]; e.refund = [1, 1, 1, 2][i]; });
tune('TA08', (e, i) => { e.baseCost = [4, 3, 2][i]; e.costStep = [2, 1, 0][i]; e.cost = [4, 3, 2][i]; delete e.firstStrategy; });

// 阶段 A：游戏卡面与运行时 Lv1 以同一份数据为准。
for (const talent of talents) {
  const lv1 = upgrades[talent.id]?.levels?.[0]?.effect;
  if (lv1) talent.effect = structuredClone(lv1);
  if (talent.kind === 'active' && upgrades[talent.id]?.levels?.[0]?.cost != null) talent.cost = Number(upgrades[talent.id].levels[0].cost);
  // 独立 talent-upgrade.json 是唯一升级权威源，移除历史内嵌副本以免编辑器往返漂移。
  delete talent.upgrade;
}
if (upgrades.TA05) upgrades.TA05.levels.forEach((lv, i) => { lv.cost = [2, 2, 1, 1][i]; });
if (upgrades.TA08) upgrades.TA08.levels.forEach((lv, i) => { lv.cost = [4, 3, 2][i]; });
for (const talent of talents) if (talent.kind === 'active' && upgrades[talent.id]?.levels?.[0]?.cost != null) talent.cost = Number(upgrades[talent.id].levels[0].cost);
write('talent-upgrade', upgrades);
write('talents', talents);

const old = read('synergies');
const byId = new Map(old.map(s => [s.id, s]));
const specs = [
  ['S01','诗酒剑气',['T001','T007'],'诗势与梦笔交映：诗体得分 +10%；出现六点再 +6%。', [{type:'style_pct',style:'shi',value:.10},{type:'dice_pattern',pattern:'six',value:.06}]],
  ['S02','倚声双绝',['T002','T006'],'倚声入骨：词体得分 +8%；以词获胜时词力额外 +3。', [{type:'style_pct',style:'ci',value:.08},{type:'on_win_bonus',style:'ci',value:3}]],
  ['S03','联坛霸才',['T003','T010'],'机锋不拘：联体得分 +10%；三枚及以上点数各异再 +8%。', [{type:'style_pct',style:'lian',value:.10},{type:'dice_pattern',pattern:'all_distinct',minDice:3,value:.08}]],
  ['S04','思涌笔健',['T016','T005'],'多骰得分 +3%；骰面先低后高时再 +16%，首枚额外骰费用 -1。', [{type:'extra_dice_pct',value:.03,firstCostDiscount:1},{type:'dice_pattern',pattern:'low_then_high',value:.16}]],
  ['S05','通儒蕴藉',['T004','T009'],'学养深厚：论战得分 +8%；有效答题回复 1 灵感（每局 3 次）。', [{type:'syn_pct',value:.08},{type:'insp_on_quiz',value:1,maxTriggers:3}]],
  ['S06','文运亨通',['T017','T018'],'获胜回复 2 灵感；上一场未胜时，本场得分 +8%。', [{type:'insp_on_win',value:2},{type:'battle_history_pct',result:'nonwin',value:.08}]],
  ['S07','梦笔泉涌',['T007','T016'],'出现六点得分 +6%；骰面严格递增时再 +16%。', [{type:'dice_pattern',pattern:'six',value:.06},{type:'dice_pattern',pattern:'ascending',value:.16}]],
  ['S08','笔墨相宣',['T006','T008'],'笔力与思力交润，论战得分 +10%。', [{type:'syn_pct',value:.10}]],
  ['S09','洛阳才调',['T017','T019'],'灵感不低于上限 60% 时，论战得分 +10%。', [{type:'syn_pct',value:.10,when:{inspirationRatioMin:.6}}]],
  ['S10','梦花偶得',['T007','T040'],'出现六点时得分 +10%，并获得 1 页稿本。', [{type:'dice_pattern',pattern:'six',value:.10,reward:{type:'fragment',value:1,perMatch:false}}]],
  ['S11','七步珠玑',['TA01','T036'],'骰点总和为 7 的倍数时，得分 +16%，并获得 2 点心得。', [{type:'dice_pattern',pattern:'total_multiple',divisor:7,value:.16,reward:{type:'insight',value:2,perMatch:false}}]],
  ['S12','绝处逢春',['T025','T031'],'灵感不高于 16 时得分 +14%；战后回复 3 灵感（每局 3 次）。', [{type:'comeback',threshold:16,value:.14},{type:'insp_battle_recover',threshold:16,value:3,maxTriggers:3}]],
  ['S13','换笔成章',['T037','TA02'],'换用文体时得分 +14%，并获得 2 点心得。', [{type:'style_switch_pct',value:.14,insight:2}]],
  ['S14','稿本生辉',['T038','T040'],'每 2 页稿本得分 +3%，最多 +18%。', [{type:'manuscript_pct',step:2,value:.03,cap:.18}]],
  ['S15','连捷成章',['T039','T022'],'同文体连捷 2 场后得分 +14%；出现对子回复 2 灵感。', [{type:'streak_pct',minStreak:2,value:.14},{type:'dice_pattern',pattern:'pair',value:0,reward:{type:'inspiration',value:2,perMatch:false}}]],
  ['S16','殿前蓄势',['T028','T099'],'殿试每场回复 4 灵感，入场时先回复 5 灵感；殿试得分 +8%。', [{type:'palace_insp',value:4,startValue:5},{type:'palace_pct',value:.08}]],
  ['S17','问学相长',['T030','T009'],'有效答题回复 2 灵感（每局 5 次）。', [{type:'insp_on_quiz',value:2,maxTriggers:5}]],
  ['S18','诗胆雄心',['T020','T021'],'以诗出战且选择勇武时得分 +18%，触发后获得 1 页稿本。', [{type:'style_pct',style:'shi',value:.18,when:{themes:['yongwu']},reward:{type:'fragment',value:1,perMatch:false}}]],
  ['S19','六曜回响',['T024','TA07'],'使用指定文心后，出现六点得分 +16%，并回复 1 灵感。', [{type:'dice_pattern',pattern:'six',value:.16,when:{usedTalents:['TA07']},reward:{type:'inspiration',value:1,perMatch:false}}]],
  ['S20','连掷成势',['TA05','TA06'],'使用任一连骰文心后，总点≥12 得分 +12%，≥16 得分 +22%，并回复 2 灵感。', [{type:'dice_pattern',pattern:'total_tiers',tiers:[{min:12,value:.12},{min:16,value:.22}],when:{usedAnyTalents:['TA05','TA06']},reward:{type:'inspiration',value:2,perMatch:false}}]],
  ['S21','鉴古知今',['T011','T027'],'游学心得 +2；上一场未胜时本场得分 +12%。', [{type:'study_bonus',value:2,nextBattlePct:.08},{type:'battle_history_pct',result:'nonwin',value:.12}]],
  ['S22','百炼归真',['T026','T034'],'每 4 点兵器属性令得分 +3%，最多 +15%。', [{type:'armory_pct',step:4,value:.03,cap:.15}]],
  ['S23','源流不息',['T032','T029'],'回合开始时若灵感低于 60%，回复 2 灵感。', [{type:'insp_turn_regen',value:2,thresholdRatio:.6}]],
  ['S24','诗魁殿声',['T099','T012'],'殿试以诗出战时得分 +18%；以诗获胜时诗力 +3。', [{type:'palace_pct',value:.18,when:{styles:['shi']}},{type:'on_win_bonus',style:'shi',value:3}]],
  ['S25','词联双璧',['T013','T014'],'在词、联之间换体时得分 +16%，并获得 2 点心得。', [{type:'style_switch_pct',value:.16,insight:2,when:{stylePair:['ci','lian']}}]]
];
const synergies = specs.map(([id,name,members,desc,effects]) => ({
  id, name, members, desc,
  effects: effects.map((e, i) => ({ effectId: `${id}-E${i + 1}`, stackGroup: e.stackGroup || 'synergy-score', stackMode: e.stackMode || 'add', ...e }))
}));
write('synergies', synergies);
console.log(`已迁移 ${talents.length} 枚文心、${Object.keys(upgrades).length} 条升级、${synergies.length} 条羁绊。`);
