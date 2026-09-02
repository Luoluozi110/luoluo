#!/usr/bin/env node
/**
 * 文心羁绊补全：
 * - 定点强化弱势文心，并同步 Lv1/升级曲线；
 * - 新增 S26—S48，使主线与支线全部文心至少拥有两名不同羁绊伙伴；
 * - 同步游戏配置、编辑器种子和云端内容基准。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/[A-Za-z]:/, s => s.slice(1))), '..');
const CFG = path.join(ROOT, 'feihuaqi-playable', 'config');
const SEED = path.join(ROOT, 'feihua-editors', 'assets', 'js');
const CONTENT = path.join(ROOT, 'feihua-content.json');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
const cfg = name => path.join(CFG, `${name}.json`);

const talents = read(cfg('talents'));
const upgrades = read(cfg('talent-upgrade'));
const sidequest = read(cfg('sidequest-talents'));
let synergies = read(cfg('synergies'));
const talentById = new Map([...talents, ...(sidequest.talents || [])].map(t => [t.id, t]));

function patchTalent(id, effect, text) {
  const talent = talentById.get(id);
  if (!talent) throw new Error(`缺少文心 ${id}`);
  talent.effect = structuredClone(effect);
  if (text) talent.text = text;
  const table = upgrades[id] || (sidequest.upgrades || {})[id];
  if (!table || !table.levels || !table.levels[0]) throw new Error(`缺少升级表 ${id}`);
  table.levels[0].effect = structuredClone(effect);
}

patchTalent('T009', { type: 'attr_flat', attrs: { xue: 3 } },
  '晋人车胤囊萤照读，孙康映雪读书。贫不废学，学力常驻 +3。');
upgrades.T009.levels = [3, 4, 5].map(value => ({ effect: { type: 'attr_flat', attrs: { xue: value } } }));

patchTalent('T015', { type: 'comeback', threshold: 14, value: 0.16 },
  '「大凡物不得其平则鸣。」——韩愈《送孟东野序》。灵感不高于 14 时，胸中块垒尽发，本场得分 +16%。需先有「哲思派」倾向。');
upgrades.T015.levels = [
  [14, .16], [15, .18], [16, .20], [17, .22], [18, .24]
].map(([threshold, value]) => ({ effect: { type: 'comeback', threshold, value } }));

patchTalent('T018', { type: 'draw_bonus', value: 3 },
  '王羲之《兰亭集序》载：引以为流觞曲水，列坐其次。雅集唱和，从容不迫——与对手平分秋色时，出战文体额外 +3。');
upgrades.T018.levels = [3, 4, 6].map(value => ({ effect: { type: 'draw_bonus', value } }));

patchTalent('T024', { type: 'lucky_six', mult: 1.25 },
  '「六」者，顺也。灵感骰若掷出六点，灵思沛然，本场得分 ×1.25。');
upgrades.T024.levels = [1.25, 1.30, 1.35, 1.42, 1.50].map((mult, index) => ({
  effect: { type: 'lucky_six', mult, ...(index === 4 ? { reward: { type: 'inspiration', value: 1, perMatch: false } } : {}) }
}));

patchTalent('T038', { type: 'manuscript_pct', step: 2, value: .03, cap: .15 },
  '胸中已有篇章，落笔自见经营。每持有 2 页稿本，作品得分 +3%，最多 +15%。');
upgrades.T038.levels = [
  [.03, .15], [.035, .16], [.04, .18], [.05, .20]
].map(([value, cap]) => ({ effect: { type: 'manuscript_pct', step: 2, value, cap } }));

patchTalent('T043', { type: 'weakness_reward', value: .04, reward: { type: 'inspiration', value: 1, perMatch: false } },
  '风尘满面，仍有人一眼认出你未说出口的招数。每场首次命中对手破绽时，作品得分 +4%，并恢复 1 灵感。');
sidequest.upgrades.T043.levels = [
  [.04, 1], [.06, 1], [.08, 1], [.10, 2], [.12, 2]
].map(([value, inspiration]) => ({ effect: { type: 'weakness_reward', value, reward: { type: 'inspiration', value: inspiration, perMatch: false } } }));

patchTalent('TA11', { type: 'dice_transform', mode: 'polarize', minDice: 2, value: .06 },
  '妄念不在幽暗处，恰藏在似是而非之间。将最低骰化为一、最高骰化为六，并令本场作品得分 +6%。');
sidequest.upgrades.TA11.levels = [.06, .08, .10, .12, .15].map((value, index) => ({
  cost: index === 4 ? 2 : 3,
  effect: { type: 'dice_transform', mode: 'polarize', minDice: 2, value }
}));

// 同步此前强化后的数值文案，避免效果摘要与典故正文互相矛盾。
const textFixes = {
  T001: '「李白斗酒诗百篇，长安市上酒家眠。」——杜甫《饮中八仙歌》。以诗出战获胜时，诗力额外 +2。',
  T002: '词本倚声而作，先有腔调后有文字。填词日久，声律入骨——以词出战获胜时，词力额外 +2。',
  T003: '属对之才，出口成双。相传解缙幼时应对如流，一座皆惊——以联出战获胜时，联力额外 +2。',
  T004: '「读书破万卷，下笔如有神。」——杜甫《奉赠韦左丞丈二十二韵》。腹笥既广，学力常驻 +3。',
  T007: '五代王仁裕《开元天宝遗事》载：李白少时梦所用之笔头上生花，此后天才赡逸，名闻天下。每枚最终为 6 点的灵感骰令作品得分 +8%。',
  T012: '「李杜文章在，光焰万丈长。」——韩愈《调张籍》。以诗出战获胜时，诗力额外 +3。需先有「浪漫主义」倾向。',
  T013: '南宋叶梦得《避暑录话》载：凡有井水饮处，即能歌柳词。以词出战获胜时，词力额外 +3。需先有「婉约派」倾向 ×2。',
  T014: '俞文豹《吹剑续录》载幕士评东坡词：须关西大汉，执铁板，唱「大江东去」。以联出战获胜时，联力额外 +3。需先有「豪放派」倾向。',
  T099: '解元、会元、状元连中三元，本朝数百年不过数人。图鉴「连中三元」解锁后可装配：殿试三场得分各 +15%，并于入场时恢复 4 灵感。',
  T017: '孟郊《登科后》：「春风得意马蹄疾，一日看尽长安花。」少年得志，意气风发——每场论战取胜，灵感 +2。',
  T019: '《晋书·左思传》：洛阳为之纸贵。一篇既出，士林争传，声名回响不断——灵感低于上限 50% 时，每回合恢复 1；每获得一枚新文心再恢复 2。',
  T020: '「为人性僻耽佳句，语不惊人死不休。」——杜甫《江上值水如海势聊短述》。诗乃风骨所寄，以诗出战，作品得分常驻 +10%。',
  T021: '「体物之工，穷情写貌。」咏物一题，体察入微，形神兼备——出战「咏物」题材时得分 +15%。',
  T023: '智永居永欣寺三十年，临书不退，笔头委积，埋之为冢——积学既深，虽江郎才尽亦有余勇。每场结算后灵感补足至 16，不致骤然封笔。',
  T027: '杜甫《戏为六绝句》：转益多师是汝师。败于名家而有所悟，平局亦能取法——「败中有得」「平分秋色」的补偿属性额外 +2，下一场得分 +4%。',
  T028: '殿试策问，临轩而试。金殿之上从容奏对——进入殿试先恢复 4 灵感，殿试每场开场再恢复 3。',
  T030: '朱熹《观书有感》：“问渠那得清如许？为有源头活水来。”每次答对考题或完成创作抉择，灵感额外 +2；每局最多触发 4 次。',
  T031: '枯木经霜，春来更发新枝。每场论战全部结算后，若灵感不高于 16，则恢复 3 点；每局最多触发 3 次。',
  T032: '涓流不拒，积而成渊。获得时，本局灵感上限永久 +8，并补充 4 灵感；与「海纳百川」互斥，且扩容只结算一次。',
  T033: '《文心雕龙》言“操千曲而后晓声，观千剑而后识器”。获得时，本局灵感上限永久 +14，并补充 7 灵感；与「蓄水成渊」互斥，且扩容只结算一次。',
  T035: '郑板桥题画有言：删繁就简三秋树，领异标新二月花。只以一枚灵感骰收笔时，作品得分 +12%，战后心得额外 +1。',
  T040: '陆游诗云：文章本天成，妙手偶得之。本场首次出现最终为 6 点的灵感骰时，作品得分 +8%，并额外沉淀 1 份残页（每场一次）。'
};
for (const [id, text] of Object.entries(textFixes)) talentById.get(id).text = text;

const score = (id, type, value, extra = {}) => ({
  effectId: `${id}-E1`, stackGroup: 'synergy-resonance-v2', stackMode: 'max', type, value, ...extra
});
const add = [
  { id:'S26', name:'守诺成势', members:['T041','T022','T039'], desc:'守诺与连捷彼此应和：同文风连捷达到 2 场后，作品得分 +10%。', effects:[score('S26','streak_pct',.10,{minStreak:2})] },
  { id:'S27', name:'江湖换境', members:['T042','T037','TA02'], desc:'转身换境，旧意新辞：换用不同文体时得分 +12%，心得 +2。', effects:[score('S27','style_switch_pct',.12,{insight:2})] },
  { id:'S28', name:'知己知彼', members:['T043','T011','T027'], desc:'识人亦能自省：上一场未胜时本场得分 +10%；败或平的研习额外 +1，下一场再 +6%。', effects:[score('S28','battle_history_pct',.10,{condition:'previous_nonwin'}),{effectId:'S28-E2',stackGroup:'synergy-growth',stackMode:'max',type:'study_bonus',value:1,nextBattlePct:.06}] },
  { id:'S29', name:'临渊止戈', members:['TA09','T015','T025'], desc:'绝境中解剑止戈：发动「杯酒解剑」且灵感不高于 16 时，本场得分 +14%。', effects:[score('S29','comeback',.14,{threshold:16,when:{usedTalents:['TA09']}})] },
  { id:'S30', name:'藏锋守简', members:['T044','T035','T023'], desc:'一骰收笔，守简蓄锋：仅用一枚骰时得分 +12%，并恢复 1 灵感。', effects:[score('S30','dice_pattern',.12,{pattern:'single',reward:{type:'inspiration',value:1,perMatch:false}})] },
  { id:'S31', name:'轻骑生变', members:['T045','T005','T010'], desc:'轻骑追笔，低开高走：首骰低、续骰高时得分 +14%。', effects:[score('S31','dice_pattern',.14,{pattern:'low_then_high',lowMax:2,nextHighMin:5})] },
  { id:'S32', name:'残烽回春', members:['T046','T018','T031'], desc:'失意之后仍有烽火：上一场未胜时本场得分 +8%；战后灵感不高于 18 时恢复 3（每局 3 次）。', effects:[score('S32','battle_history_pct',.08,{condition:'previous_nonwin'}),{effectId:'S32-E2',stackGroup:'synergy-recovery',stackMode:'max',type:'insp_battle_recover',threshold:18,value:3,maxTriggers:3}] },
  { id:'S33', name:'成竹列阵', members:['TA10','T032','T029'], desc:'胸有成竹，临阵不乱：发动「背水列阵」时本场得分 +10%。', effects:[score('S33','syn_pct',.10,{when:{usedTalents:['TA10']}})] },
  { id:'S34', name:'坐忘定局', members:['T047','T008','TA08'], desc:'谋篇而不妄动：本场不发动论战主动文心时，作品得分 +10%。', effects:[score('S34','restraint_pct',.10)] },
  { id:'S35', name:'梦蝶偶得', members:['T048','T007','T040'], desc:'梦中首尾相照：骰组首尾同点时得分 +12%，并得 1 份残页。', effects:[score('S35','dice_pattern',.12,{pattern:'first_last_equal',minDice:2,reward:{type:'fragment',value:1,perMatch:false}})] },
  { id:'S36', name:'黑白惊锋', members:['T049','TA03','TA07'], desc:'黑白两极相激：骰组同时有低点与高点时得分 +14%，并恢复 1 灵感。', effects:[score('S36','dice_pattern',.14,{pattern:'low_and_high',lowMax:2,highMin:5,reward:{type:'inspiration',value:1,perMatch:false}})] },
  { id:'S37', name:'斩妄惊雷', members:['TA11','TA04','T024'], desc:'斩妄见真后六曜惊雷：发动「斩妄见真」且骰组出现六点时，得分 +12%。', effects:[score('S37','dice_pattern',.12,{pattern:'six',when:{usedTalents:['TA11']}})] },
  { id:'S38', name:'酒酣文章', members:['T001','T012'], desc:'酒酣诗胆壮，李杜文章长：以诗出战得分 +8%。', effects:[score('S38','style_pct',.08,{style:'shi'})] },
  { id:'S39', name:'声传井巷', members:['T002','T013'], desc:'倚声入巷，清唱相传：以词获胜时词力额外 +2。', effects:[{effectId:'S39-E1',stackGroup:'synergy-growth',stackMode:'max',type:'on_win_bonus',style:'ci',value:2}] },
  { id:'S40', name:'联珠铿锵', members:['T003','T014'], desc:'出口成对，铁板铿锵：以联出战得分 +8%。', effects:[score('S40','style_pct',.08,{style:'lian'})] },
  { id:'S41', name:'腹笥五车', members:['T004','T026'], desc:'博览积为五车：每持有 3 枚文心，六维算分属性 +2%，最多 +6%。', effects:[score('S41','armory_pct',.02,{step:3,cap:.06})] },
  { id:'S42', name:'七步一气', members:['TA01','TA05'], desc:'七步之间一气成篇：发动「一气呵成」且总点为 7 的倍数时，得分 +10%。', effects:[score('S42','dice_pattern',.10,{pattern:'total_multiple',multiple:7,when:{usedTalents:['TA05']}})] },
  { id:'S43', name:'高吟珠落', members:['TA06','T036'], desc:'字字珠玑，倚马高吟：发动「倚马可待」时，总点 12 得分 +8%，总点 16 得分 +14%。', effects:[score('S43','dice_pattern',0,{pattern:'total_tiers',tiers:[{threshold:16,value:.14},{threshold:12,value:.08}],when:{usedTalents:['TA06']}})] },
  { id:'S44', name:'洛水活源', members:['T019','T030'], desc:'活水流入洛阳纸：有效答题额外恢复 1 灵感，每局最多 4 次。', effects:[{effectId:'S44-E1',stackGroup:'synergy-recovery',stackMode:'max',type:'insp_on_quiz',value:1,maxTriggers:4}] },
  { id:'S45', name:'诗骨成章', members:['T020','T038'], desc:'诗骨落为成章稿本：以诗出战时，每 2 页稿本得分 +2%，最多 +12%。', effects:[score('S45','manuscript_pct',.02,{step:2,cap:.12,when:{styles:['shi']}})] },
  { id:'S46', name:'咏物珠玑', members:['T021','T036'], desc:'体物入微，字字有光：出战咏物题材时得分 +12%。', effects:[score('S46','theme_pct',.12,{theme:'yongwu'})] },
  { id:'S47', name:'殿纳百川', members:['T028','T033'], desc:'百川入殿，策问从容：进入殿试先恢复 3 灵感，每场开场再恢复 2。', effects:[{effectId:'S47-E1',stackGroup:'synergy-palace',stackMode:'max',type:'palace_insp',value:2,startValue:3}] },
  { id:'S48', name:'传灯成卷', members:['T034','T033'], desc:'海纳旧学，传灯成卷：殿试每场得分 +12%。', effects:[score('S48','palace_pct',.12)] }
];

const newIds = new Set(add.map(s => s.id));
synergies = [...synergies.filter(s => !newIds.has(s.id)), ...add];

// 覆盖审计：伙伴按同一羁绊中的其他成员去重，所有文心必须至少有两名不同伙伴。
for (const [id, talent] of talentById) {
  const partners = new Set(synergies.filter(s => s.members.includes(id)).flatMap(s => s.members).filter(x => x !== id));
  if (partners.size < 2) throw new Error(`${id} ${talent.name} 仅有 ${partners.size} 名羁绊伙伴`);
}

writeJson(cfg('talents'), talents);
writeJson(cfg('talent-upgrade'), upgrades);
writeJson(cfg('sidequest-talents'), sidequest);
writeJson(cfg('synergies'), synergies);

function seedHeader(file, fallback) {
  const source = fs.readFileSync(file, 'utf8');
  const index = source.search(/^\s*window\.[A-Z_]+\s*=/m);
  return index > 0 ? source.slice(0, index) : fallback;
}
function writeSeed(fileName, entries) {
  const file = path.join(SEED, fileName);
  let output = seedHeader(file, '/* 由文心羁绊补全脚本同步生成。 */\n');
  for (const [name, value] of entries) output += `window.${name} = ${JSON.stringify(value, null, 2)};\n`;
  fs.writeFileSync(file, output, 'utf8');
}
writeSeed('seed-talents.js', [['GAME_TALENTS', talents]]);
writeSeed('seed-talent-upgrade.js', [['GAME_TALENT_UPGRADE', upgrades]]);
writeSeed('seed-synergies.js', [['GAME_SYNERGIES', synergies]]);
writeSeed('seed-sidequests.js', [
  ['GAME_SIDEQUEST_NPCS', read(cfg('sidequest-npcs'))],
  ['GAME_SIDEQUESTS', read(cfg('sidequests'))],
  ['GAME_SIDEQUEST_TALENTS', sidequest.talents],
  ['GAME_SIDEQUEST_TALENT_UPGRADE', sidequest.upgrades],
  ['GAME_SIDEQUEST_TALENT_OFFERS', sidequest.offers]
]);

const content = read(CONTENT);
content._version = (Number(content._version) || 1) + 1;
content.talents = talents;
content['talent-upgrade'] = upgrades;
content.synergies = synergies;
content['sidequest-talents'] = sidequest;
writeJson(CONTENT, content);

console.log(`文心 ${talentById.size} 枚、羁绊 ${synergies.length} 组；全量伙伴覆盖通过。`);
