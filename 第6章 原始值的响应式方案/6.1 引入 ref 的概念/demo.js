// 定义全局变量存储被注册的副作用函数
import {traverse, send} from "./utils.js";
import {TriggerType} from "./types.js";

let activeEffect

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
  if (type === TriggerType.ADD || type === TriggerType.DELETE) {
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

const arrayInstrumentations = {};
// 重写 数组中根据 值 查找的方法
['includes', 'indexOf', 'lastIndexOf'].forEach(item => {
  const originMethod = Array.prototype[item]
  arrayInstrumentations[item] = function (...arg) {
    // 先在代理对象上查找
    let res = originMethod.apply(this, arg)
    // 代理对象上查找为false 或者为-1
    if (!res || res === -1) {
      // 通过 this.raw 获取原始对象、在原始对象上查找
      res = originMethod.apply(this.raw, arg)
    }
    return res
  }
})
;['push', 'pop', 'shift', 'unshift', 'splice'].forEach(item => {
  const originMethod = Array.prototype[item]
  arrayInstrumentations[item] = function (...arg) {
    shouldTrack = false
    let res = originMethod.apply(this, arg)
    shouldTrack = true
    return res
  }
})

function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      if (key === "raw") {
        return target
      }
      // 如果类型是数组，并且访问的属性是 arrayInstrumentation's 上的则放回自己重写的方法
      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver)
      }
      // 不是只读属性才建立响应联系且键值不是symbol 类型的
      if (!isReadonly && typeof key !== "symbol") {
        track(target, key)
      }
      if (isShallow) {
        return res
      }
      const res = Reflect.get(target, key, receiver)
      if (typeof res === "object" && res !== null) {
        // 深只读的实现
        return isReadonly ? readonly(res) : reactive(res)
      }
      return res
    },
    set(target, key, newVal, receiver) {
      if (isReadonly) {
        console.warn(`属性${key}为只读属性`)
        return true
      }
      // 获取旧值
      const oldValue = target[key]
      // 获取是添加新值还是修改原有值type
      const type = Array.isArray(target)
          ? Number(key) < target.length ? TriggerType.SET : TriggerType.ADD
          : Object.prototype.hasOwnProperty.call(target, key) ? TriggerType.SET : TriggerType.ADD
      // 设置属性值
      const res = Reflect.set(target, key, newVal, receiver)
      // 当前receiver，是不是target 的代理对象
      if (target === receiver.raw) {
        // 执行key对应副作用函数并且新老值不相同，才触发更新
        if (oldValue !== newVal && (oldValue === oldValue || newVal === newVal)) {
          // 第四个参数，触发响应的新值
          trigger(target, key, type, newVal)
        }
      }
      return res
    },
    has(target, p) {
      track(target, p)
      return Reflect.has(target, p)
    },
    deleteProperty(target, p) {
      // 如果是只读属性则不允许删除
      if (isReadonly) {
        console.warn(`属性${p}为只读属性`)
        return true
      }
      // 检查删除属性是否是target身上的属性
      const hadKey = Object.prototype.hasOwnProperty.call(target, p)
      const res = Reflect.deleteProperty(target, p)
      // 只有删除成功且是target身上的属性时才触发更新
      if (res && hadKey) {
        trigger(target, p, TriggerType.DELETE)
      }
      return res
    },
    ownKeys(target) {
      // target 如果是数组则使用 length 作为响应联系字段
      const type = Array.isArray(target) ? "length" : ITERATE_KEY
      track(target, type)
      return Reflect.ownKeys(target)
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

// 引入ref
function ref(val) {
  const wrapper = {
    value: val
  }
  // 区别对象是由ref 或 reactive 创建
  Object.defineProperty(wrapper, "__v__isRef", {
    value: true,
    writable: false, // 不可写
    enumerable: false // 不可枚举
  })
  return reactive(wrapper)
}

// 创建原始值的响应式数据
const refVal = ref(1)

effect(() => {
  // 在副作用函数内通过 value 属性读取原始值
  console.log(refVal.value)
})
// 修改值能够触发副作用函数重新执行
refVal.value = 2
