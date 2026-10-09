// 云数据库的内存替身 + 云函数加载器
//
// 云函数是 CommonJS，且依赖 wx-server-sdk（真机才有）。这里用内存实现替身，
// 再拦截 require('wx-server-sdk')，就能在本地把云函数当成普通函数跑起来。
//
// 支持的命令：gt / in / inc / max —— 只覆盖本项目云函数实际用到的部分，
// 刻意不追求完整语义，避免替身比被测代码还复杂。

export function createMockCloud() {
  const collections = new Map();

  // 与真实云开发一致：集合不存在时抛 -502005，而不是静默返回空。
  // 这样云函数里的「补建集合再重试」逻辑才真的会被走到。
  const getColl = (name) => {
    if (!collections.has(name)) {
      throw Object.assign(new Error(`database collection not exists: ${name}`), { errCode: -502005 });
    }
    return collections.get(name);
  };

  let autoId = 1;
  const nextId = () => 'id_' + autoId++;

  const cmd = {
    gt: (v) => ({ __cmd: 'gt', v }),
    in: (v) => ({ __cmd: 'in', v }),
    inc: (v) => ({ __cmd: 'inc', v }),
    max: (v) => ({ __cmd: 'max', v }),
  };

  function matches(doc, where) {
    for (const key of Object.keys(where || {})) {
      const cond = where[key];
      const val = doc[key];
      if (cond && cond.__cmd === 'gt') {
        if (!(Number(val) > Number(cond.v))) return false;
      } else if (cond && cond.__cmd === 'in') {
        if (!cond.v.includes(val)) return false;
      } else if (val !== cond) {
        return false;
      }
    }
    return true;
  }

  function applyUpdate(doc, data) {
    for (const key of Object.keys(data)) {
      const v = data[key];
      if (v && v.__cmd === 'inc') doc[key] = (Number(doc[key]) || 0) + Number(v.v);
      else if (v && v.__cmd === 'max') doc[key] = Math.max(...v.v.map(Number));
      else doc[key] = v;
    }
    return doc;
  }

  class Query {
    constructor(name) {
      this.name = name;
      this._where = null;
      this._order = null;
      this._skip = 0;
      this._limit = 100;
    }

    _clone() {
      const q = new Query(this.name);
      q._where = this._where;
      q._order = this._order;
      q._skip = this._skip;
      q._limit = this._limit;
      return q;
    }

    where(w) {
      const q = this._clone();
      q._where = w;
      return q;
    }

    orderBy(field, dir) {
      const q = this._clone();
      q._order = { field, dir };
      return q;
    }

    skip(n) {
      const q = this._clone();
      q._skip = Number(n) || 0;
      return q;
    }

    limit(n) {
      const q = this._clone();
      q._limit = Number(n) || 100;
      return q;
    }

    _rows() {
      let rows = getColl(this.name).filter((d) => matches(d, this._where));
      if (this._order) {
        const { field, dir } = this._order;
        rows = rows.slice().sort((a, b) => {
          const x = a[field];
          const y = b[field];
          if (x === y) return 0;
          const sign = x > y ? 1 : -1;
          return dir === 'desc' ? -sign : sign;
        });
      }
      return rows;
    }

    async get() {
      return { data: this._rows().slice(this._skip, this._skip + this._limit).map((d) => ({ ...d })) };
    }

    async count() {
      return { total: this._rows().length };
    }

    async add({ data }) {
      const doc = { _id: nextId(), ...data };
      // 命令对象不该原样落库
      for (const k of Object.keys(doc)) {
        if (doc[k] && doc[k].__cmd === 'inc') doc[k] = Number(doc[k].v) || 0;
      }
      getColl(this.name).push(doc);
      return { _id: doc._id };
    }

    doc(id) {
      return {
        get: async () => {
          const found = getColl(this.name).find((d) => d._id === id || d._id === String(id));
          if (!found) throw Object.assign(new Error('document does not exist'), { errCode: -502004 });
          return { data: { ...found } };
        },
        update: async ({ data }) => {
          const found = getColl(this.name).find((d) => d._id === id || d._id === String(id));
          if (!found) throw Object.assign(new Error('document does not exist'), { errCode: -502004 });
          applyUpdate(found, data);
          return { stats: { updated: 1 } };
        },
        set: async ({ data }) => {
          const store = getColl(this.name);
          const idx = store.findIndex((d) => d._id === id || d._id === String(id));
          if (idx >= 0) {
            applyUpdate(store[idx], data);
          } else {
            const doc = { _id: id };
            applyUpdate(doc, data);
            store.push(doc);
          }
          return { stats: { updated: 1 } };
        },
      };
    }
  }

  const db = {
    collection: (name) => new Query(name),
    command: cmd,
    createCollection: async (name) => {
      if (collections.has(name)) {
        throw Object.assign(new Error('collection already exists'), { errCode: -502002 });
      }
      collections.set(name, []);
      return { ok: true };
    },
  };

  let currentOpenid = 'openid_test_user';

  const mockSdk = {
    DYNAMIC_CURRENT_ENV: 'mock-env',
    init: () => {},
    database: () => db,
    getWXContext: () => ({ OPENID: currentOpenid }),
    __db: db,
    __collections: collections,
    __setOpenid: (id) => {
      currentOpenid = id;
    },
  };

  return mockSdk;
}

/** 在拦截 require 之前调用；返回加载单个云函数的函数 */
export async function loadCloudFunction(mockSdk, relPath) {
  const { createRequire } = await import('node:module');
  const Module = (await import('node:module')).default;

  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'wx-server-sdk') return mockSdk;
    return origLoad.apply(this, arguments);
  };

  const req = createRequire(import.meta.url);
  try {
    return req(relPath);
  } finally {
    Module._load = origLoad;
  }
}
