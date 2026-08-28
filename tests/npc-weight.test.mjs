#!/usr/bin/env node
// 具名 NPC 出战权重（阶段 A2）· 单元测试
// 校验 rules.js 的加权抽取纯函数（pickNpcByWeight / pickNpcByWeightUnique / npcWeight），
// 以及 game.pickNpc（普通战）按权重抽取、weight=0 不出战。
import { strict as assert } from 'assert';
import { pickNpcByWeight, pickNpcByWeightUnique, npcWeight, NPC_DEFAULT_WEIGHT } from '../js/engine/rules.js';
import { Game } from '../js/engine/game.js';

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra != null ? '  →  ' + extra : '')); }
}

/* ---------- npcWeight ---------- */
console.log('[1] npcWeight 归一化');
ok(npcWeight(undefined) === NPC_DEFAULT_WEIGHT && NPC_DEFAULT_WEIGHT === 100, '缺省→默认 100');
ok(npcWeight({}) === 100, '空对象→100');
ok(npcWeight({ weight: 0 }) === 0, 'weight=0→0（不出战）');
ok(npcWeight({ weight: 500 }) === 500, 'weight=500→500');
ok(npcWeight({ weight: -3 }) === 100, '负值→回退默认（防御）');
ok(npcWeight({ weight: 'abc' }) === 100, '非数字→回退默认（防御）');

/* ---------- pickNpcByWeight ---------- */
console.log('[2] pickNpcByWeight 按权重概率');
{
  // 用可编程 rand 验证命中阈值：rand()=0 → 命中第一个；接近 1 → 命中最后一个
  const pool = [{ name: 'A', weight: 10 }, { name: 'B', weight: 90 }, { name: 'C', weight: 0 }];
  const first = pickNpcByWeight(pool, () => 0.0); // r=0 → A
  ok(first.name === 'A', 'r=0 命中权重段 0（A, w=10）', JSON.stringify(first && first.name));
  // 10/100=0.1, 100/100 区间 [0.1,1)→B；取 r=0.5
  const mid = pickNpcByWeight(pool, () => 0.5);
  ok(mid.name === 'B', 'r=0.5 命中权重段 (0.1,1)（B, w=90）', JSON.stringify(mid && mid.name));
  // 尾部 r=0.99999 → 仍为 B
  const tail = pickNpcByWeight(pool, () => 0.99999);
  ok(tail.name === 'B', 'r→1 命中段尾（B）', JSON.stringify(tail && tail.name));
}
{
  ok(pickNpcByWeight([], Math.random) === null, '空池→null');
  ok(pickNpcByWeight(null, Math.random) === null, 'null→null');
  ok(pickNpcByWeight([{ name: 'X', weight: 0 }, { name: 'Y', weight: 0 }], Math.random) === null, '全 weight=0→null（全部不出战）');
}
{
  // 全部缺省 weight → 等概率；随机 100000 次应大致均匀
  const pool = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
  const counts = { A: 0, B: 0, C: 0 };
  for (let i = 0; i < 30000; i++) counts[pickNpcByWeight(pool, Math.random).name]++;
  const err = Math.abs(counts.A - counts.B) + Math.abs(counts.B - counts.C);
  ok(err < 4000, '缺省权重等概率（A/B/C 各 ~1 万 ±容差），实测 ' + JSON.stringify(counts));
}

/* ---------- pickNpcByWeightUnique ---------- */
console.log('[3] pickNpcByWeightUnique 按权重不重复取 n');
{
  const pool = [{ name: 'A', weight: 100 }, { name: 'B', weight: 10 }, { name: 'C', weight: 1 }];
  const got = pickNpcByWeightUnique(pool, 3, () => 0.0);
  ok(got.length === 3, '取满 3 个');
  ok(new Set(got.map(x => x.name)).size === 3, '三者不重复', JSON.stringify(got.map(x => x.name)));
  ok(got[0] && got[0].name === 'A', '以 A 权重最高最先（r=0 命中 A）', JSON.stringify(got[0] && got[0].name));
}
{
  // 权重悬殊：取 2 个，若 A 权重占绝对多数，几乎总是 A + 剩余（B/C 之一）
  const pool = [
    { name: 'A', weight: 10000 },
    { name: 'B', weight: 1 },
    { name: 'C', weight: 1 }
  ];
  const got = pickNpcByWeightUnique(pool, 2, () => 0.000001);
  ok(got[0] && got[0].name === 'A' && got[1] && got[1].name !== 'A', '高权重 A 必中，第二把落到余下（不重复）', JSON.stringify(got.map(x => x && x.name)));
}
{
  // 权重全部 0 → 返回 count 个 null（由调用方兜底）
  const got = pickNpcByWeightUnique([{ name: 'Q', weight: 0 }], 3, Math.random);
  ok(got.length === 3, '长度=count');
  ok(got.every(x => x === null), '全 0 → 全 null（调用方兜底退化）');
}
{
  // count 超过池项数 → 按实际可抽数量返回
  const got = pickNpcByWeightUnique([{ name: 'M' }, { name: 'N' }], 5, Math.random);
  ok(got.length === 5 && got.filter(Boolean).length === 2, '只抽得到 2 个有效，其余补 null', JSON.stringify(got.map(x => x && x.name)));
}

/* ---------- game.pickNpc（普通战）加权 ---------- */
/**
 * 普通战加权：需最小 board（供 progress 计算档位）与 s 状态。
 * 构造一个 range=[0,1] 全覆盖的档，则进度任意都在该档内。
 */
function mkGame() {
  const board = { ringSize: 60, laps: 2, mainRing: [] };
  const g = new Game({ board, npcs: [] }, {});
  g.s = { lap: 1, pos: 0, inspiration: 100, attrs: {}, sky: [] };
  return g;
}

console.log('[4] game.pickNpc 普通战按 weight 抽取 & weight=0 跳过');
{
  const g = mkGame();
  g.cfg.npcs = [{ id: 'a', tier: '甲级', range: [0, 1], npcs: [
    { name: '常客', weight: 1 },
    { name: '路人', weight: 1 }
  ] }];
  g.rand = () => 0.0; // r → 命中权重数组首项「常客」
  const pick = g.pickNpc(false);
  ok(pick.name === '常客', 'rand=0 命中首项（权重均 1）', pick.fullName);
}
{
  // 第一项 weight=0 → 恒落第二项（r 任意）
  const g = mkGame();
  g.cfg.npcs = [{ id: 'a', tier: '甲级', range: [0, 1], npcs: [
    { name: '不出战', weight: 0 },
    { name: '稳定出现', weight: 100 }
  ] }];
  let all = true;
  for (let i = 0; i < 200; i++) {
    const p = g.pickNpc(false);
    if (p.name !== '稳定出现') { all = false; break; }
  }
  ok(all, 'weight=0 的「不出战」永不出现，200 次均为「稳定出现」');
}

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
