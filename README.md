### 伪造事件处理函数
+ invoker 避免多次调用removeEventListener提高性能

### DOM 节点插入操作
+ parent.insertBefore(newNode, referenceNode)
  + 前提有父容器parent
  + 作用在referenceNode 之前插入节点
  + referenceNode 为null 时 插入节点在父容器最后
  + 实现在 referenceNode 后面插入节点 parent.insertBefore(newNode, referenceNode.nextSibling)

+ node.nextSibling
  + 只读属性
  + 获取当前节点的下一个兄弟节点
