// 将对象变为可迭代对象

const obj = {
  age: 1,
  name: "test"
}
obj[Symbol.iterator] = function () {
  const keys = Reflect.ownKeys(obj)
  let index = 0
  return {
    next() {
      return {
        value: obj[keys[index++]],
        done: index >= keys.length
      }
    }
  }
}
for (const objElement of obj) {
  console.log(objElement)
}
