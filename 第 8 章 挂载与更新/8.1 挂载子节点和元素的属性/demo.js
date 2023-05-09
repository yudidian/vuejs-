const vueReactivity = VueReactivity;

const {effect, ref} = vueReactivity


function createRenderer() {
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
    // 创建DOM
    const el = createElement(vnode.type)
    // props 节点属性存在则对应遍历添加
    if (vnode.props) {
      for (const key in vnode.props) {
        el.setAttribute(key, vnode.props[key])
      }
    }
    // 判断节点类型
    if(typeof vnode.children === "string") {
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
    //第一次渲染时n1为undefined
    if (!n1) {
      mountElement(n2, container)
    }
  }
  function render(vnode, container) {
    if (vnode) {
      // vnode 存在则 和之前vnode比较
      patch(container._vnode, vnode, container)
    } else {
      // vnode 不存在而之前有旧vnode说明是卸载操作
      if (container._vnode) {
        container.innerHTML = ""
      }
    }
    container._vnode = vnode
  }
  return {
    render
  }
}

const renderer = createRenderer()
const vnode = {
  type: "div",
  // props 描述元素属性
  props: {
    id: "foo"
  },
  children: [
    {
      type: "p",
      children: "count"
    }
  ]
}
renderer.render(vnode, document.querySelector("#app"))
