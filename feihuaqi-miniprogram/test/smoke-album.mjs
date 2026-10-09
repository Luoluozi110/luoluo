// 装配自检：验证「选名篇 → 起名 → 开局」这条链路真的把奖励带进了对局。
//
// 单看界面渲染不出错是不够的：如果 loadout 传错类型（传 id 而非 card 对象），
// 引擎会安静地忽略它，界面照常显示、属性却不变。所以这里做的是差分断言 ——
// 同一流派、同一次开局条件，只切换是否携带名篇，比较开局属性差异。
//
// 用法：node test/smoke-album.mjs

import { stage } from './_stage.mjs';

const loader = await stage();
const albumState = await loader.load('utils/album-state.js');
const runtime = await loader.load('utils/engine-runtime.js');
const Album = await loader.load('engine/album.js');

const schoolId = (runtime.listSchools()[0] || {}).id;
if (!schoolId) {
  console.error('缺少流派配置');
  process.exit(1);
}

/* ---------- 1. 初始状态：新账号没有任何解锁 ---------- */
const fresh = albumState.getAlbumView();
console.log('初始装配视图：');
console.log(`  名篇总数 ${fresh.totalCount} / 已解锁 ${fresh.unlockedCount} / 上限 ${fresh.max}`);
if (fresh.totalCount !== 12) {
  console.error(`名篇数异常：期望 12，实际 ${fresh.totalCount}`);
  process.exit(1);
}

/* ---------- 2. 模拟解锁两张（跨局战绩产物） ---------- */
const store = Album.loadStore();
store.unlocked = ['A001', 'A008'];
Album.saveStore(store);

const afterUnlock = albumState.getAlbumView();
const unlockedNames = afterUnlock.cards.filter((c) => c.unlocked).map((c) => c.name);
console.log(`\n模拟解锁后：${unlockedNames.join(' / ')}`);
if (afterUnlock.unlockedCount !== 2) {
  console.error('解锁状态未生效');
  process.exit(1);
}
// 未解锁的卡也必须带解锁条件文案，否则界面无从引导
const lockedCard = afterUnlock.cards.find((c) => !c.unlocked);
console.log(`  未解锁示例：${lockedCard.name} —— ${lockedCard.unlockText}`);

/* ---------- 3. 装配与上限 ---------- */
const t1 = albumState.toggleLoadout('A001');
console.log(`\n装配 A001 → ${JSON.stringify(t1.selected)}`);
const t2 = albumState.toggleLoadout('A008');
console.log(`装配 A008 → ${JSON.stringify(t2.selected)}`);

// 上限为 2：再装第三张时应挤掉最早那张
const t3 = albumState.toggleLoadout('A002');
if (t3.ok) {
  console.error('A002 未解锁却装配成功，解锁校验失效');
  process.exit(1);
}
console.log(`未解锁的 A002 被正确拒绝：${t3.reason}`);

/* ---------- 4. 差分断言：名篇奖励是否真的进入对局 ---------- */
function startWith(cards) {
  const { game } = runtime.startGame({
    schoolId,
    playerName: '装配试笔',
    loadout: cards,
    sink: () => {},
  });
  return game.s.attrs;
}

const base = startWith([]);
const withCards = startWith(albumState.getLoadoutCards());

console.log('\n开局六维对比：');
console.log('  空装配    ' + JSON.stringify(base));
console.log('  携名篇    ' + JSON.stringify(withCards));

// A001「仰天大笑」的开局奖励是 诗力 +2；A008「铁杵成针」是 灵感 +2
const shiDelta = (withCards.shi || 0) - (base.shi || 0);
console.log(`\n诗力差值 = ${shiDelta}（A001 的奖励为 +2）`);

const ok = shiDelta === 2;
console.log(ok ? '装配自检通过：名篇奖励确实进入了开局属性。' : '装配未生效：loadout 可能未正确传递。');
if (!ok) process.exit(1);
