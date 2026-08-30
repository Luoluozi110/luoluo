#!/usr/bin/env node
// 文心「知人论世 / 夺胎换骨」去重与升级递进验收。
// 锁定：两条文心不再共用 copy_affinity；T011 升级逐级新增可感知能力；TA02 改为借敌招牌并按敌强缩放。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CFG = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'config', `${name}.json`), 'utf8'));

const talents = CFG('talents');
const up = CFG('talent-upgrade');

const byId = id => talents.find(t => t.id === id);
const T011 = byId('T011');
const TA02 = byId('TA02');
const T011up = up.T011;
const TA02up = up.TA02;

console.log('== 两条文心已解耦：类型不再重复 ==');
{
  assert.equal(T011.kind, 'passive', '知人论世为被动');
  assert.equal(TA02.kind, 'active', '夺胎换骨为主动');
  assert.equal(T011.effect.type, 'copy_affinity', '知人论世仍复制相性');
  assert.equal(TA02.effect.type, 'borrow_signature', '夺胎换骨改为借敌招牌');
  assert.notEqual(T011.effect.type, TA02.effect.type, '二者效果类型不再相同（消除重复）');
}

console.log('== 知人论世升级：逐级新增能力（非纯比率微调） ==');
{
  assert.equal(T011up.maxLevel, 6, 'maxLevel=6');
  const L = T011up.levels;
  assert.equal(L.length, 6);

  // 强反馈曲线：每级均提升，并从 Lv2 起揭示意图
  assert.equal(L[0].effect.ratio, 0.8, 'Lv1 复制 80%');
  assert.equal(L[1].effect.ratio, 0.9, 'Lv2 复制 90%');
  assert.equal(L[1].effect.revealIntent, true, 'Lv2 开始揭示意图');

  // Lv3：揭示对手意图（此前完全没有的能力）
  assert.equal(L[2].effect.revealIntent, true, 'Lv3 揭示意图');
  assert.equal(L[2].effect.ratio, 1.0);

  // Lv4：相性协同（+3% 当文风一致）
  assert.equal(L[3].effect.synergyPct, 0.04, 'Lv4 文风协同 +4%');
  assert.equal(L[3].effect.revealIntent, true);

  // Lv5：通晓题材（+3% 泛化）
  assert.equal(L[4].effect.themeFlat, 0.04, 'Lv5 通晓题材 +4%');
  assert.equal(L[4].effect.synergyPct, 0.04);
  assert.equal(L[4].effect.revealIntent, true);

  // Lv6：相性化境（转化 50%）+ 揭示破绽
  assert.equal(L[5].effect.convertPct, 0.5, 'Lv6 相性化境转化 50%');
  assert.equal(L[5].effect.revealWeakness, true, 'Lv6 揭示破绽');
  assert.equal(L[5].effect.themeFlat, 0.04);
  assert.equal(L[5].effect.synergyPct, 0.04);
  assert.equal(L[5].effect.revealIntent, true);

  // 关键不变量：相邻等级的效果“指纹”互不相同（升级确有可感知差异）
  const fp = e => JSON.stringify([e.ratio, !!e.revealIntent, e.synergyPct || 0, e.themeFlat || 0, e.convertPct || 0, !!e.revealWeakness]);
  for (let i = 1; i < L.length; i++) {
    assert.notEqual(fp(L[i - 1].effect), fp(L[i].effect), `Lv${i} 与 Lv${i + 1} 能力指纹不同`);
  }
}

console.log('== 夺胎换骨：借敌招牌且随等级增强 ==');
{
  assert.equal(TA02up.maxLevel, 4, 'maxLevel=4');
  const L = TA02up.levels;
  assert.equal(L.length, 4);
  const fracs = L.map(x => x.effect.fraction);
  for (const x of L) assert.equal(x.effect.type, 'borrow_signature', '每级均为 borrow_signature');
  // 严格递增
  for (let i = 1; i < fracs.length; i++) assert.ok(fracs[i] > fracs[i - 1], `fraction 递增：${fracs}`);
  assert.deepEqual(fracs, [0.3, 0.45, 0.6, 0.75], '缩放比例 0.3→0.75');
  for (const x of L) assert.equal(x.cost, 3, '费用恒为 3');
}

console.log('OK: 知人论世 / 夺胎换骨 去重与升级递进验收通过');
