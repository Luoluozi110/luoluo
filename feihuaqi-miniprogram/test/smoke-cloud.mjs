// 云函数自检：用内存数据库替身跑真实云函数代码。
//
// 为什么值得单独测：云函数是服务端逻辑，出错的代价比前端高——
// 名次算错、分数被刷、重复入库都不会被用户当场发现。
// 这些代码此前从未运行过（真机云环境还没联调），所以先在本地把逻辑钉住。
//
// 用法：node test/smoke-cloud.mjs

import { createMockCloud, loadCloudFunction } from './cloud-mock.mjs';

const sdk = createMockCloud();
const loader = (p) => loadCloudFunction(sdk, p);

const authLogin = await loader('../cloudfunctions/authLogin/index.js');
const submitScore = await loader('../cloudfunctions/submitScore/index.js');
const getRank = await loader('../cloudfunctions/getRank/index.js');
const trackChannel = await loader('../cloudfunctions/trackChannel/index.js');

let pass = 0;
let fail = 0;
function check(label, cond, extra) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ ${label}${extra ? '  ← ' + JSON.stringify(extra) : ''}`);
  }
}

/* ---------------- 1. 静默登录与建档 ---------------- */
console.log('\n[authLogin] 静默登录');
sdk.__setOpenid('openid_A');
const first = await authLogin.main({ channel: 'share' });
check('首次调用即建档', first.code === 0 && !!first.openid, first);
check('渠道被记录', first.user && first.user.channel === 'share', first.user);

const second = await authLogin.main({ channel: 'direct' });
check('二次调用复用同一档案（不重复建档）', second.user && second.user._id === first.user._id, {
  a: first.user._id,
  b: second.user._id,
});
check('用户表只有一条记录', (sdk.__collections.get('users') || []).length === 1);

/* ---------------- 2. 分数提交的四道校验 ---------------- */
console.log('\n[submitScore] 分数校验');

const bad1 = await submitScore.main({ score: -5, runId: 'r1', duration: 60000 });
check('负分被拒', bad1.code === 400, bad1);

const bad2 = await submitScore.main({ score: 1e9, runId: 'r2', duration: 60000 });
check('超出上限被拒', bad2.code === 400, bad2);

const bad3 = await submitScore.main({ score: 1200, runId: 'r3', duration: 3000 });
check('对局时长过短被拒（防秒提交）', bad3.code === 400, bad3);

const ok1 = await submitScore.main({ score: 1200, runId: 'r4', duration: 60000, grade: 'juren' });
check('合法分数成功入库', ok1.code === 0, ok1);

const dup = await submitScore.main({ score: 1200, runId: 'r4', duration: 60000 });
check('同一 runId 重复提交被幂等拦截', dup.code === 0 && dup.duplicated === true, dup);

const tooFast = await submitScore.main({ score: 1300, runId: 'r5', duration: 60000 });
check('提交过于频繁被频控', tooFast.code === 429, tooFast);

/* ---------------- 3. 榜单只留最好成绩 ---------------- */
console.log('\n[submitScore] 榜单更新');
sdk.__setOpenid('openid_B');
await submitScore.main({ score: 2000, runId: 'b1', duration: 60000, force: true });
await submitScore.main({ score: 1500, runId: 'b2', duration: 60000, force: true });

const board = sdk.__collections.get('leaderboard') || [];
const bRow = board.find((r) => r.openid === 'openid_B');
check('更低分不覆盖最高分', bRow && bRow.score === 2000, bRow);

await submitScore.main({ score: 2600, runId: 'b3', duration: 60000, force: true });
const bRow2 = (sdk.__collections.get('leaderboard') || []).find((r) => r.openid === 'openid_B');
check('更高分覆盖旧纪录', bRow2 && bRow2.score === 2600, bRow2);
check('每人榜单只留一行', board.filter((r) => r.openid === 'openid_B').length === 1);

/* ---------------- 4. 名次计算 ---------------- */
console.log('\n[getRank] 名次');
// 再放两个不同分数的人，构造 2600 / 2000(A) / 1200(A 的另一次提交) 的局面
sdk.__setOpenid('openid_C');
await submitScore.main({ score: 1800, runId: 'c1', duration: 60000, force: true });

sdk.__setOpenid('openid_B'); // 2600 分
const rankB = await getRank.main({ page: 1 });
check('榜单按分数降序', rankB.list.length >= 2 && rankB.list[0].score >= rankB.list[1].score, rankB.list);
check('自己的名次为第 1', rankB.me && rankB.me.rank === 1 && rankB.me.score === 2600, rankB.me);

sdk.__setOpenid('openid_C'); // 1800 分，应排第 2 或第 3
const rankC = await getRank.main({ page: 1 });
check('非最高分者名次正确', rankC.me && rankC.me.rank > 1, rankC.me);

sdk.__setOpenid('openid_new'); // 没提交过的人
const rankNew = await getRank.main({ page: 1 });
check('未上榜者 me 为 null', rankNew.me === null, rankNew.me);

/* ---------------- 5. 渠道统计的 PV / UV ---------------- */
console.log('\n[trackChannel] 渠道统计');
sdk.__setOpenid('openid_A');
const t1 = await trackChannel.main({ channel: 'share' });
const t2 = await trackChannel.main({ channel: 'share' });
check('同一用户当日只计一次 UV', t1.newVisitor === true && t2.newVisitor === false, { t1, t2 });

const daily = (sdk.__collections.get('channelDaily') || []).find((d) => d.channel === 'share');
check('PV 每次累加', daily && daily.count === 2, daily);
check('UV 去重后为 1', daily && daily.uv === 1, daily);

sdk.__setOpenid('openid_other');
const t3 = await trackChannel.main({ channel: 'share' });
check('换用户后 UV 递增', t3.newVisitor === true, t3);
const daily2 = (sdk.__collections.get('channelDaily') || []).find((d) => d.channel === 'share');
check('UV 累计为 2', daily2 && daily2.uv === 2, daily2);

/* ---------------- 汇总 ---------------- */
console.log(`\n云函数自检：${pass} 通过 / ${fail} 失败`);
if (fail) {
  console.error('存在未通过的断言，请排查。');
  process.exit(1);
}
console.log('全部通过。注意：这是内存替身，真机仍需一次端到端联调。');
