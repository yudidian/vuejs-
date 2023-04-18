### 虚拟dom
+ 具有DOM属性的一组对象
### render函数 和 compiler 函数
+ render 函数 将虚拟DOM 转化为真实dom
+ compiler 函数 将HTML文档转化为树形结构对象

### Tree-Shaking
+ 不会产生副作用函数注释
+ 表名foo 函数不会产生副作用，Tree-Shaking 时可以放心删除
```js
/*#__PURE__*/ foo()
```
