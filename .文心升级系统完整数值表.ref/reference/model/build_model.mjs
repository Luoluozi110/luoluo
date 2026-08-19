import { readFileSync, writeFileSync } from 'fs';

const talentsPath = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/feihuaqi-playable/config/talents.json';
const outPath = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/.文心升级系统完整数值表.ref/reference/model/data.json';
const talents = JSON.parse(readFileSync(talentsPath, 'utf8'));

const Q = {
  '普通': { maxLevel: 3, costs: [6,10], fullCost: 16, targetOdds: 0.45, color: '#A7A7A7', rationale: '低门槛形成升级教学；满级投入约等于2次访胜抽签。' },
  '稀有': { maxLevel: 4, costs: [7,11,16], fullCost: 34, targetOdds: 0.32, color: '#4F81BD', rationale: '中局主力；后两级开始与追加骰/访胜形成明显机会成本。' },
  '史诗': { maxLevel: 5, costs: [8,12,17,23], fullCost: 60, targetOdds: 0.18, color: '#8064A2', rationale: '构筑核心；满级应要求玩家主动围绕它节省灵感。' },
  '传说': { maxLevel: 6, costs: [9,13,18,24,31], fullCost: 95, targetOdds: 0.05, color: '#C55A11', rationale: '局内长期目标；单次最高31仍低于灵感上限48，但不能随手点满。' }
};

const L = (primary, secondary=null, useCost=null) => ({ primary, secondary, useCost });
const defs = {
  T001:{q:'普通',legacy:1,pn:'胜后诗力',pu:'点',levels:[L(1),L(1),L(2)]},
  T002:{q:'普通',legacy:1,pn:'胜后词力',pu:'点',levels:[L(1),L(1),L(2)]},
  T003:{q:'普通',legacy:1,pn:'胜后联力',pu:'点',levels:[L(1),L(1),L(2)]},
  T004:{q:'普通',legacy:1,pn:'学力常驻',pu:'点',levels:[L(2),L(3),L(4)]},
  T005:{q:'普通',legacy:1,pn:'灵感骰点数',pu:'点',levels:[L(1),L(1),L(2)]},
  T006:{q:'稀有',legacy:1,pn:'笔力常驻',pu:'点',levels:[L(3),L(4),L(5),L(6)]},
  T007:{q:'史诗',legacy:3,pn:'触发概率',pu:'%',sn:'得分倍率',su:'倍',levels:[L(.16,1.45),L(.19,1.48),L(.22,1.50),L(.25,1.53),L(.28,1.55)]},
  T008:{q:'稀有',legacy:1,pn:'思力常驻',pu:'点',levels:[L(3),L(4),L(5),L(6)]},
  T009:{q:'普通',legacy:1,pn:'学力常驻',pu:'点',levels:[L(2),L(3),L(4)]},
  T010:{q:'普通',legacy:1,pn:'灵感骰点数',pu:'点',levels:[L(1),L(1),L(2)]},
  T011:{q:'传说',legacy:4,pn:'复制相性比例',pu:'%',levels:[L(.55),L(.70),L(.85),L(1.00),L(1.15),L(1.30)],note:'新增 effect.ratio；当前被动 copy_affinity 未接线，P0 修复后才生效。'},
  T012:{q:'稀有',legacy:1,pn:'胜后诗力',pu:'点',levels:[L(2),L(2),L(3),L(4)]},
  T013:{q:'稀有',legacy:1,pn:'胜后词力',pu:'点',levels:[L(2),L(2),L(3),L(4)]},
  T014:{q:'稀有',legacy:1,pn:'胜后联力',pu:'点',levels:[L(2),L(2),L(3),L(4)]},
  T015:{q:'史诗',legacy:2,pn:'触发概率',pu:'%',sn:'得分倍率',su:'倍',levels:[L(.12,1.55),L(.15,1.60),L(.18,1.63),L(.21,1.66),L(.24,1.70)]},
  T016:{q:'史诗',legacy:4,pn:'灵感骰倍率',pu:'倍',levels:[L(5.4),L(5.6),L(5.8),L(6.0),L(6.2)],note:'当前被动 dice_mult 未接线；被动提供基础倍率，主动倍率使用时覆盖被动。'},
  T099:{q:'传说',legacy:3,pn:'殿试得分加成',pu:'%',levels:[L(.03),L(.04),L(.05),L(.06),L(.07),L(.08)]},
  TA01:{q:'稀有',legacy:3,pn:'固定灵感骰得分',pu:'分',levels:[L(13,null,1),L(14,null,1),L(15,null,1),L(17,null,1)]},
  TA02:{q:'稀有',legacy:3,pn:'复制相性比例',pu:'%',levels:[L(.70,null,1),L(.85,null,1),L(1.00,null,1),L(1.15,null,1)],note:'新增 effect.ratio；主动文心每场限用1次。'},
  TA03:{q:'史诗',legacy:4,pn:'灵感骰倍率',pu:'倍',levels:[L(6.5,null,2),L(6.9,null,2),L(7.3,null,2),L(7.7,null,2),L(8.2,null,2)]},
  TA04:{q:'史诗',legacy:3,pn:'触发概率',pu:'%',sn:'得分倍率',su:'倍',levels:[L(.30,1.45,2),L(.34,1.48,2),L(.38,1.50,2),L(.42,1.53,1),L(.47,1.55,1)]},
  TA05:{q:'稀有',legacy:1,pn:'灵感骰点数',pu:'点',levels:[L(3,null,1),L(4,null,1),L(5,null,1),L(6,null,1)]},
  TA06:{q:'传说',legacy:3,pn:'固定灵感骰得分',pu:'分',levels:[L(16,null,2),L(17,null,2),L(18,null,2),L(20,null,2),L(22,null,1),L(24,null,1)]},
  TA07:{q:'稀有',legacy:4,pn:'灵感骰倍率',pu:'倍',levels:[L(6.0,null,2),L(6.3,null,2),L(6.6,null,2),L(7.0,null,1)]},
  T017:{q:'普通',legacy:1,pn:'胜利灵感回复',pu:'点',levels:[L(1),L(1),L(2)]},
  T018:{q:'普通',legacy:1,pn:'平局属性补偿',pu:'点',levels:[L(1),L(1),L(2)]},
  T019:{q:'稀有',legacy:2,pn:'获新文心灵感',pu:'点',levels:[L(1),L(2),L(2),L(3)]},
  T020:{q:'稀有',legacy:3,pn:'诗战得分加成',pu:'%',levels:[L(.04),L(.05),L(.06),L(.08)]},
  T021:{q:'稀有',legacy:3,pn:'咏物题得分加成',pu:'%',levels:[L(.05),L(.06),L(.08),L(.10)]},
  T022:{q:'稀有',legacy:3,pn:'连捷收益额外倍率',pu:'%',levels:[L(.20),L(.30),L(.40),L(.50)]},
  T023:{q:'史诗',legacy:5,pn:'战后灵感托底',pu:'点',levels:[L(6),L(7),L(8),L(9),L(10)]},
  T024:{q:'史诗',legacy:4,pn:'六点骰得分倍率',pu:'倍',levels:[L(1.18),L(1.22),L(1.26),L(1.30),L(1.35)]},
  T025:{q:'史诗',legacy:3,pn:'绝境得分加成',pu:'%',sn:'触发灵感阈值',su:'点及以下',levels:[L(.08,10),L(.10,10),L(.12,11),L(.14,11),L(.16,12)]},
  T026:{q:'史诗',legacy:5,pn:'每档六维加成',pu:'%',sn:'每档所需文心',su:'枚',levels:[L(.02,4),L(.025,4),L(.03,3),L(.035,3),L(.04,3)]},
  T027:{q:'稀有',legacy:1,pn:'研习补偿额外属性',pu:'点',levels:[L(1),L(1),L(2),L(2)]},
  T028:{q:'史诗',legacy:4,pn:'殿试开场灵感',pu:'点',levels:[L(1),L(2),L(2),L(3),L(4)]},
  T029:{q:'稀有',legacy:4,pn:'获得时灵感',pu:'点',levels:[L(3),L(4),L(5),L(6)],note:'升级时只发放新旧等级差值，不能重复结算完整数值。'},
  T030:{q:'稀有',legacy:3,pn:'每次答题恢复',pu:'点',sn:'每局触发上限',su:'次',levels:[L(1,2),L(1,3),L(1,4),L(2,4)],note:'仅答对知识题/完成抉择触发；第6回合后入池；触发次数随存档持久化。'},
  T031:{q:'史诗',legacy:3,pn:'低灵感战后恢复',pu:'点',sn:'阈值/次数',su:'',levels:[L(1,'≤12·2次'),L(1,'≤13·3次'),L(2,'≤14·3次'),L(2,'≤15·3次'),L(2,'≤16·4次')],note:'第10回合后且灵感≤18入池；全部战斗/NPC资源结算后触发。'},
  T032:{q:'史诗',legacy:3,pn:'本局灵感上限',pu:'点',levels:[L(4),L(5),L(6),L(7),L(8)],note:'获得时只结算一次；与T033互斥；第12回合后且持有≥3枚文心入池。'},
  T033:{q:'传说',legacy:4,pn:'本局灵感上限',pu:'点',levels:[L(5),L(6),L(8),L(10),L(12),L(14)],note:'获得时只结算一次；与T032互斥；第二圈且累计≥5胜入池。'}
};

const costsByLevel = (q) => {
  const costs = Q[q].costs; let cum=0;
  return Array.from({length:Q[q].maxLevel},(_,i)=>{
    const level=i+1; const toThis=level===1?0:costs[level-2];
    cum += toThis;
    return {level,costToThis:toThis,costToNext:level<Q[q].maxLevel?costs[level-1]:null,cumulativeCost:cum};
  });
};

function fmt(v, unit) {
  if (v === null || v === undefined) return '';
  if (unit === '%') return Math.round(v*1000)/10 + '%';
  if (unit === '倍') return '×' + Number(v).toFixed(v % 1 ? 2 : 0).replace(/0+$/,'').replace(/\.$/,'');
  return String(v) + (unit ? ' ' + unit : '');
}

const talentSummary=[]; const levelDetails=[];
for (const t of talents) {
  const d=defs[t.id];
  if (!d) throw new Error('Missing definition: '+t.id);
  if (d.levels.length!==Q[d.q].maxLevel) throw new Error('Bad max level: '+t.id);
  const cl=costsByLevel(d.q);
  const max=d.levels[d.levels.length-1];
  const legacy=d.levels[d.legacy-1];
  const base=d.levels[0];
  talentSummary.push({
    id:t.id,name:t.name,kind:t.kind==='active'?'主动':'被动',school:t.school||'',quality:d.q,maxLevel:d.levels.length,
    currentEffectType:t.effect?.type||'',legacyConfig:JSON.stringify(t.effect||{}),legacyEquivalentLevel:d.legacy,
    level1Effect:[fmt(base.primary,d.pu),d.sn?d.sn+' '+fmt(base.secondary,d.su):'',base.useCost!==null?'使用消耗 '+base.useCost:''].filter(Boolean).join('；'),
    maxEffect:[fmt(max.primary,d.pu),d.sn?d.sn+' '+fmt(max.secondary,d.su):'',max.useCost!==null?'使用消耗 '+max.useCost:''].filter(Boolean).join('；'),
    fullUpgradeCost:Q[d.q].fullCost,primaryParam:d.pn,secondaryParam:d.sn||'',implementationNote:d.note||''
  });
  d.levels.forEach((lv,i)=>{
    const c=cl[i];
    const effectText=[d.pn+' '+fmt(lv.primary,d.pu),d.sn?d.sn+' '+fmt(lv.secondary,d.su):'',lv.useCost!==null?'本场使用消耗 '+lv.useCost+' 灵感':''].filter(Boolean).join('；');
    levelDetails.push({
      id:t.id,name:t.name,kind:t.kind==='active'?'主动':'被动',quality:d.q,level:i+1,maxLevel:d.levels.length,
      costToThis:c.costToThis,costToNext:c.costToNext,cumulativeCost:c.cumulativeCost,
      primaryParam:d.pn,primaryRaw:lv.primary,primaryDisplay:fmt(lv.primary,d.pu),
      secondaryParam:d.sn||'',secondaryRaw:lv.secondary,secondaryDisplay:d.sn?fmt(lv.secondary,d.su):'',
      useCost:lv.useCost,effectText,legacyLevel:(i+1===d.legacy?'是':''),note:d.note||''
    });
  });
}
if (talentSummary.length!==41) throw new Error('Expected 41 talents');

const qualityCosts=[];
for (const [quality,q] of Object.entries(Q)) {
  costsByLevel(quality).forEach(x=>qualityCosts.push({quality,maxLevel:q.maxLevel,targetDrawOdds:q.targetOdds,level:x.level,costToThis:x.costToThis,costToNext:x.costToNext,cumulativeCost:x.cumulativeCost,fullUpgradeCost:q.fullCost,rationale:q.rationale}));
}

const effectMapping = [
  ['on_win_bonus','胜利后对应文体属性成长','value','整数点','1~4','受 winRewardScale 再缩放；高等级仍可能因四舍五入只多1点。'],
  ['attr_flat','常驻六维属性','attrs.*','整数点','2~6','获得/升级按差值加；替换按当前等级完整扣回。'],
  ['dice_plus','灵感骰点数加成','value','整数点','1~6','影响每场骰分；多个来源相加。'],
  ['crit','概率暴击','chance + mult','概率+倍率','12%~47%；×1.45~×1.70','多暴击来源取最高倍率，不相乘。'],
  ['dice_mult','灵感骰倍率','value','倍率','×5.4~×8.2','P0：补被动接线；主动使用时覆盖被动倍率。'],
  ['copy_affinity','复制对手相性','ratio','百分比','55%~130%','P0：新增 ratio；被动接线缺失。只复制正相性，负相性不反向利用。'],
  ['palace_pct','殿试得分','value','百分比','3%~8%','仅殿试三场。'],
  ['fixed_dice','固定灵感骰得分','value','分','13~24','使用后禁止追加骰，保持现规则。'],
  ['insp_on_win','胜利回复灵感','value','整数点','1~2','受灵感上限48钳制。'],
  ['draw_bonus','平局属性补偿','value','整数点','1~2','走属性递减曲线。'],
  ['insp_on_talent','获得新文心回复','value','整数点','1~3','只在新获得/替换成功时触发，升级本身不触发。'],
  ['style_pct','指定文体得分','value','百分比','4%~8%','加入 pct 修正，与其他加成相加。'],
  ['theme_pct','指定题材得分','value','百分比','5%~10%','只在指定题材。'],
  ['streak_mult','气势连捷收益','value','百分比','20%~50%','乘在 momentumPct 上，不直接乘总分。'],
  ['insp_floor','战后灵感托底','value','整数点','6~10','结算后补足，不在战斗前免死。'],
  ['lucky_six','掷出6点时倍率','mult','倍率','×1.18~×1.35','多枚骰任一为6即触发；与crit仍取最高倍率。'],
  ['comeback','低灵感绝境加成','value + threshold','百分比+阈值','8%~16%；≤10~12','提高等级同时提高收益和触发覆盖。'],
  ['armory_pct','按持有文心数提升六维','value + step','百分比+枚数','2%~4%；每3~4枚','每档取floor(持有数/step)，最终属性取整且受递减后的基值。'],
  ['study_bonus','败/平研习补偿','value','整数点','1~2','走属性递减曲线。'],
  ['palace_insp','殿试开场灵感','value','整数点','1~4','每场开场一次，共最多三次。'],
  ['start_insp','获得时即时灵感','value','整数点','3~6','升级只结算差值，防重复套取。'],
  ['insp_on_quiz','答对/完成抉择恢复','value + maxTriggers','整数点+次数','1~2；2~4次','触发次数写入talentState，替换/再获得不刷新。'],
  ['insp_battle_recover','低灵感战后恢复','value + threshold + maxTriggers','整数点+阈值+次数','1~2；≤12~16；2~4次','放在全部战后资源结算之后；满灵感不消耗次数。'],
  ['insp_max','本局永久提高上限','value + group','整数点+互斥组','4~14','获得时只结算一次；同group扩容互斥，替换后不回退。']
].map(([type,purpose,fields,unit,range,boundary])=>({type,purpose,fields,unit,range,boundary}));

const implementationChecklist = [
  {priority:'P0',module:'状态/存档',item:'新增 s.talentLevels: { [talentId]: level }；获得文心默认Lv1；RUN_SAVE_VERSION升v3并迁移旧档到Lv1。',acceptance:'旧档可读；未知ID过滤；等级钳制1~maxLevel。'},
  {priority:'P0',module:'配置',item:'talents.json为每枚文心新增 quality/maxLevel/levels[]；品质成本放 talent-upgrade.json 统一管理。',acceptance:'41枚均有完整等级数组；等级长度=品质上限。'},
  {priority:'P0',module:'引擎',item:'新增 effectiveTalent(t,idLevel) 只返回当前等级参数；所有24类effect读取生效值，不再直接读旧effect。',acceptance:'逐类单测命中；Lv1~满级与表一致。'},
  {priority:'P0',module:'引擎缺口',item:'被动 dice_mult 与被动 copy_affinity 当前未接线；补入被动循环，copy_affinity按ratio复制正相性。',acceptance:'T016/T011在无主动文心时真实改变得分。'},
  {priority:'P0',module:'升级交易',item:'仅非战斗流程可升级；检查持有、未满级、灵感足够；先扣费再升1级，失败原子回滚。',acceptance:'灵感不足/满级/未持有均不扣费；单次只升1级。'},
  {priority:'P0',module:'一次性效果',item:'attr_flat与start_insp升级按新旧等级差值结算；attr_flat替换时按当前等级完整撤销。',acceptance:'反复升级/替换不复制属性或灵感。'},
  {priority:'P0',module:'主动文心',item:'useActive读取当前等级useCost；每场仍限每枚主动文心使用一次；最低消耗1。',acceptance:'按钮、扣费、战斗快照三处一致。'},
  {priority:'P1',module:'UI',item:'HUD/获得卡/替换卡/图鉴显示品质、Lv、当前/下级效果、升级费用；升级前后差值高亮。',acceptance:'所有24类效果都有可读文案，不再出现“效果由配置定义”。'},
  {priority:'P1',module:'抽取',item:'randomTalent按品质目标概率45%/32%/18%/5%先抽品质再抽未拥有文心；流派初始文心不受影响。',acceptance:'100k抽样误差每档≤0.5pp；空品质池向低一档/高一档可控回退。'},
  {priority:'P1',module:'行为限制',item:'战斗开始后锁定文心等级快照，战斗中禁止升级；结算后才允许操作。',acceptance:'UI计时/自动代掷期间参数不漂移。'},
  {priority:'P2',module:'埋点仿真',item:'记录升级率、平均等级、各品质灵感投入、升级后胜率变化、被替换损失。',acceptance:'可按文心/品质/玩家档位导出。'}
];

const meta={
  title:'飞花棋·文心升级系统完整数值表 v2',generatedAt:'2026-08-15 16:18 GMT+8',
  funHypothesis:'文心升级好玩的核心，是玩家把同一份灵感在“当场追加骰、抽取新文心、强化已有构筑”三条路径之间做真实取舍。',
  assumptions:[
    '升级发生在单局内，等级随本局存档，不跨局永久继承；图鉴可记录历史最高等级但不提供数值。',
    '玩家只能升级本局已持有文心；获得时默认Lv1；战斗过程中不可升级。',
    '升级资源为现有灵感，基础上限54；扩容文心互斥后本局上限可达60或64；单次最高升级费31。',
    '当前talents.json数值作为旧版参考，legacyEquivalentLevel只用于迁移/对照，不代表新局默认等级。',
    '所有数值均为首轮仿真起点 [PLACEHOLDER]，需接入后做Monte Carlo与实机验证。'
  ],
  designPillars:[
    '三角机会成本：升级、抽取（8灵感）、追加骰（8灵感）必须互相竞争。',
    '品质决定成长长度，不只决定初始强度；高品质更强但更难点满。',
    '升级提升效果但不取消代价：主动消耗最低1、暴击不超过47%、复制相性不超过130%。',
    '所有一次性效果按差值结算，避免升级复制资源。',
    '表与引擎同源：配置字段可直接映射，不靠UI硬编码。'
  ],
  failureSignals:[
    '普通文心平均升级率<35%：前两级成本过高或反馈太弱。',
    '史诗/传说满级率>15%：灵感sink失效，高品质点满过于常态。',
    '单一文心持有时升级选择率>75%：该曲线形成无脑必点。',
    '升级玩家相对同档未升级玩家胜率提升>15pp：纵向成长压倒局内决策。',
    '主动文心平均每场使用率>70%：后续消耗过低；<15%：费用/收益不匹配。'
  ]
};

writeFileSync(outPath, JSON.stringify({meta,qualityCosts,talentSummary,levelDetails,effectMapping,implementationChecklist},null,2),'utf8');
console.log(JSON.stringify({talents:talentSummary.length,levelRows:levelDetails.length,qualityRows:qualityCosts.length,effects:effectMapping.length,checks:implementationChecklist.length,outPath},null,2));
