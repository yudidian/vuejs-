const vueReactivity = VueReactivity;

const {effect, ref} = vueReactivity

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
  // 将属性相关操作进行封装
  function patchProps(el, key, preValue, nextValue) {
    // 获取 dom properties 值类型
    const type = typeof el[key]
    if (key === "class") {
      el.className = nextValue || ""
    }else if (shouldSetAsProps(el, key, nextValue)) {
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
    const { type } = n2
    // string 类型描述的是普通标签
    if (typeof type === 'string') {
      //第一次渲染时n1为undefined
      if (!n1) {
        mountElement(n2, container)
      } else {
        // 更新操作
      }
    } else if (typeof type === 'object') {
      // 对象类型描述的是组件
    } else if (typeof type === "boolean") {
      // 其他类型
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
const vnode = {
  type: "button",
  // props 描述元素属性
  props: {
    id: "foo",
    disabled: false,
    class: normalizeClass([
      'foo bar',
      {baz: true}
    ])
  },
  children: "count"
}
renderer.render(vnode, document.querySelector("#app"))
