// 定义全局变量存储被注册的副作用函数
let activeEffect
// 定义副作用函数栈
const effectStack = []
// 定义任务队列
const jobQueue = new Set()
// 微任务实例
const p = Promise.resolve()
// 定义队列刷新标志
let isFlushing = false
// effect 用于注册副作用函数
function effect(fn, options = {}) {
  const effectFn = () => {
    // 清除之前集合依赖中的函数
    cleanup(effectFn)
    // 指向同一地址
    activeEffect = effectFn
    effectStack.push(effectFn)
    // 存储fn 执行的结果
    const res = fn()
    // 实现可嵌套
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]
    // 将 fn 函数的执行结果作为effectFn 函数的返回值
    return res
  }
  effectFn.deps = []
  effectFn.options = options
  if(!options.lazy) {
    effectFn()
  }
  return effectFn
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
  activeEffect && activeEffect.deps.push(deps)
}

// 触发副作用函数
const trigger = (target, key) => {
  const depsMap = bucket.get(target)
  if (!depsMap) return
  // 根据key值获取对应副作用函数桶
  const effects = depsMap.get(key)
  // 嵌套一层相当于拷贝，在修改effects 时不会影响 effectToRun的遍历，从而不会导致死循环
  const effectToRun = new Set()
  effects && effects.forEach(effectFn => {
    if (effectFn !== activeEffect) {
      effectToRun.add(effectFn)
    }
  })
  effectToRun.forEach(fn => {
    if (fn.options.scheduler) {
      fn.options.scheduler(fn)
    } else {
      fn()
    }
  })
}
// 原始数据
const data = {foo: 1, bar: 1}
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

// 刷新任务队列多次调用flushJob也只会执行一次
function flushJob() {
  if (isFlushing) return
  isFlushing = true
  p.then(() => {
    jobQueue.forEach(job => job())
  }).finally(() => {
    isFlushing = false
  })
}
// 计算属性
function computed(getter) {
  // 缓存value值
  let value
  // 是否需要重新计算标识
  let dirty = true
  const effectFn = effect(getter, {
    lazy: true,
    scheduler(){
      if (!dirty) {
        dirty = true
        trigger(obj, 'value')
      }
    }
  })

  const obj = {
    get value() {
      // 最开始的时候进行计算
      if (dirty) {
        value = effectFn()
        // 计算完毕设置dirty值
        dirty = false
      }
      track(obj, "value")
      return value
    }
  }
  return obj
}

const val = computed(() => obj.foo + obj.bar)

effect(() => {
  console.log("val", val.value)
})

obj.foo++

console.log(val.value)

