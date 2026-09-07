import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(process.argv[2] || path.join(here, '../feihuaqi-playable'));
const read = n => JSON.parse(fs.readFileSync(path.join(source, 'config', n+'.json'), 'utf8'));
const main = read('talents'), side = read('sidequest-talents');
const mainUpgrades = read('talent-upgrade');
assert.equal(Object.keys(side.upgrades).filter(id=>id in mainUpgrades).length,0,'overlapping upgrade IDs');
const talents = [...main, ...side.talents], upgrades = {...mainUpgrades, ...side.upgrades};
const synergies = read('synergies');
const registry = {
  on_win_bonus: '战后获胜且文体匹配→心得；不再宣称直接属性',
  attr_flat: '获得/升级/卸下→常驻属性来源净差；attrs为权威，value不再叠加',
  dice_pattern: '定稿快照→作品修正；reward/fullReward/tiers.reward另在战后兑现',
  copy_affinity: '算分→复制亲和及各级特有转化；ratio不乘总作品，观察开关保持',
  comeback: '定稿、已付费未战后回复的灵感≤threshold→作品修正',
  palace_pct: '殿试定稿→作品修正；startInspiration另在殿试入场一次',
  borrow_signature: '合法主动付费→借取招牌；fraction仅作用于可借招牌',
  extra_dice_chain: '主动付费及续写条件→作品修正；命中后refund战后回灵一次',
  dice_transform: '合法主动付费→改最终骰；自然骰不变，value为附加作品比例',
  planned_dice: '地图发动→指定下一枚移动骰；baseCost+使用次数×costStep',
  insp_on_win: '战后获胜→灵感，受上限',
  draw_bonus: '战后平局→心得；不加直接属性',
  insp_turn_regen: '回合恢复时按thresholdRatio判资格→灵感；onTalent另为新得文心事件',
  style_pct: '文体匹配定稿→作品修正；嵌套reward应单独生成战后意图',
  theme_pct: '题材匹配定稿→作品修正；嵌套reward应单独生成战后意图',
  streak_mult: '只放大气势来源，非总作品倍率',
  insp_floor: '战后恢复完成→补足灵感底线；不叠成多次回复',
  lucky_six: '命中对应六点条件→终结倍率；多个终结倍率取高，不相乘',
  armory_pct: '按持有文心数计层；T026/S41仅六维算分属性，S22仅作品层',
  study_bonus: '战后非胜→心得；nextBattlePct另登记下一战修正，同类取高',
  palace_insp: '殿试入场startValue一次；value=0不恢复旧逐场奖励；scorePct独立算分',
  insp_on_quiz: '有效答题→灵感；maxTriggers为每局次数',
  insp_battle_recover: '战后低灵感统一快照→灵感；maxTriggers为每局次数',
  insp_max: '获得/升级→同组永久扩容账本；不随卸下回退，填充单独取整',
  style_switch_pct: '有上一场且换体→作品修正；insight为战后心得',
  manuscript_pct: '战前消费后的完整稿页快照计层→作品修正；不把进度当页',
  reincarnate: '跨局资格/继承属性/起始灵感分开；不重复继承装备来源',
  battle_history_pct: '上一场结果或文体满足条件→作品修正；首战不触发',
  weakness_reward: '本场首次命中破绽→作品修正及战后资源',
  seal_signature: '合法主动付费→封招牌及自身penalty；免疫检查在扣费前',
  dice_commitment: '购买追加骰的次数判断→作品修正；firstCostDiscount只首枚',
  restraint_pct: '本场未发动论战主动→作品修正；地图主动不计',
  extra_dice_pct: '按追加骰数→作品修正；firstCostDiscount另进费用入口',
  syn_pct: '条件满足→作品修正',
  streak_pct: '连捷数≥minStreak→作品修正'
};
const pctTypes = new Set(['dice_pattern','comeback','palace_pct','extra_dice_chain','dice_transform','style_pct','theme_pct','streak_mult','armory_pct','style_switch_pct','manuscript_pct','battle_history_pct','weakness_reward','dice_commitment','restraint_pct','extra_dice_pct','syn_pct','streak_pct']);
const spiritTypes = new Set(['inspiration','insp_on_win','insp_turn_regen','insp_floor','palace_insp','insp_on_quiz','insp_battle_recover','insp_max']);
const rateKeys = new Set(['ratio','fraction','thresholdRatio','singleDieBonus','perStepValue','fullValue','highValue','lowValue','nextBattlePct','scorePct','fillRatio','attrRatio','previousWinBonus','previousNonWinBonus','penalty','synergyPct','themeFlat','convertPct','inspirationRatioMin','cap']);
const pipKeys = new Set(['lowMax','nextHighMin','highMin','multiple','divisor','minPip','maxPip','target','floor','maxValue','min']);
const costKeys = new Set(['cost','baseCost','costStep','refund','firstCostDiscount','conditionalFirstCostDiscount','onTalent','startInspiration','startValue','inspThreshold']);
const countKeys = new Set(['minDice','fullDice','maxTriggers','step','minStreak']);
function unit(type, key, trail) {
  if (trail.includes('attrs.')) return 'attribute';
  if (key === 'value') {
    if (type === 'fragment') return 'manuscript_progress';
    if (type === 'insight' || ['on_win_bonus','draw_bonus','study_bonus'].includes(type)) return 'insight';
    if (spiritTypes.has(type)) return type === 'insp_max' ? 'inspiration_capacity' : 'inspiration';
    if (type === 'attr_flat') return 'attribute_alias';
    if (pctTypes.has(type)) return 'ratio';
  }
  if (key === 'insight') return 'insight';
  if (key === 'mult') return 'multiplier';
  if (rateKeys.has(key)) return 'ratio';
  if (pipKeys.has(key)) return 'pip';
  if (costKeys.has(key)) return 'inspiration';
  if (countKeys.has(key)) return 'count';
  if (key === 'threshold') return type === 'dice_pattern' ? 'pip' : 'inspiration';
  throw new Error(`Unknown numeric field ${type}:${trail}`);
}
let fields = 0, changed = 0;
function convert(effect) {
  assert.ok(registry[effect.type], `Unknown effect ${effect.type}`);
  const annotations = [];
  function walk(obj, trail = '', inherited = effect.type) {
    if (Array.isArray(obj)) return obj.map((x,i) => walk(x, `${trail}${i}.`, inherited));
    if (!obj || typeof obj !== 'object') return obj;
    const type = obj.type || inherited;
    const out = {};
    for (const [key,v] of Object.entries(obj)) {
      if (typeof v === 'number') {
        const u = unit(type,key,trail+key), value = u === 'manuscript_progress' ? v*20 : v;
        assert.ok(Number.isFinite(value));
        if (!['ratio','multiplier'].includes(u)) assert.ok(Number.isSafeInteger(value), trail+key);
        annotations.push({path:trail+key,unit:u,old:v,target:value});
        out[key] = value; fields++; if (v !== value) changed++;
      } else out[key] = walk(v, trail+key+'.', type);
    }
    if (type === 'fragment') out.type = 'manuscript_progress';
    return out;
  }
  return { legacyEffect:effect, targetParameters:walk(effect), numericFields:annotations };
}
function stacking(id) {
  const group = [['S13','S25','S27'],['S15','S26'],['S06','S21','S28','S32'],['S12','S32']];
  const names = ['换体作品取高、心得另组取高','连捷作品取高','上一场非胜的作品取高','低灵感恢复取高'];
  const special = group.flatMap((ids,i)=>ids.includes(id)?[names[i]]:[]);
  return (special.length ? special.join('；')+'；' : '')+'其余独立效果按目标层加算；同effectId去重；nextBattlePct同类取高';
}
const ids = new Set(talents.map(t=>t.id));
assert.equal(ids.size,talents.length);
assert.equal(Object.keys(upgrades).length, talents.length);
const records = talents.map(t => {
  const u = upgrades[t.id]; assert.ok(u,t.id);
  assert.equal(u.levels.length,u.maxLevel); assert.equal(u.upCost.length,u.maxLevel-1);
  const levels = u.levels.map((lv,i)=>{
    const effect = lv.effect || t.effect;
    const cost = lv.cost ?? t.cost ?? null;
    assert.ok(cost === null || Number.isSafeInteger(cost));
    return {level:i+1, upgradeCostToNext:u.upCost[i] ?? null, activeCost:cost,
      legacyLevel:lv, ...convert(effect)};
  });
  return {id:t.id,name:t.name,kind:t.kind,source:side.talents.some(x=>x.id===t.id)?'支线':'主配置',
    legacyTalent:t,contract:registry[t.effect.type],base:convert(t.effect),levels};
});
const synergyRecords = synergies.map(s=>{
  s.members.forEach(id=>assert.ok(ids.has(id),`${s.id}/${id}`));
  return {...s,targetStacking:stacking(s.id),mappedEffects:s.effects.map(e=>({
    contract:registry[e.type],...convert(e)
  }))};
});
const effectIds = synergies.flatMap(s=>s.effects.map(e=>e.effectId));
assert.equal(new Set(effectIds).size,effectIds.length);
const configNames = ['attrs','inspiration','schools','sky','events','questions','board','album','affinity','npcs','npc-mechanics','sidequest-npcs','sidequests','narrative','grades','talents','sidequest-talents','talent-upgrade','synergies'];
const fingerprints = Object.fromEntries(configNames.map(n=>[n+'.json',createHash('sha256').update(fs.readFileSync(path.join(source,'config',n+'.json'))).digest('hex')]));
const peripheral = Object.fromEntries(configNames.filter(n=>!['talents','sidequest-talents','talent-upgrade','synergies'].includes(n)).map(n=>[n,read(n)]));
const counts = {talents:records.length,main:main.length,side:side.talents.length,levels:records.reduce((n,t)=>n+t.levels.length,0),synergies:synergies.length,synergyEffects:effectIds.length,numericEffectFields:fields,changedFragmentFields:changed};
const data = {status:'design-review-only-not-loadable-game-config',counts,fingerprints,
  precision:'Ratio values retained as legacy decimals in review data; display ×100 percent. Only fragment values change to ×20.',
  coverage:'All base and level effects plus synergy effects numerically typed. Acquisition conditions and peripheral configurations preserved as raw snapshots, not claimed as a full numeric migration.',
  talents:records,synergies:synergyRecords,peripheralSourceSnapshots:peripheral};
const jsonName = '文心棋-数值系统对接数据-v2.1.json';
const mdName = '文心棋-文心升级羁绊全量对接表-v2.1.md';
const fmt = o => '`'+JSON.stringify(o).replaceAll('|','\\|')+'`';
const lines = ['# 文心棋文心、升级与羁绊全量对接表 v2.1','',
  '状态：设计对照，未写入游戏。由 build-numeric-v2-integration.mjs 从当前配置生成；完整原始字段、每个数值的单位与换算见[结构化对接数据]('+jsonName+')。执行顺序及例子见[实施规格](文心棋-数值系统对接实施规格-v2.1.md)。','',
  '参数中 ratio 保留小数语义，例如 0.08 是 8%；成稿进度以新格数书写。perMatch=false 保留原始标记，目标频率是每战一次。其余未显式改写的条件和层级不能删掉。此表 targetParameters 是审查载荷，旧引擎不能直接加载新类型。','',
  '## 1. 覆盖','',JSON.stringify(counts),'',
  '## 2. 文心与逐级效果',''];
for (const t of records) {
  lines.push(`### ${t.id} ${t.name}`, '', `${t.source}／${t.kind}。目标：${t.contract}。`, '',
    `基础配置：${fmt(t.base.targetParameters)}。升级表各级 effect 为生效权威。`, '',
    '| 等级 | 升下级灵感原价 | 发动灵感基础价 | 完整目标参数 |','|---|---:|---:|---|');
  for (const lv of t.levels) lines.push(`| ${lv.level} | ${lv.upgradeCostToNext??'满级'} | ${lv.activeCost??'不适用'} | ${fmt(lv.targetParameters)} |`);
  lines.push('');
}
lines.push('## 3. 羁绊逐效果对接','','全成员持有才激活；不因升级改变ID。以下叠加规则是语义修复层目标，会改变部分现有组合强度。','');
for (const s of synergyRecords) {
  lines.push(`### ${s.id} ${s.name}`,'',`成员：${s.members.join('＋')}。`, '',`目标叠加：${s.targetStacking}。`,'',
    '| 效果 ID | 目标入口 | 完整参数（原stack字段仅供对照） |','|---|---|---|');
  s.mappedEffects.forEach(e=>lines.push(`| ${e.legacyEffect.effectId} | ${e.contract} | ${fmt(e.targetParameters)} |`));
  lines.push('');
}
lines.push('## 4. 验收边界','','已校验 ID 唯一、升级覆盖与费用长度、羁绊成员、效果数值字段单位与新成稿整数。未验证全部触发消费路径、当前游戏运行、旧档迁移、配对模拟或平衡。外围配置快照只为追溯，不能当作目标配置导入。','');
fs.writeFileSync(path.join(here,jsonName),JSON.stringify(data,null,2)+'\n');
fs.writeFileSync(path.join(here,mdName),lines.join('\n'));
console.log(JSON.stringify(counts,null,2));
