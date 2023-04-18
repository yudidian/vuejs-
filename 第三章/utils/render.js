// const render = function (vnode, container) {
//   if (vnode.tag !== undefined) {
//     const el = document.createElement(vnode.tag)
//     for (const key in vnode.props) {
//       if (/^on/.test(key)) {
//         el.addEventListener(key.substring(2).toLowerCase(), vnode.props[key])
//       }
//     }
//     if (typeof vnode.children === "string") {
//       const text = document.createTextNode(vnode.children)
//       el.appendChild(text)
//     } else if (Array.isArray(vnode.children)) {
//       for (let i = 0; i < vnode.children.length; i++) {
//         render(vnode.children[i], el)
//       }
//     }
//     container.appendChild(el)
//   }
// }

const mountComponent = (vnode, container) => {
  const el = document.createElement(vnode.tag)
  for (const key in vnode.props) {
    if (/^on/.test(key)) {
      el.addEventListener(key.substring(2).toLowerCase(), vnode.props[key])
    }
  }
  if (typeof vnode.children === "string") {
    const text = document.createTextNode(vnode.children)
    el.appendChild(text)
  } else if (Array.isArray(vnode.children)) {
    for (let i = 0; i < vnode.children.length; i++) {
      mountComponent(vnode.children[i], el)
    }
  }
  container.appendChild(el)
}


const render = (vnode, container) => {
  if (typeof vnode.tag === "string") {
    mountComponent(vnode, container)
  } else if (typeof vnode === "function") {
    mountComponent(vnode(), container)
  } else if (typeof vnode === "object") {
    mountComponent(vnode.render(), container)
  }
}
