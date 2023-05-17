const vueReactivity = VueReactivity;

const {effect, ref, reactive, shallowReactive, shallowReadonly} = vueReactivity
// 文本 type
const Text = Symbol()
// 注释 Type
const Comment = Symbol()
// 片段类型
const Fragment = Symbol()
// 定义任务缓存队列
const queue = new Set()
// 定义刷新标志
let isFlushing = false
// 立即 resolve promise 实例
const p = Promise.resolve()

// 调度器函数
function queueJob(job) {
  queue.add(job)
  if (!isFlushing) {
    isFlushing = true
    p.then(() => {
      try {
        queue.forEach(job => job())
      } catch (e) {
        console.error(e)
      } finally {
        isFlushing = false
        queue.clear()
      }
    })
  }
}

// 格式化 class 属性
function normalizeClass(value) {
  if (typeof value === 'string') {
    return value
  } else if (Array.isArray(value)) {
    let res = ''
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeClass(value[i])
      if (normalized) {
        res += `${normalized} `
      }
    }
    return res.slice(0, -1)
  } else if (Object.prototype.toString.call(value) === "[object Object]") {
    let res = ''
    for (const name in value) {
      if (value[name]) {
        res += `${name} `
      }
    }
    return res.slice(0, -1)
  } else {
    return ''
  }
}

function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);

    if (arr[mid] < target) {
      left = mid + 1;
    } else if (arr[mid] > target) {
      right = mid - 1;
    } else {
      return mid;
    }
  }

  return left;
}

function findLIS(nums) {
  const n = nums.length;
  const dp = new Array(n);
  const lis = [];

  for (let i = 0; i < n; i++) {
    const num = nums[i];
    const index = binarySearch(lis, num);

    dp[i] = index;
    if (index === lis.length) {
      lis.push(num);
    } else {
      lis[index] = num;
    }
  }

  const maxLength = lis.length;
  const result = [];
  let currentIndex = maxLength - 1;

  for (let i = n - 1; i >= 0; i--) {
    if (dp[i] === currentIndex) {
      result.unshift(i);
      currentIndex--;
    }
  }

  return result;
}

function createRenderer() {
  function hasPropsChanged(preProps, nextProps) {
    const nextKeys = Object.keys(nextProps)
    if (nextKeys.length !== Object.keys(preProps).length) {
      return true
    }
    for (const key in nextProps) {
      if (preProps[key] !== nextKeys[key]) {
        return true
      }
    }
    return false
  }

  // 遍历组件传递的props
  function resolveProps(options, propsData) {
    // options  render函数中的props vnode.type.props
    // propsData 是vnode.props定义的，一般是数据类型
    const props = {}
    const attrs = {}
    for (const key in propsData) {
      // 正常定义的 <Count title="xxx">
      if (key in options) {
        props[key] = propsData[key]
      } else {
        attrs[key] = propsData[key]
      }
    }
    return [props, attrs]
  }

  // 组件补丁
  function patchComponent(n1, n2, anchor) {
    //  新组件的component 指向旧组件的component
    const instance = (n2.component = n1.component)
    // 获取当前props
    const {props} = instance
    if (hasPropsChanged(n1.props, n2.props)) {
      const [nextProps] = resolveProps(n2.type.props, n2.props)
      // 更新原props
      for (const key in nextProps) {
        props[key] = nextProps[key]
      }

      // 删除不在nextProps中的值
      for (const key in props) {
        if (!(key in nextProps)) {
          delete props[key]
        }
      }
    }
  }

  // 组件挂载
  function mountComponent(vnode, container, anchor) {
    const componentOptions = vnode.type
    let {
      render,
      data,
      beforeCreate,
      created,
      beforeMount,
      mounted,
      beforeUpdate,
      updated,
      props: propsOptions,
      setup
    } = componentOptions
    // 挂载之前函数执行
    beforeCreate && beforeCreate()
    // 包装data为响应式数据
    const state = data ? reactive(data()) : null
    const [props, attrs] = resolveProps(propsOptions, vnode.props)
    // 定义组件自身状态数据
    const instance = {
      state, // 组件自身状态
      props: shallowReactive(props),
      isMounted: false, // 是否被挂载
      subTree: null // 渲染内容
    }
    const setupContext = {
      attrs
    }
    const setupResult = setup(shallowReadonly(instance.props), setupContext)
    // setupState 存储setup返回结果
    let setupState = null
    if (typeof setupResult === 'function') {
      if (render) {
        console.error('setup 函数返回渲染函数，render 选项将被忽略')
      }
      // 将setupResult 作为渲染函数
      render = setupResult
    } else {
      // 返回是对象
      setupState = setupResult
    }
    vnode.component = instance
    // 创建上下文对象
    const renderContext = new Proxy(instance, {
      // 获取state 或者props 值
      get(target, p, receiver) {
        const {state, props} = target
        if (state && key in state) {
          return state[key]
        } else if (props && key in props) {
          return props[key]
        } else if (setupState && p in setupState) {
          return setupState[p]
        } else {
          console.error("not find")
        }
      },
      set(target, p, value, receiver) {
        const {state, props} = target
        if (state && p in state) {
          state[p] = value
        } else if (props && p in props) {
          console.warn(`Attempting to mutate prop "${p}". Props are readonly.`)
        } else if (setupState && p in setupState) {
          setupState[p] = value
        } else {
          console.error("not exit")
        }
      }
    })
    // 响应式数据挂载完成
    created && created.call(renderContext)
    effect(() => {
      // 改变this 指向 使其在render 函数中能访问到state中的数据
      const subTree = render.call(state, state)
      // 检查组件是否被挂载
      if (!instance.isMounted) {
        // 挂载之前
        beforeMount && beforeMount()
        patch(null, subTree, container, anchor)
        // 下次执行时不会触发更新操作
        instance.isMounted = true
        // 挂载完成
        mounted && mounted()
      } else {
        // 更新之前
        beforeUpdate && beforeUpdate()
        patch(instance.subTree, subTree, container, anchor)
        // 更新之后
        updated && updated()
      }
      instance.subTree = subTree
    }, {
      scheduler: queueJob
    })
  }

  function patchKeyedChildren(n1, n2, container) {
    const oldChildren = n1.children
    const newChildren = n2.children
    // 指向新旧节点头部
    let j = 0

    let oldVNode = oldChildren[j]
    let newVNode = newChildren[j]
    while (oldVNode.key === newVNode.key) {
      patch(oldVNode, newVNode, container)
      j++
      oldVNode = oldChildren[j]
      newVNode = newChildren[j]
    }
    let oldEnd = oldChildren.length - 1
    let newEnd = newChildren.length - 1

    oldVNode = oldChildren[oldEnd]
    newVNode = newChildren[newEnd]
    while (oldVNode.key === newVNode.key) {
      patch(oldVNode, newVNode, container)
      oldEnd--
      newEnd--
      oldVNode = oldChildren[oldEnd]
      newVNode = newChildren[newEnd]
    }
    // 预处理结束
    if (oldEnd < j && newEnd >= j) {
      const anchorIndex = newEnd + 1
      const anchor = anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null
      while (j <= newEnd) {
        patch(null, newChildren[j++], container, anchor)
      }
    } else if (newEnd < j && oldEnd >= j) {
      while (j <= oldEnd) {
        unmount(oldChildren[j++])
      }
    } else {
      // 未处理的个数
      const count = newEnd - j + 1
      const source = new Array(count).fill(-1)
      const newStart = j
      const oldStart = j
      // 是否需要移动标识
      let moved = false
      let pos = 0
      // 构建索引表
      const keyIndex = {}
      for (let i = newStart; i <= newEnd; i++) {
        keyIndex[newChildren[i].key] = i
      }
      // 新增 patched 变量，代表更新过的节点数量
      let patched = 0
      // 旧节点遍历
      for (let i = oldStart; i < oldEnd; i++) {
        oldVNode = oldChildren[i]
        if (patched <= count) {
          const k = keyIndex[oldVNode.key]
          if (k !== undefined) {
            newVNode = newChildren[k]
            patch(oldVNode, newVNode, container)
            patched++
            source[k - newStart] = i
            if (k < pos) {
              moved = true
            } else {
              pos = k
            }
          } else {
            // 新节点在旧节点中找不到对应的key，则卸载旧节点
            unmount(oldVNode)
          }
        } else {
          unmount(oldVNode)
        }
      }
      //移动DOM
      if (moved) {
        // 计算最长递增子序列,返回是索引值
        const seq = findLIS(source)
        // s指向最长递增子序列最后一个元素
        let s = seq.length - 1
        // i 指向新节点的最后一个子元素
        let i = count - 1
        for (i; i >= 0; i--) {
          // 新节点需要挂载
          if (source[i] === -1) {
            // 节点在newChildren 中的真实位置
            const pos = i + newStart
            const newVNode = newChildren[pos]
            // 下一个节点位置
            const nextPos = pos + 1
            // 定义锚点
            const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null
            patch(null, newVNode, container, anchor)
          } else if (i !== seq[s]) {
            // 节点需要移动
            // 节点在newChildren 中的真实位置
            const pos = i + newStart
            const newVNode = newChildren[pos]
            // 下一个节点位置
            const nextPos = pos + 1
            // 定义锚点
            const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null
            insert(newVNode.el, container, anchor)
          } else {
            s--
          }
        }
      }
    }
  }

  function patchChildren(n1, n2, container) {
    // 新子节点为 普通文本时
    if (typeof n2.children === "string") {
      // 节点只有为数组的时候才需要有卸载操作
      if (Array.isArray(n1.children)) {
        n1.children.forEach(item => unmount(item))
      }
      setElementText(container, n2.children)
    } else if (Array.isArray(n2.children)) {
      // n1 ,n2 子节点都为数组
      if (Array.isArray(n1.children)) {
        // 简单 diff 算法
        // 双端 diff 算法
        // 快速 diff 算法
        patchKeyedChildren(n1, n2, container)
      } else {
        // 旧节点要么为文本要么不存在
        setElementText(container, "")
        n2.children.forEach(item => patch(null, item, container))
      }
    } else {
      // 最后新节点不存在时情况
      // 旧节点为文本则清空
      if (typeof n1.children === "string") {
        setElementText(n1.el, "")
      } else if (Array.isArray(n1.children)) {
        // 旧节点为数组则逐一卸载
        n1.children.forEach(item => unmount(item))
      }
    }
  }

  function patchElement(n1, n2) {
    // 新的vnode 也引用之前的真实DOM
    const el = n2.el = n1.el
    const oldProps = n1.props
    const newProps = n2.props
    // 更新oldProps
    for (const key in newProps) {
      if (newProps[key] !== oldProps[key]) {
        patchProps(el, key, oldProps[key], newProps[key])
      }
    }
    // 移除之前的oldProps遗留下来的属性
    for (const key in oldProps) {
      if (!(key in newProps)) {
        patchProps(el, key, oldProps[key], null)
      }
    }
    // 更新children
    patchChildren(n1, n2, el)
  }

  // 将属性相关操作进行封装
  function patchProps(el, key, preValue, nextValue) {
    // 获取 dom properties 值类型
    const type = typeof el[key]
    if (/^on/.test(key)) {
      // invoker 存储时间缓存更新时不必移除事件，直接更新Invoker 中对应的时间
      // __vei 应为对象，事件名作为key，就不会出现事件覆盖情况
      const invokers = el.__vei || (el.__vei = {})
      const name = key.slice(2).toLowerCase()
      let invoker = invokers[name]
      if (nextValue) {
        if (!invoker) {
          invoker = el.__vei[name] = (e) => {
            if (e.timeStamp < invoker.attacked) return
            // 如歌 Invoker 是数组
            if (Array.isArray(invoker.value)) {
              invoker.value.forEach(fn => fn(e))
            } else {
              // 函数情况下直接执行
              invoker.value(e)
            }
          }
          // 真正事件函数绑定到 invoker.value 上
          invoker.value = nextValue
          invoker.attacked = performance.now()
          el.addEventListener(name, invoker)
        } else {
          // Invoker 存在更新操作
          invoker.value = nextValue
        }
      } else if (invoker) {
        el.removeEventListener(name, invoker)
      }
    } else if (key === "class") {
      el.className = nextValue || ""
    } else if (shouldSetAsProps(el, key, nextValue)) {
      if (type === 'boolean' && nextValue === "") {
        el[key] = true
      } else {
        el[key] = nextValue
      }
    } else {
      el.setAttribute(key, nextValue)
    }
  }

  // 判断 key 是否在 DOM properties 中
  function shouldSetAsProps(el, key, value) {
    // el.form 是只读的只能通过 setAttribute 设置
    if (key === 'form' && el.tagName === 'INPUT') {
      return false
    }
    return key in el
  }

  function createComment(text) {
    return document.createComment(text)
  }

  //创建文本节点
  function createTextNode(text) {
    return document.createTextNode(text)
  }

  // 设置文本节点内容
  function setText(el, text) {
    el.nodeValue = text
  }

  // 创建元素
  function createElement(tag) {
    return document.createElement(tag)
  }

  // 设置文本节点
  function setElementText(el, text) {
    el.textContent = text
  }

  // 指定parent下添加子元素
  function insert(el, parent, anchor = null) {
    parent.insertBefore(el, anchor)
  }

  function mountElement(vnode, container, anchor) {
    // 创建DOM  vnode.el 跟真实dom产生联系
    const el = vnode.el = createElement(vnode.type)
    // props 节点属性存在则对应遍历添加
    if (vnode.props) {
      for (const key in vnode.props) {
        patchProps(el, key, null, vnode.props[key])
      }
    }
    // 判断节点类型
    if (typeof vnode.children === "string") {
      // 文本节点
      setElementText(el, vnode.children)
    } else if (Array.isArray(vnode.children)) {
      vnode.children.forEach(child => {
        patch(null, child, el, anchor)
      })
    }
    insert(el, container, anchor)
  }

  // n1 旧vnode， n2 新vnode container 容器
  function patch(n1, n2, container, anchor = null) {
    // n1 存在 并且新旧vnode 节点类型不一致
    if (n1 && n1.type !== n2.type) {
      // 卸载之前旧节点查询渲染
      unmount(n1)
      n1 = null
    }
    const {type} = n2
    // string 类型描述的是普通标签
    if (typeof type === 'string') {
      //第一次渲染时n1为undefined
      if (!n1) {
        mountElement(n2, container, anchor)
      } else {
        // 更新操作
        patchElement(n1, n2)
      }
    } else if (type === Text) {
      if (!n1) {
        // 创建文本节点
        const el = n2.el = createTextNode(n2.children)
        insert(el, container)
      } else {
        const el = n2.el = n1.el
        if (n1.children !== n2.children) {
          setText(el, n2.children)
        }
      }
    } else if (type === Comment) {
      // 注释节点
      if (!n1) {
        const el = n2.el = createComment(n2.children)
        insert(el, container)
      } else {
        const el = n2.el = n1.el
        if (n1.children !== n2.children) {
          setText(el, n2.children)
        }
      }
    } else if (type === Fragment) {
      if (!n1) {
        n2.children.forEach(item => patch(null, n2, container))
      } else {
        patchChildren(n1, n2, container)
      }
    } else if (typeof type === "object") {
      if (!n1) {
        // 挂载组件
        mountComponent(n2, container, anchor)
      } else {
        // 组件打补丁
        patchComponent(n1, n2, container)
      }
    }
  }

  function render(vnode, container) {
    if (vnode) {
      // vnode 存在则 和之前vnode比较
      patch(container._vnode, vnode, container)
    } else {
      // vnode 不存在而之前有旧vnode说明是卸载操作
      if (container._vnode) {
        unmount(container._vnode)
      }
    }
    container._vnode = vnode
  }

  // 卸载操作
  function unmount(vnode) {
    // 如果是Fragment片段则需要递归卸载
    if (vnode.type === Fragment) {
      vnode.children.forEach(item => unmount(item))
    }
    // 获取之前的真实dom
    const el = vnode.el
    const parent = el.parentNode
    if (parent) {
      parent.removeChild(el)
    }
  }

  return {
    render
  }
}

const renderer = createRenderer()
const MyComponent = {
  name: 'MyComponent',
  // 用 data 函数来定义组件自身的状态
  data() {
    return {
      foo: 'hello world'
    }
  },
  render() {
    return {
      type: 'div',
      children: `foo 的值是: ${this.foo}` // 在渲染函数内使用组件状态
    }
  }
}
