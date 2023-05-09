const vueReactivity = VueReactivity;

const {effect, ref} = vueReactivity
// 文本 type
const Text = Symbol()
// 注释 Type
const Comment = Symbol()
// 片段类型
const Fragment = Symbol()

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


function createRenderer() {
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
        //diff 算法
        n1.children.forEach(item => unmount(item))
        n2.children.forEach(item => patch(null, item, container))
        const oldChildren = n1.children
        const newChildren = n2.children
        for (let i = 0; i < oldChildren.length; i++) {
          patch(oldChildren[i], newChildren[i], container)
        }
      } else {
        // 旧节点要么为文本要么不存在
        setElementText(container, "")
        n2.children.forEach(item => patch(null, item, container))
      }
    } else {
      // 最后新节点不存在时情况
      // 旧节点为文本则清空
      if (typeof n1.children === "string") {
        setElementText(el, "")
      } else if (Array.isArray(n1.children)) {
        // 旧节点为数组则逐一卸载
        n1.children.forEach(item => unmount(item))
      }
    }
  }

  function patchElement(n1, n2) {
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

  function mountElement(vnode, container) {
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
        patch(null, child, el)
      })
    }
    insert(el, container)
  }

  // n1 旧vnode， n2 新vnode container 容器
  function patch(n1, n2, container) {
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
        mountElement(n2, container)
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
const bol = ref(false)
effect(() => {
  // 创建 vnode
  const vnode = {
    type: 'div',
    props: bol.value ? {
      onClick: () => {
        alert('父元素 clicked')
      }
    } : {},
    children: [
      {
        type: 'p',
        props: {
          onClick: () => {
            bol.value = true
          }
        },
        children: 'text'
      }
    ]
  }
  // 渲染 vnode
  renderer.render(vnode, document.querySelector('#app'))
})

