const obj = { foo: 1 }
const p = new Proxy(obj, {
  deleteProperty(target, key) {
    return Reflect.deleteProperty(target, key)
  },
  has(target, p) {
    console.log(target[p])
    return Reflect.has(target, p)
  }
})
console.log("foo" in p)
