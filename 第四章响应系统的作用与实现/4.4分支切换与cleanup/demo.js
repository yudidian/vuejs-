// 定义全局变量存储被注册的副作用函数
let activeEffect

// effect 用于注册副作用函数
function effect(fn) {
  const effectFn = () => {
    // 清除之前集合依赖中的函数
    cleanup(effectFn)
    activeEffect = effectFn
    fn()
  }
  effectFn.deps = []
  effectFn()
}
// 创建副作用函数容器
const bucket = new WeakMap()

// 移除之前的依赖集合
const cleanup = (effectFn) => {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i]
    deps.delete(effectFn)
  }
  effectFn.deps.length = 0
}
// 追踪函数
const track = (target, key) => {
  // 获取target 对应依赖的容器
  let depsMap = bucket.get(target)
  // 如果depsMap 不存在则创建，并装入 bucket 中
  if (!depsMap) {
    depsMap = new Map()
    bucket.set(target, depsMap)
  }
  // 从 depsMap 中获取 对应 key 值的容器
  let deps = depsMap.get(key)
  // 如果 deps不存在则 创建
  if (!deps) {
    deps = new Set()
    depsMap.set(key, deps)
  }
  // 最后对应key值的桶中添加副作用函数
  deps.add(activeEffect)
  activeEffect.deps.push(deps)
}

// 触发副作用函数
const trigger = (target, key) => {
  const depsMap = bucket.get(target)
  if (!depsMap) return
  // 根据key值获取对应副作用函数桶
  const effects = depsMap.get(key)
  // 嵌套一层相当于拷贝，在修改effects 时不会影响 effectToRun的遍历，从而不会导致死循环
  const effectToRun = new Set(effects)
  effectToRun.forEach(fn => fn())
}
// 原始数据
const data = {
  ok: true,
  text: "test"
}
// 对原始数据进行数据劫持
const obj = new Proxy(data, {
  get(target, key, receiver) {
    // 副作用函数没有被注册
    if (!activeEffect) {
      return target[key]
    }
    track(target, key)
    return target[key]
  },
  set(target, key, newVal, receiver) {
    target[key] = newVal
    // 根据target值获取对应map集合
    trigger(target, key)
  }
})

effect(() => {
  console.log("effect")
  document.title = obj.ok ? obj.text : "not"
})

setTimeout(() => {
  obj.ok = false
}, 2000)

setTimeout(() => {
  obj.text = "vue3"
}, 3000)
