import { strict as assert } from 'assert';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { sixDimScore } from '../js/engine/rules.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(__dirname, '../config/grades.json'), 'utf8'));

// 直接用内容侧 grades.json 跑六维结算（sixDimScore 内部会适配为引擎结构）。
function score(over = {}) {
  return sixDimScore({
    attrs: { shi: 5, ci: 5, lian: 5, bi: 5, xue: 5, si: 5 },
    battle: {}, events: {}, finish: {},
    ...over
  }, cfg);
}
const part = (scored, key, label) =>
  scored.dims.find(d => d.key === key).parts.find(p => p.label.includes(label));
const has = (scored, key, label) => !!part(scored, key, label);

console.log('== 流派分·三绝：均≥14 已收紧为 ≥18 ==');
{
  // 旧阈值(14)下能拿，新阈值(18)下拿到：以 16 验证“拿不到”
  const low = score({ attrs: { shi: 16, ci: 16, lian: 16, bi: 5, xue: 5, si: 5 } });
  assert.ok(!has(low, 'liupai', '三绝'), '三创均 16（<18）不应再拿流派三绝');
  // 达 18 仍能拿
  const ok = score({ attrs: { shi: 20, ci: 20, lian: 20, bi: 5, xue: 5, si: 5 } });
  assert.ok(has(ok, 'liupai', '三绝'), '三创均 20（≥18）应拿流派三绝');
}

console.log('== 战绩分·三体皆胜：各胜≥2 已收紧为 ≥3 ==');
{
  const low = score({ battle: { winsByStyle: { shi: 2, ci: 2, lian: 2 }, win: 6 } });
  assert.ok(!has(low, 'zhanji', '三体皆胜'), '三体各胜 2 场不应再拿三体皆胜');
  const ok = score({ battle: { winsByStyle: { shi: 3, ci: 3, lian: 3 }, win: 9 } });
  assert.ok(has(ok, 'zhanji', '三体皆胜'), '三体各胜 3 场应拿三体皆胜');
}

console.log('== 圆满分·捷才：≤54 回合已收紧为 ≤48 回合 ==');
{
  const low = score({ finish: { reached: true, turns: 52, inspirationLeft: 10 } });
  assert.ok(!has(low, 'yuanman', '捷才'), '52 回合抵达不应再拿捷才');
  const ok = score({ finish: { reached: true, turns: 46, inspirationLeft: 10 } });
  assert.ok(has(ok, 'yuanman', '捷才'), '46 回合抵达应拿捷才');
}

console.log('== 圆满分·从容：≤56 回合且灵感≥5 已收紧为 ≤50 回合且灵感≥6 ==');
{
  const lowTurns = score({ finish: { reached: true, turns: 52, inspirationLeft: 8 } });
  assert.ok(!has(lowTurns, 'yuanman', '从容'), '52 回合不应拿从容');
  const lowInsp = score({ finish: { reached: true, turns: 48, inspirationLeft: 5 } });
  assert.ok(!has(lowInsp, 'yuanman', '从容'), '灵感仅 5 不应拿从容');
  const ok = score({ finish: { reached: true, turns: 50, inspirationLeft: 6 } });
  assert.ok(has(ok, 'yuanman', '从容'), '≤50 回合且灵感≥6 应拿从容');
}

console.log('== 功力分·根基深厚：三项极差≤3 已收紧为 ≤2 ==');
{
  const low = score({ attrs: { shi: 5, ci: 5, lian: 5, bi: 10, xue: 13, si: 13 } });
  assert.ok(!has(low, 'gongli', '根基深厚'), '三项极差 3 不应再拿根基深厚');
  const ok = score({ attrs: { shi: 5, ci: 5, lian: 5, bi: 10, xue: 12, si: 12 } });
  assert.ok(has(ok, 'gongli', '根基深厚'), '三项极差 2 应拿根基深厚');
}

console.log('== 功力分·偏锋：任一项≥16 已收紧为 ≥20 ==');
{
  const low = score({ attrs: { shi: 5, ci: 5, lian: 5, bi: 18, xue: 5, si: 5 } });
  assert.ok(!has(low, 'gongli', '偏锋'), '单功力 18（<20）不应再拿偏锋');
  const ok = score({ attrs: { shi: 5, ci: 5, lian: 5, bi: 22, xue: 5, si: 5 } });
  assert.ok(has(ok, 'gongli', '偏锋'), '单功力 22（≥20）应拿偏锋');
}

console.log('== 顶部精英档与文宗门槛未被本次改动波及 ==');
{
  // 诗仙：诗力>词+联 且 ≥30 且 诗胜≥3（阈值本就高，未动）
  const sx = score({
    attrs: { shi: 34, ci: 8, lian: 8, bi: 5, xue: 5, si: 5 },
    battle: { winsByStyle: { shi: 3, ci: 0, lian: 0 }, win: 3 }
  });
  assert.ok(has(sx, 'liupai', '诗仙'), '诗仙（高门槛）仍可达');
}

console.log('OK 评分收紧专项测试全部通过');
