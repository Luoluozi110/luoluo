/** sim_mech_hints_unit.mjs —— 阶段 B：研判 / 定策 / 结算明细 文案生成器单元测试 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cwd = join(__dirname, 'feihuaqi-playable');

const npcs = JSON.parse(readFileSync(join(cwd, 'config/npcs.json'), 'utf-8'));
import { intentHint, weaknessHint, settleLines, signatureName, weaknessName } from './feihuaqi-playable/js/ui/mechHints.js';

const STYLE_NAMES = { shi: '诗', ci: '词', lian: '联', bi: '笔', xue: '学', si: '思' };
const MANNER_NAMES = { wanyue: '婉约', haofang: '豪放', zheli: '哲理', qingya: '清雅', chenyu: '沉郁', qili: '绮丽' };
const ctx = { styleNames: STYLE_NAMES, mannerNames: MANNER_NAMES };

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log(`  ✗ ${msg}`); } };

const mechanicNPCs = [];
for (const tier of npcs) for (const n of (tier.npcs || [])) if (n.mech) mechanicNPCs.push({ tier, npc: n });

console.log(`机制 NPC 数量：${mechanicNPCs.length}\n`);

for (const { tier, npc } of mechanicNPCs) {
  const name = `${tier.tier}·${npc.name}`;
  console.log(`--- ${name} (${npc.id}) ---`);

  // signatureName / weaknessName
  const sn = signatureName(npc.mech), wn = weaknessName(npc.mech);
  ok(typeof sn === 'string' && sn.length > 0, `${name} signatureName 非空`);
  ok(typeof wn === 'string' && wn.length > 0, `${name} weaknessName 非空`);

  // 研判卡（full disclosure 模拟）
  const hints = intentHint(npc, { style: 'shi', manner: 'zheli', styleDisclosed: true, mannerDisclosed: true }, ctx);
  ok(Array.isArray(hints) && hints.length >= 2, `${name} 研判卡条数 ≥2 (${hints.length})`);
  for (const h of hints) {
    ok(h.tag && h.title && h.body, `${name} 研判卡字段完整 [${h.tag}/${h.title}/${h.body}]`);
  }

  // 定策破绽提示
  const tip = weaknessHint(npc.mech, ctx);
  if (npc.mech.weakness) {
    ok(typeof tip === 'string' && tip.length > 0, `${name} 破绽提示非空`);
  } else {
    ok(tip === null, `${name} 无 weak 返回 null`);
  }

  // 结算明细：招牌触发情形
  const tri = { level: 'main', key: sn, reason: '触发' };
  const wea = { hit: true, reason: '命中', shutdownLevel: 'full', retention: 0 };
  const mods = { pct: [{ source: 'npcSign', label: `招牌·${sn}`, value: 0.06 }], flat: [], playerBonusPct: 0, refundInsp: 0, infoBonus: 0 };
  const lines = settleLines(npc, { tri, wea, mods }, ctx);
  ok(Array.isArray(lines) && lines.length >= 1, `${name} 结算明细条数 ≥1`);
  for (const l of lines) ok(l.label && l.body && l.tone, `${name} 结算明细字段完整`);

  // 未触发招牌 → 空
  const none = settleLines(npc, { tri: { level: null }, wea: { hit: false }, mods: {} }, ctx);
  ok(none.length === 0, `${name} 未触发招牌返回空数组`);
}

// 边界：无 mech → 全部安全
console.log('\n--- 无机制 NPC 边界 ---');
const plain = { name: '普通NPC', attrs: {} };
ok(intentHint(plain, null, ctx).length === 0, 'intentHint 无 mech 空');
ok(weaknessHint(plain.mech, ctx) === null, 'weaknessHint 无 mech null');
ok(settleLines(plain, null, ctx).length === 0, 'settleLines null mechOut 空');
ok(settleLines(plain, { tri: null }, ctx).length === 0, 'settleLines tri null 空');

// 边界：null/undefined 输入
ok(settleLines(null, null, ctx).length === 0, 'settleLines null npc 空');
ok(weaknessHint(null, ctx) === null, 'weaknessHint null null');
ok(intentHint(null, null, ctx).length === 0, 'intentHint null 空');

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail ? 1 : 0);
