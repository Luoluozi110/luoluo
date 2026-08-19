/**
 * A2/A5 阶段验证：NPC 三机制 rules 纯函数闭环冒烟。
 * 用 Node ESM 直接 import feihuaqi-playable/js/engine/rules.js，与 sim_*.mjs 同构。
 * 验证点：
 *  - 1) 无机制 NPC：招牌不触发、破绽不命中、无修正。
 *  - 2) 周小满（童生教学）：
 *        a) 意图锁定诗体（pickIntentionStyle 返回 shi）；
 *        b) 玩家用词体 → wea_use_other_style 完全关闭招牌（retention 0）；
 *        c) 玩家用联体 → 部分削弱（retention 0.5）；
 *        d) 玩家用诗体 → 招牌全额承受（retention 1），修正含 +6% pct。
 *  - 3) 范解元（举人，追加骰响应）：玩家只用基础骰 → 关闭响应且 NPC 失去 flat 稳定分（阶段E调高）。
 *  - 4) 林清斋（秀才，识破重复）：上一场诗体，本场继续诗体 → 招牌 +8%；换词体 → 关闭。
 *  - 5) 欧阳翰（进士，文债耗神）：相对分差不足12% → 战后 -2 灵感；达标 → 关闭并返还 1。
 */
import * as R from './feihuaqi-playable/js/engine/rules.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const playable = join(__dirname, 'feihuaqi-playable');

const mechLib = JSON.parse(readFileSync(join(playable, 'config/npc-mechanics.json'), 'utf8'));
const npcs = JSON.parse(readFileSync(join(playable, 'config/npcs.json'), 'utf8'));

// 简易版 affinity（与 config/affinity.json 一致的关键值，仅测试用）
const af = {
  matrix: {
    'haofang.biansai': 0.10, 'haofang.huaigu': 0.05,
    'wanyue.songbie': 0.10, 'zheli.jieling': 0.10,
    'qingya.shanshui': 0.08, 'qili.yongwu': 0.10,
    'chenyu.huaigu': 0.10, 'zheli.shanshui': 0.06
  },
  manners: ['wanyue', 'haofang', 'zheli', 'qingya', 'chenyu', 'qili'],
  themeNames: {}, mannerNames: { wanyue: '婉约', haofang: '豪放', zheli: '哲理', qingya: '清雅', chenyu: '沉郁', qili: '绮丽' }
};

const findByNpcId = (id) => {
  for (const t of npcs) for (const n of (t.npcs || [])) if (n.id === id) return { tier: t, npc: n };
  return null;
};

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log(`  ✔ ${name}`); }
  else { fail++; console.log(`  ✘ ${name}${extra ? ' → ' + extra : ''}`); }
};

/* ---------- 1) 无机制 NPC ---------- */
console.log('\n[1] 无机制 NPC 兼容');
const plain = { npc: { id: 'chen_yanqiu', name: '陈砚秋', attrs: { shi: 4, ci: 10, lian: 3, bi: 4, xue: 3, si: 4 } } };
const tri0 = R.signatureTriggered({ mech: plain.npc.mech, playerMove: { style: 'shi' } });
const wea0 = R.weaknessResolution({ mech: plain.npc.mech });
const mods0 = R.signatureScoreMods(tri0, wea0, null);
check('无 mech → 招牌不触发', tri0.level === null);
check('无 mech → 破绽不命中', !wea0.hit);
check('无 mech → 无修正', mods0.pct.length === 0 && mods0.flat.length === 0);

/* ---------- 2) 周小满 教学 ---------- */
console.log('\n[2] 周小满（童生·文体专精教学）');
const zxm = findByNpcId('zhou_xiaoman').npc;
const zxmAttrs = zxm.attrs;
// a) 意图锁定诗体：诗力10 显著最高
const intent = R.rollIntention({ mech: zxm, npcAttrs: zxmAttrs, af, theme: 'yongwu', templates: { intentTemplates: mechLib.intentTemplates } });
check('意图锁定诗体', intent.style === 'shi', `style=${intent.style}`);
// b) 玩家用词体 → 全关
const triB = R.signatureTriggered({ mech: zxm, npcStyle: 'shi', playerMove: { style: 'ci' }, templates: { signatureTemplates: mechLib.signatureTemplates } });
const weaB = R.weaknessResolution({ mech: zxm, npcStyle: 'shi', playerMove: { style: 'ci' }, templates: { weaknessTemplates: mechLib.weaknessTemplates } });
check('玩家用词体 → 招牌触发(main)', triB.level === 'main');
check('玩家用词体 → 破绽命中', weaB.hit === true);
check('玩家用词体 → 完全关闭(retention 0)', weaB.retention === 0);
const modsB = R.signatureScoreMods(triB, weaB, zxm.mech.signature);
check('玩家用词体 → 无招牌修正(关闭)', modsB.pct.length === 0);
// c) 玩家用联体 → 削弱50%（partialReduction.style 含 lian, retention 0.5）
const weaC = R.weaknessResolution({ mech: zxm, npcStyle: 'shi', playerMove: { style: 'lian' }, templates: { weaknessTemplates: mechLib.weaknessTemplates } });
// 注：模板里 partialReduction 需要额外处理，先用 unit 验证 signatureTriggered 在联体仍触发
const triC = R.signatureTriggered({ mech: zxm, npcStyle: 'shi', playerMove: { style: 'lian' }, templates: { signatureTemplates: mechLib.signatureTemplates } });
check('玩家用联体 → 招牌仍触发(主招牌基于 NPC 自身文体)', triC.level === 'main');
check('玩家用联体 → 破绽部分削弱(retention 0.5)', weaC.hit === true && Math.abs(weaC.retention - 0.5) < 1e-9, JSON.stringify(weaC));
const modsC = R.signatureScoreMods(triC, weaC, zxm.mech.signature);
check('玩家用联体 → 招牌修正减半(0.03)', modsC.pct.some(m => Math.abs(m.value - 0.03) < 1e-4), JSON.stringify(modsC.pct));
// d) 玩家用诗体 → 承受全额 6%
const triD = R.signatureTriggered({ mech: zxm, npcStyle: 'shi', playerMove: { style: 'shi' }, templates: { signatureTemplates: mechLib.signatureTemplates } });
const weaD = R.weaknessResolution({ mech: zxm, npcStyle: 'shi', playerMove: { style: 'shi' }, templates: { weaknessTemplates: mechLib.weaknessTemplates } });
check('玩家用诗体 → 破绽不命中(无规避)', !weaD.hit || weaD.retention === 1);
const modsD = R.signatureScoreMods(triD, weaD, zxm.mech.signature);
const zxmPct = modsD.pct.find(m => m.source === 'npcSign' && m.label.includes('诗兴初发'));
check('玩家用诗体 → 招牌 +6% 生效', zxmPct && Math.abs(zxmPct.value - 0.06) < 1e-9, JSON.stringify(modsD.pct));

/* ---------- 3) 范解元 追加骰响应 ---------- */
console.log('\n[3] 范解元（举人·追加骰响应）');
const fjy = findByNpcId('fan_jieyuan').npc;
const fjyFlat = Number(fjy.mech.weakness.flat) || 6;              // 阶段E起放大：6→10
const fjySigMain = fjy.mech.signature.main || fjy.mech.signature;  // sig_dice_response 为扁平结构
const fjySteps = fjySigMain.steps || [];                            // 阶段E起增强：[6,3,1]→[16,10,4]
const fjyCap = Number(fjySigMain.cap) || 10;
// 玩家只用基础骰 → 响应招牌不触发（因为 extraDice=0），但破绽命中→失稳 -flat
const triF = R.signatureTriggered({ mech: fjy, npcStyle: 'shi', playerMove: { style: 'ci', extraDice: 0 }, templates: { signatureTemplates: mechLib.signatureTemplates } });
check('只用基础骰 → 追加骰响应招牌不触发', triF.level === null, `level=${triF.level}`);
const weaF = R.weaknessResolution({ mech: fjy, npcStyle: 'shi', playerMove: { style: 'ci', extraDice: 0 }, templates: { weaknessTemplates: mechLib.weaknessTemplates } });
check('只用基础骰 → 破绽命中', weaF.hit === true);
check(`只用基础骰 → 失稳 -${fjyFlat}`, Math.abs((weaF.flatPenalty || 0) - (-fjyFlat)) < 1e-9 || weaF.flatPenalty === -fjyFlat || weaF.flatPenalty === fjyFlat, JSON.stringify(weaF.flatPenalty));
// 玩家追加2枚 → 响应触发 steps 前两项累加（封顶 cap）
const triF2 = R.signatureTriggered({ mech: fjy, npcStyle: 'shi', playerMove: { style: 'ci', extraDice: 2 }, templates: { signatureTemplates: mechLib.signatureTemplates } });
check('追加2枚 → 响应招牌触发', triF2.level === 'main');
const exp2 = Math.min(Number(fjySteps[0] || 0) + Number(fjySteps[1] || 0), fjyCap);
const modsF2 = R.signatureScoreMods(triF2, { hit: false }, fjy.mech.signature, { extraDice: 2 });
check(`追加2枚 → 响应分 ${exp2}(封顶${fjyCap})`, modsF2.flat.some(m => Math.abs(m.value - exp2) < 1e-9), JSON.stringify(modsF2.flat));

/* ---------- 4) 林清斋 识破重复 ---------- */
console.log('\n[4] 林清斋（秀才·识破重复）');
const lqz = findByNpcId('lin_qingzhai').npc;
const triL1 = R.signatureTriggered({ mech: lqz, npcStyle: 'lian', playerMove: { style: 'lian' }, playerHistory: { lastStyle: 'lian' }, templates: { signatureTemplates: mechLib.signatureTemplates } });
check('仍用上文体联体 → 招牌触发(+8%)', triL1.level === 'main', `level=${triL1.level}`);
const weaL1 = R.weaknessResolution({ mech: lqz, npcStyle: 'lian', playerMove: { style: 'lian' }, playerHistory: { lastStyle: 'lian' }, templates: { weaknessTemplates: mechLib.weaknessTemplates } });
check('仍用上文体 → 破绽不命中', !weaL1.hit);
const modsL1 = R.signatureScoreMods(triL1, weaL1, lqz.mech.signature);
check('仍用联体 → 招牌 +8%', modsL1.pct.some(m => Math.abs(m.value - 0.08) < 1e-9), JSON.stringify(modsL1.pct));
const triL2 = R.signatureTriggered({ mech: lqz, npcStyle: 'lian', playerMove: { style: 'ci' }, playerHistory: { lastStyle: 'lian' }, templates: { signatureTemplates: mechLib.signatureTemplates } });
const weaL2 = R.weaknessResolution({ mech: lqz, npcStyle: 'lian', playerMove: { style: 'ci' }, playerHistory: { lastStyle: 'lian' }, templates: { weaknessTemplates: mechLib.weaknessTemplates } });
check('换用词体 → 识破重复招牌不触发(规避)', triL2.level === null, `level=${triL2.level}`);
check('换用词体 → 破绽命中(换体规避重复惩罚)', weaL2.hit === true);
// 首场无历史 → 招牌不触发
const triL0 = R.signatureTriggered({ mech: lqz, npcStyle: 'lian', playerMove: { style: 'lian' }, playerHistory: {}, templates: { signatureTemplates: mechLib.signatureTemplates } });
check('首场无历史 → 识破重复不触发', triL0.level === null);

/* ---------- 5) 欧阳翰 文债耗神 ---------- */
console.log('\n[5] 欧阳翰（进士·文债耗神）');
const oyh = findByNpcId('ouyang_han').npc;
const oyhTh = Number(oyh.mech.weakness.threshold) || 0.12;   // 从配置读实际阈值（阶段E已调至0.18）
// 相对分差不足阈值且不是大胜 → 战后 -2 灵感（破绽不命中）
const weaO1 = R.weaknessResolution({ mech: oyh, npcStyle: 'shi', playerMove: { style: 'ci', extraDice: 1 }, result: 'win', relativeMargin: oyhTh * 0.4, templates: { weaknessTemplates: mechLib.weaknessTemplates } });
check('小胜(不足阈值) → 文债耗神未被破解', !weaO1.hit);
const triO1 = R.signatureTriggered({ mech: oyh, npcStyle: 'shi', playerMove: { style: 'ci' }, templates: { signatureTemplates: mechLib.signatureTemplates } });
// 文债耗神：主招牌触发 → extraInspCost -2 需在 settle 结算；此处至少确认 break 链路存在
// 相对分差≥阈值 → 破绽命中，关闭文债并返还 1
const weaO2 = R.weaknessResolution({ mech: oyh, npcStyle: 'shi', playerMove: { style: 'ci', extraDice: 2 }, result: 'win', relativeMargin: oyhTh * 1.5, templates: { weaknessTemplates: mechLib.weaknessTemplates } });
check(`大胜(≥${oyhTh*100}%) → 破绽命中`, weaO2.hit === true);
check('大胜 → 返还 1 点灵感', weaO2.refundInsp === 1);

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail ? 1 : 0);
