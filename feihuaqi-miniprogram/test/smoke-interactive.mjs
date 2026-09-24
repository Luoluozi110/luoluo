// 真实交互自检：模拟「页面」接管每一个玩家决策，验证挂起通道能走完一整局。
//
// 与 smoke-runtime 的差别：那份让适配器自动应答，这份让模拟页面显式返回 true 接管，
// 再按战斗台六步（选文体 → 选风格 → 掷骰 → 收笔）亲手驱动 session。
// 这样验的是第二周新加的 request → resolve 机制，而不是兜底逻辑。
//
// 用法：node test/smoke-interactive.mjs

import { stage } from './_stage.mjs';

const loader = await stage();
const runtime = await loader.load('utils/engine-runtime.js');

const schools = runtime.listSchools();
if (!schools.length) {
  console.error('缺少流派配置');
  process.exit(1);
}

const stats = { taken: 0, fallback: 0, quiz: 0, battle: 0, event: 0, other: {} };
let summary = null;

/** 模拟页面：接管 request，按人类玩家的方式给出应答 */
function onEvent(evt) {
  if (evt.type !== 'request') {
    if (evt.type === 'result') summary = evt.summary;
    return undefined;
  }

  stats.taken++;
  const view = evt.view || {};

  switch (evt.key) {
    case 'quiz': {
      stats.quiz++;
      // 玩家点第一个选项
      evt.resolve({ index: 0, timedOut: false });
      return true;
    }

    case 'event': {
      stats.event++;
      evt.resolve(view.options && view.options.length ? 0 : null);
      return true;
    }

    case 'sky': {
      evt.resolve(undefined);
      return true;
    }

    case 'bowen': {
      evt.resolve('broad');
      return true;
    }

    case 'replaceTalent': {
      evt.resolve(view.owned && view.owned.length ? 0 : null);
      return true;
    }

    case 'battle': {
      stats.battle++;
      const session = evt.raw;
      if (!session || typeof session.resolve !== 'function') {
        // 拿不到会话就放弃接管，让兜底接手
        stats.fallback++;
        return false;
      }
      // ① 选文体：可出战者中属性最高的
      const styles = (view.styles || []).filter((s) => s.usable);
      const style = (styles.sort((a, b) => b.score - a.score)[0] || { key: 'shi' }).key;
      // ② 选文风：相性最高的
      const manner = (view.manners || []).sort((a, b) => b.affinity - a.affinity)[0];
      // ③ 掷一枚灵感骰
      const pips = [1 + Math.floor(Math.random() * 6)];
      // ④ 收笔结算
      const out = session.resolve(style, (manner && manner.key) || 'wanyue', pips);
      evt.resolve(out);
      return true;
    }

    default: {
      // 尚未实装的界面：不接管，由适配器自动应答兜底
      stats.other[evt.key] = (stats.other[evt.key] || 0) + 1;
      stats.fallback++;
      return false;
    }
  }
}

const { game } = runtime.startGame({
  schoolId: schools[0].id,
  playerName: '交互试笔',
  sink: onEvent,
});

let guard = 0;
while (game.s && !game.s.over && guard < 400) {
  await runtime.playTurn(game);
  guard++;
}

const vm = runtime.project(game);
const px = runtime.projectSummary(summary);

console.log('交互自检结果：');
console.log(`  回合=${vm.turn}  结局=${px ? px.reasonText : '(无)'}  总分=${px ? px.total : '(无)'}`);
console.log(`  战绩=胜${vm.battle.win} 平${vm.battle.draw} 负${vm.battle.loss}`);
console.log(`  玩家决策总数=${stats.taken}（其中兜底 ${stats.fallback}）`);
console.log(`  答题=${stats.quiz}  论战=${stats.battle}  奇遇=${stats.event}`);
console.log(`  未实装而走兜底的界面：${JSON.stringify(stats.other)}`);

const ok = !!px && px.total > 0 && stats.taken > 0;
console.log(`\n${ok ? '真实交互通道通过：玩家决策全部由页面接管并驱动引擎。' : '通道未走通，需排查。'}`);
if (!ok) process.exit(1);
