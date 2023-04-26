### 副作用函数

+ 函数执行时会间接或直接修改外部所依赖的值

### 响应式数据的基本实现

+ 监听修改依赖值的变化
+ 将副作用函数存入 一个桶中
+ 当读取操作发生时，将副作用函数收集到“桶”中
+ 当设置操作发生时，从“桶”中取出副作用函数并执行
+ 副作用函数与被操作的目标字段之间建立明确的联系

#### 存储副作用函数容器的设计

+ weakMap => (target, Map)
+ Map => (key, Set)
+ set => effect 副作用函数
+ 其中weakMap 存储不同值的Map 对象，二Map集合中又存储了对应target key的副作用函数
+ 为什么选用 weakMap ？
    + weakMap 中对key 的引用是弱引用
    + Map 中对 key 是强引用
    + 不影响垃圾回收机制回收，不会造成内存泄露
    + 对于下面的列子，当立即执行函数执行完成后weakMap 中为空而map 中仍然可以访问存储的值

```js
const map = new Map();
const weakmap = new WeakMap();
(function () {
  const foo = {foo: 1};
  const bar = {bar: 2};
  map.set(foo, 1);
  weakmap.set(bar, 2);
})()
```

### js 中属性访问器

+ get

```js
const obj = {
  get name() {
    return 'John Doe'
  }
}

console.log(obj.name) // 'John Doe'

```

+ set

```js
const obj = {
  _name: '',

  set name(value) {
    this._name = value
  },

  get name() {
    return this._name
  }
}

obj.name = 'John Doe'

console.log(obj.name) // 'John Doe'
```
