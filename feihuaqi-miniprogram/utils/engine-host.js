// 引擎宿主：H5 引擎与小程序页面之间的桥接层
//
// 存在理由：
// 1) js/engine 是纯逻辑无 DOM 代码，理论上可直接复用，但它对外暴露的是"完整状态对象"。
//    小程序若直接把状态塞进 Page.data，每次 setData 都要跨线程序列化几十 KB，必然掉帧。
//    因此宿主负责把引擎状态"投影"成最小视图模型。
// 2) 移植期与联调期解耦：MODE = 'mock' 时用假数据驱动界面，UI 可以先于引擎完成。
//
// 移植完成后把 MODE 切到 'engine'，并按需补齐全量方法即可。

const MODE = 'mock';

// 六维展示顺序，与 H5 HUD 保持一致
const ATTR_ORDER = ['bili', 'xueli', 'sili', 'gelv', 'caiqing', 'qiyun'];
const ATTR_LABEL = {
  bili: '笔力',
  xueli: '学力',
  sili: '思力',
  gelv: '格律',
  caiqing: '才情',
  qiyun: '气韵',
};

function mockEngine(seed) {
  const state = {
    round: 1,
    lap: 1,
    pos: seed % 60,
    inspiration: 48,
    attrs: { bili: 12, xueli: 10, sili: 9, gelv: 8, caiqing: 11, qiyun: 7 },
    phase: 'idle',
    tiles: Array.from({ length: 60 }, (_, i) => ({
      index: i,
      kind: ['ping', 'ze', 'exam', 'encounter', 'debate', 'sky'][i % 6],
      active: i === seed % 60,
    })),
    log: [],
  };
  return {
    state,
    roll() {
      const step = 1 + Math.floor(Math.random() * 6);
      state.pos = (state.pos + step) % 60;
      state.round += 1;
      state.lap = Math.floor(state.round / 30) + 1;
      state.inspiration = Math.max(0, state.inspiration - 1);
      state.tiles.forEach((t) => {
        t.active = t.index === state.pos;
      });
      state.phase = 'resolving';
      return step;
    },
  };
}

// 把引擎状态投影成渲染所需的最小数据
// 原则：字段名与 WXML 一一对应，不包含任何中间计算量或函数引用
function project(state) {
  return {
    round: state.round,
    lap: state.lap,
    pos: state.pos,
    inspiration: state.inspiration,
    phase: state.phase,
    attrs: ATTR_ORDER.map((key) => ({
      key,
      label: ATTR_LABEL[key],
      value: state.attrs[key],
    })),
    tiles: state.tiles.map((t) => ({
      i: t.index,
      k: t.kind,
      a: t.active ? 1 : 0,
    })),
  };
}

function createEngine(options) {
  if (MODE === 'engine') {
    // 移植完成后在此实例化真实引擎：
    // const { createGame } = require('../engine/game');
    // return createGame(options);
    throw new Error('引擎尚未接入，请先将 MODE 切回 mock 或完成 engine 移植');
  }
  return mockEngine((options && options.seed) || 0);
}

module.exports = { createEngine, project, MODE };
