const vueReactivity = VueReactivity;

const {effect, ref} = vueReactivity

function renderer(domString, container) {
  container.innerHTML = domString
}

// n1 旧vnode， n2 新vnode container 容器
function patch(n1, n2, container) {

}

function createRenderer() {
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


