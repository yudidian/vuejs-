// 定义全局变量存储被注册的副作用函数
import {traverse} from "./utils.js";
import {TriggerType} from "./types.js";

let activeEffect
const  MAP_KEY_ITERATE_KEY = Symbol()
// 默认表示允许追踪
let shouldTrack = true

// 定义副作用函数栈
const effectStack = []

// 存储原始对象代理对象的集合
const reactiveMap = new Map()

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
  // 不允许追踪时直接返回
  if (!shouldTrack) {
    return
  }
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
const trigger = (target, key, type, newVal) => {
  const depsMap = bucket.get(target)
  if (!depsMap) return
  // 根据key值获取对应副作用函数桶
  const effects = depsMap.get(key)
  // 获取ITERATE_KEY 值的副作用函数桶
  const iterateEffects = depsMap.get(ITERATE_KEY)
  // 嵌套一层相当于拷贝，在修改effects 时不会影响 effectToRun的遍历，从而不会导致死循环
  const effectToRun = new Set()
  effects && effects.forEach(effectFn => {
    if (effectFn !== activeEffect) {
      effectToRun.add(effectFn)
    }
  })
  // 当操作为ADD 并且 target 为数组时 取出相关副作用函数 添加到effectToRun中
  if (type === TriggerType.ADD && Array.isArray(target)) {
    // 取出以length 相关的副作用函数
    const lengthEffects = depsMap.get("length")
    lengthEffects && lengthEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectToRun.add(effectFn)
      }
    })
  }
  // 操作目标是数组切修改了数组的length 属性
  if (Array.isArray(target) && key === "length") {
    depsMap.forEach((effects, key) => {
      if (key >= newVal) {
        effects.forEach(effectFn => {
          if (effectFn !== activeEffect) {
            effectToRun.add(effectFn)
          }
        })
      }
    })
  }
  // 只有类型为 add 或 delete 时才会执行ITERATE_KEY对应的副作用函数
  if (type === TriggerType.ADD || type === TriggerType.DELETE || (Object.prototype.toString.call(target) === "[object Map]") && type === 'SET') {
    iterateEffects && iterateEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectToRun.add(effectFn)
      }
    })
  }
  // 执行与key相关的副作用函数
  if ((type === TriggerType.ADD || type === TriggerType.DELETE) && (Object.prototype.toString.call(target) === "[object Map]")) {
    const iterateEffects = depsMap.get(MAP_KEY_ITERATE_KEY)
    iterateEffects && iterateEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectToRun.add(effectFn)
      }
    })
  }
  effectToRun.forEach(fn => {
    if (fn.options.scheduler) {
      fn.options.scheduler(fn)
    } else {
      fn()
    }
  })
}
//创建for in 时唯一key值
const ITERATE_KEY = Symbol()

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
  if (options.immediate) {
    job()
  } else {
    oldValue = {...effectFn()}
  }
}

const mutableInstrumentations = {
  add(key) {
    // 原始对象
    const target = this.raw
    const hadKey = target.has(key)
    const res = target.add(key)
    // 添加的值是原始值中不存在的，才需要去触发副作用函数
    if (!hadKey) {
      trigger(target, key, 'ADD')
    }
    return res
  },
  delete(key) {
    // 原始对象
    const target = this.raw
    const hadKey = target.has(key)
    const res = target.delete(key)
    // 删除值是原始值中存在的，才需要去触发副作用函数
    if (hadKey) {
      trigger(target, key, 'ADD')
    }
    return res
  },
  get(key) {
    const target = this.raw
    const had = target.has(key)
    track(target, key)
    if (had) {
      const res = target.get(key)
      return typeof res === 'object' ? reactive(res) : res
    }
  },
  set(key, value) {
    const target = this.raw
    const had = target.has(key)
    const oldValue = target.get(key)
    // 避免数据污染
    const rawValue = value.raw || value
    target.set(key, rawValue)
    // 值不存在则是新增操作
    if (!had) {
      trigger(target, key, 'ADD')
    } else if (oldValue !== value || (oldValue === oldValue && value === value)) {
      trigger(target, key, 'SET')
    }
  },
  forEach(callback, thisArg) {
    const target = this.raw
    const wrap = (val) => {
      return typeof val === 'object' ? reactive(val) : val
    }
    track(target, ITERATE_KEY)
    target.forEach((v, k) => {
      callback.call(thisArg, wrap(v), wrap(k), this)
    })
  },
  [Symbol.iterator]: iterationMethod("iterator"),
  // Symbol.iterator === entries 为true 所以两者公用一个方法
  entries: iterationMethod("entries"),
  values: iterationMethod("values"),
  keys: iterationMethod("keys")
}

function iterationMethod(type) {
  return function () {
    const target = this.raw
    const warp = (val) => {
      return typeof val === 'object' ? reactive(val) : val
    }
    switch (type) {
      case "iterator": {
        // 调用track建立联系
        track(target, ITERATE_KEY)
        const itr = target[Symbol.iterator]()
        return {
          next() {
            const {value, done} = itr.next()
            return {
              value: value ? [warp(value[0]), warp(value[1])] : value,
              done: done
            }
          },
          [Symbol.iterator]() {
            return this
          }
        }
      }
      case "entries": {
        // 调用track建立联系
        track(target, ITERATE_KEY)
        const itr = target[Symbol.iterator]()
        return {
          next() {
            const {value, done} = itr.next()
            return {
              value: value ? [warp(value[0]), warp(value[1])] : value,
              done: done
            }
          },
          [Symbol.iterator]() {
            return this
          }
        }
      }
      case "values": {
        // 调用track建立联系
        track(target, ITERATE_KEY)
        const itr = target.values()
        return {
          next() {
            const {value, done} = itr.next()
            return {
              value: warp(value),
              done: done
            }
          },
          [Symbol.iterator]() {
            return this
          }
        }
      }
      case "keys": {
        // 调用track建立联系
        track(target, MAP_KEY_ITERATE_KEY)
        const itr = target.keys()
        return {
          next() {
            const {value, done} = itr.next()
            return {
              value: warp(value),
              done: done
            }
          },
          [Symbol.iterator]() {
            return this
          }
        }
      }
    }
  }
}

function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      if (key === 'raw') {
        return target
      }
      if (key === 'size') {
        track(target, ITERATE_KEY)
        return Reflect.get(target, key, target)
      }

      return mutableInstrumentations[key]
    }
  })
}

function reactive(obj) {
  // 如果映射中存在着obj 对应的Proxy函数优先使用
  const existsProxy = reactiveMap.get(obj)
  if (existsProxy) {
    return existsProxy
  }
  // 没有则从新创建
  const proxy = createReactive(obj)
  reactiveMap.set(obj, proxy)
  return proxy
}

function shallowReactive(obj) {
  return createReactive(obj, true)
}

function readonly(obj) {
  return createReactive(obj, false, true)
}

// // 原始 Map 对象 m
// const m = new Map()
// // p1 是 m 的代理对象
// const p1 = reactive(m)
// // p2 是另外一个代理对象
// const p2 = reactive(new Map())
// // 为 p1 设置一个键值对，值是代理对象 p2
// p1.set('p2', p2)
//
// effect(() => {
//   // 注意，这里我们通过原始数据 m 访问 p2
//   console.log(m.get('p2').size)
//   })
// // 注意，这里我们通过原始数据 m 为 p2 设置一个键值对 foo --> 1
// m.get('p2').set('foo', 1)
// const m = reactive(new Map([[{key:1},{val: 1}]]))
// effect(() => {
//   m.forEach((value, key, map) => {
//     console.log(value)
//     console.log(key)
//   })
// })
// m.set({key: 2}, {value: 2})


// const key = {key: 1}
// const value = new Set([1, 2, 3])
// const p = reactive(new Map([
//   [key, value]
// ]))
//
// effect(() => {
//   p.forEach(function (value, key) {
//     console.log(value.size) // 3
//   })
// })
//
// p.get(key).delete(1)

// const p = reactive(new Map([
//   ['key1', 'value1'],
//   ['key2', 'value2']
// ]))
//
// effect(() => {
//   // TypeError: p is not iterable
//   for (const [key, value] of p.entries()) {
//     console.log(key, value)
//   }
// })
//
// p.set('key3', 'value3')

const p = reactive(new Map([
  ['key1', 'value1'],
  ['key2', 'value2']
]))

effect(() => {
  for (const value of p.keys()) {
    console.log(value) // key1 key2
  }
})

p.set('key2', 'value3')
p.set('key3', 'value3')
