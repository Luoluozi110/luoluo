// 排行榜核心逻辑单测：去重（每人最高分）、同分先到优先、分数降序、仅留前 50。
import { normalize } from '../js/ui/leaderboard.js';

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log('  ✗', name); } }

// 1) 基础降序 + Top50 截断
{
  const rows = Array.from({ length: 60 }, (_, i) => ({ name: 'P' + i, score: 100 - i, ts: new Date(i * 1000).toISOString() }));
  const r = normalize(rows);
  ok('返回 50 条', r.length === 50);
  ok('降序', r.every((x, i) => i === 0 || r[i - 1].score >= x.score));
  ok('第 1 名分数最高', r[0].score === 100);
}

// 2) 同昵称去重：保留最高分
{
  const rows = [
    { name: '张三', score: 50, ts: new Date(3000).toISOString() },
    { name: '张三', score: 90, ts: new Date(1000).toISOString() },
    { name: '张三', score: 70, ts: new Date(2000).toISOString() }
  ];
  const r = normalize(rows);
  ok('去重为 1 条', r.length === 1);
  ok('保留最高分 90', r[0].name === '张三' && r[0].score === 90);
}

// 3) 同分按达成时间（先到优先）区分
{
  const rows = [
    { name: 'A', score: 80, ts: new Date(5000).toISOString() },
    { name: 'B', score: 80, ts: new Date(2000).toISOString() },
    { name: 'C', score: 80, ts: new Date(1000).toISOString() }
  ];
  const r = normalize(rows);
  ok('同分保持顺序（先到在前）', r[0].name === 'C' && r[1].name === 'B' && r[2].name === 'A');
}

// 4) 同分同时间按昵称（码点）稳定排序
{
  const rows = [
    { name: 'b', score: 80, ts: new Date(1000).toISOString() },
    { name: 'a', score: 80, ts: new Date(1000).toISOString() }
  ];
  const r = normalize(rows);
  ok('同分同时间按昵称排序', r[0].name === 'a' && r[1].name === 'b');
}

// 5) 空输入
ok('空数组返回空', normalize([]).length === 0);

// 6) 高精度/脏数据健壮
{
  const rows = [
    { name: 'x', score: '999', ts: 'not-a-date' },
    { name: undefined, score: null, ts: null },
    { name: 'y', score: 10 }
  ];
  const r = normalize(rows);
  ok('脏数据不崩溃', r.length === 3);
  ok('字符串分数被转数值', r.find(x => x.name === 'x').score === 999);
  ok('无名归为无名氏', r.some(x => x.name === '无名氏'));
  ok('null 分数按 0 处理', r.find(x => x.name === '无名氏').score === 0);
}

console.log(`\n排行榜逻辑测试：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
