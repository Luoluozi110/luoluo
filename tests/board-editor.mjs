import { applyProjectOverride } from '../js/engine/config.js';

const base = {
  affinity: {},
  talents: [],
  board: {
    laps: 2,
    sides: [{ id: 'xiangshi', name: '乡试路', range: [0, 19], season: 'spring' }],
    mainRing: [
      { id: 0, type: 'start', name: '童生铺' },
      { id: 1, type: 'ping', name: '蒙学巷' }
    ]
  }
};

const project = {
  board: {
    laps: 3,
    sides: [{ id: 'xiangshi', name: '乡试新路', range: [0, 19], season: 'spring' }],
    mainRing: [
      { id: 0, type: 'start', name: '童生铺', icon: 'sky', effect: { inspiration: 2, talent: 'T001' } },
      { id: 1, type: 'ping', name: '蒙学巷', effect: { attrs: { shi: 3 } } },
      { id: 2, type: 'quiz', name: '新格' }
    ]
  }
};

const next = applyProjectOverride(base, project);
const ring = next.board.mainRing;
console.assert(next.board.laps === 3, 'laps override');
console.assert(ring[0].icon === 'sky', 'icon preserved');
console.assert(ring[0].effect.inspiration === 2, 'effect inspiration');
console.assert(ring[0].effect.talent === 'T001', 'effect talent');
console.assert(ring[1].effect.attrs.shi === 3, 'effect attr');
console.assert(ring.find(c => c.id === 2).name === '新格', 'new cell');
console.assert(next.board.cellById.get(0).icon === 'sky', 'normalize keeps icon');
console.assert(next.board.cellById.get(1).effect.attrs.shi === 3, 'normalize keeps effect');
console.log('board override tests passed');
