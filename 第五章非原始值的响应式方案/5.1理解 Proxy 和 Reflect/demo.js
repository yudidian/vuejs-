// 定义全局变量存储被注册的副作用函数
import {traverse, send} from "./utils.js";

let activeEffect

// 定义副作用函数栈
const effectStack = []


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
  if (!options.lazy) {
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
const data = {
  foo: 1,
  get bar() {
    return this.foo
  }
}
// 对原始数据进行数据劫持
const obj = new Proxy(data, {
  get(target, key, receiver) {
    // 副作用函数没有被注册
    if (!activeEffect) {
      return target[key]
    }
    track(target, key)
    return Reflect.get(target, key, receiver)
  },
  set(target, key, newVal, receiver) {
    target[key] = newVal
    // 根据target值获取对应map集合
    trigger(target, key)
    return true
  }
})

// 计算属性
function computed(getter) {
  // 缓存value值
  let value
  // 是否需要重新计算标识
  let dirty = true
  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
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

// watch 属性
function watch(source, cb, options = {immediate: false}) {
  // 存储监视源
  let getter
  // 存储新旧值
  let oldValue, newValue
  // 存储过期回调
  let cleanup
  // 定义 onInvalidate 函数
  function onInvalidate(fn) {
    cleanup = fn
  }
  if (typeof source === 'function') {
    getter = source
  } else {
    getter = () => traverse(source)
  }

  // 将scheduler 函数进行封装
  const job = () => {
    newValue = effectFn()
    // 调用回调函数之前清除之前副作用
    if (cleanup) {
      cleanup()
    }
    cb(newValue, oldValue, onInvalidate)
    oldValue = {...newValue}
  }
  const effectFn = effect(() => getter(),
      {
        lazy: true,
        scheduler: () => {
          if (options.flush === "post") {
            const p = Promise.resolve()
            p.then(job)
          } else {
            job()
          }
        }
      })
  if (options.immediate){
    job()
  } else {
    oldValue = {...effectFn()}
  }
}

effect(() => {
  console.log(obj.bar)
})

obj.foo++
