// 配置加载器
// H5 版通过 fetch() 在运行时拉取 config/*.json；小程序没有 fetch，也不允许运行时读包内文件。
// 小程序支持 require 引入 JSON 文件（工具会解析为对象），因此改为静态引入 + 注册表模式。
//
// 关键约束：主包不能 require 分包内的文件，所以分包必须在自己的入口处 register 它携带的配置。

const registry = Object.create(null);
const listeners = Object.create(null);

function register(name, data) {
  if (!name) return;
  registry[name] = data;
  if (listeners[name]) {
    listeners[name].forEach((fn) => fn(data));
    delete listeners[name];
  }
}

function registerMany(map) {
  Object.keys(map || {}).forEach((key) => register(key, map[key]));
}

function get(name) {
  return registry[name];
}

// 分包配置是异步到达的，引擎若在其加载前读取，用 onReady 等它
function onReady(name, fn) {
  if (registry[name]) {
    fn(registry[name]);
    return;
  }
  (listeners[name] || (listeners[name] = [])).push(fn);
}

function has(name) {
  return Object.prototype.hasOwnProperty.call(registry, name);
}

module.exports = { register, registerMany, get, onReady, has };
