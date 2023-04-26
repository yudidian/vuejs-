const fn = (name) => {
  console.log(name)
}

const p2 = new Proxy(fn, {
  apply(target, thisArg, argArray) {
    target.call(thisArg, ...argArray)
  }
})

p2("test")


const obj = {
  foo: 1,
  get fn() {
    console.log(this.foo)
    return this.foo
  }
}
console.log("不指定receiver", Reflect.get(obj, 'fn'))
console.log("指定receiver", Reflect.get(obj, 'fn', {foo: 2}))
