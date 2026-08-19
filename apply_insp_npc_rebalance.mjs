import { readFileSync, writeFileSync } from 'fs';
const root = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25';
const playable = root + '/feihuaqi-playable';
const editor = root + '/feihua-editors';
const readJson = p => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, x) => writeFileSync(p, JSON.stringify(x, null, 2) + '\n', 'utf8');

// 1) 灵感基线：保留原有键与消费结构，只提高开局与基础上限。
const inspirationPath = playable + '/config/inspiration.json';
const inspiration = readJson(inspirationPath);
inspiration.initial = 32;
inspiration.max = 54;
writeJson(inspirationPath, inspiration);

// 2) 新增4枚受限资源文心；optional acquire/effect 字段向后兼容，旧引擎忽略未知字段。
const talentsPath = playable + '/config/talents.json';
const talents = readJson(talentsPath);
const additions = [
  {
    id: 'T030', name: '活水源头', kind: 'passive',
    text: '朱熹《观书有感》：“问渠那得清如许？为有源头活水来。”每次答对考题或完成创作抉择，灵感额外 +1；每局最多触发 4 次。',
    effect: { type: 'insp_on_quiz', value: 1, maxTriggers: 4 },
    acquire: { minTurn: 6 },
    acquireText: '第 6 回合后进入随机文心池。'
  },
  {
    id: 'T031', name: '枯木逢春', kind: 'passive',
    text: '枯木经霜，春来更发新枝。每场论战全部结算后，若灵感不高于 14，则恢复 2 点；每局最多触发 3 次。',
    effect: { type: 'insp_battle_recover', value: 2, threshold: 14, maxTriggers: 3 },
    acquire: { minTurn: 10, maxInspiration: 18 },
    acquireText: '第 10 回合后，且当前灵感不高于 18 时进入随机文心池。'
  },
  {
    id: 'T032', name: '蓄水成渊', kind: 'passive',
    text: '涓流不拒，积而成渊。获得时，本局灵感上限永久 +6；与「海纳百川」互斥，且扩容只结算一次。',
    effect: { type: 'insp_max', value: 6, group: 'inspiration_capacity' },
    acquire: { minTurn: 12, minTalents: 3, excludeFlag: 'inspiration_capacity' },
    acquireText: '第 12 回合后、已持有至少 3 枚文心且本局尚未获得扩容文心时进入随机池。'
  },
  {
    id: 'T033', name: '海纳百川', kind: 'passive',
    text: '《文心雕龙》言“操千曲而后晓声，观千剑而后识器”。获得时，本局灵感上限永久 +10；与「蓄水成渊」互斥，且扩容只结算一次。',
    effect: { type: 'insp_max', value: 10, group: 'inspiration_capacity' },
    acquire: { phase: 'lap2', minWins: 5, excludeFlag: 'inspiration_capacity' },
    acquireText: '进入第二圈且累计至少 5 胜，本局尚未获得扩容文心时进入随机池。'
  }
];
for (const t of additions) {
  const i = talents.findIndex(x => x.id === t.id);
  if (i >= 0) talents[i] = t; else talents.push(t);
}
writeJson(talentsPath, talents);

// 3) NPC梯度：低档不动；举人/进士/主考官按总预算精确重算，保持各自偏科结构。
const npcsPath = playable + '/config/npcs.json';
const tiers = readJson(npcsPath);
const targets = { juren: 90, jinshi: 117, zhukaoguan: 148 };
function scaleToTotal(attrs, target) {
  const keys = ['shi','ci','lian','bi','xue','si'];
  const sum = keys.reduce((s,k)=>s+(Number(attrs[k])||0),0);
  const raw = keys.map(k => ({ k, raw: (Number(attrs[k])||0) * target / sum }));
  const out = {}; let used = 0;
  raw.forEach(x => { out[x.k] = Math.floor(x.raw); used += out[x.k]; });
  raw.sort((a,b)=>(b.raw-Math.floor(b.raw))-(a.raw-Math.floor(a.raw)) || keys.indexOf(a.k)-keys.indexOf(b.k));
  for (let i=0;i<target-used;i++) out[raw[i % raw.length].k]++;
  return out;
}
const tierDesc = {
  juren: '会试中坚。六维总预算提升至 90，偏科优势更明确；开始要求玩家利用相性与破绽，而非只靠属性碾压。',
  jinshi: '高阶名家。六维总预算提升至 117，并强化招牌能力；需要稳定构筑与资源规划，低级档不随之上涨。',
  zhukaoguan: '殿试三场终极大考。六维总预算 148，关键能力进一步强化；三位考官各偏诗、词、笔，仍保留可读破绽与换策空间。'
};
for (const tier of tiers) {
  const target = targets[tier.id];
  if (!target) continue;
  tier.desc = tierDesc[tier.id] || tier.desc;
  for (const npc of (tier.npcs || [])) npc.attrs = scaleToTotal(npc.attrs, target);
}
function npcById(id) {
  for (const tier of tiers) for (const npc of (tier.npcs || [])) if (npc.id === id) return npc;
  throw new Error('NPC not found: ' + id);
}
function mainSig(npc) { return npc.mech.signature.main || npc.mech.signature; }
// 进士：关键能力只增1~2个百分点/1点成本，避免和属性提升叠出断层。
mainSig(npcById('ouyang_han')).cost = 3;
mainSig(npcById('si_ma_wen')).pct = 0.11;
mainSig(npcById('shang_guan_ming')).pct = 0.11;
mainSig(npcById('xia_hou_jin')).floorPct = 0.06;
mainSig(npcById('mu_rong_yu')).pct = 0.11;
mainSig(npcById('yuwen_yuan')).pct = 0.12;
// 主考官：突出殿试终局，但保留玩家可读破绽与换策收益。
const wang = mainSig(npcById('wang_shilang'));
wang.weaknessDampen = 0.28; wang.minWeaknessRetention = 0.45;
mainSig(npcById('li_xue_shi')).pct = 0.12;
mainSig(npcById('zhao_da_ru')).floorPct = 0.07;
writeJson(npcsPath, tiers);

// 4) 编辑器种子与游戏配置强制同源，杜绝导出覆盖回旧值。
const seedTalents = '/* 飞花棋游戏原始文心（config/talents.json）。作为编辑器默认种子数据。由游戏配置同步生成，请勿手工改动 —— 在编辑器内管理后导出即可覆盖。 */\nwindow.GAME_TALENTS = ' + JSON.stringify(talents, null, 2) + ';\n';
writeFileSync(editor + '/assets/js/seed-talents.js', seedTalents, 'utf8');
const seedNpcs = '/* 飞花棋游戏原始 NPC（config/npcs.json）。作为编辑器默认种子数据。由游戏配置同步生成，请勿手工改动 —— 在编辑器内管理后导出即可覆盖。 */\nwindow.GAME_NPCS = ' + JSON.stringify(tiers, null, 2) + ';\n';
writeFileSync(editor + '/assets/js/seed-npcs.js', seedNpcs, 'utf8');

const sums = tiers.map(t => ({ id:t.id, count:(t.npcs||[]).length, totals:(t.npcs||[]).map(n=>Object.values(n.attrs).reduce((a,b)=>a+Number(b||0),0)) }));
console.log(JSON.stringify({ inspiration:{initial:inspiration.initial,max:inspiration.max}, talents:talents.length, added:additions.map(x=>x.id), npcTotals:sums }, null, 2));
