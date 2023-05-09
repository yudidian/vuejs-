// 定义队列刷新标志
let isFlushing = false
// 定义任务队列
const jobQueue = new Set()
// 微任务实例
const p = Promise.resolve()


// 刷新任务队列多次调用flushJob也只会执行一次
export function flushJob() {
  if (isFlushing) return
  isFlushing = true
  p.then(() => {
    jobQueue.forEach(job => job())
  }).finally(() => {
    isFlushing = false
  })
}

// 递归读取对象属性
export function traverse(value, seen = new Set()) {
  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return
  }
  seen.add(value)
  for (const key in value) {
    traverse(value[key], seen)
  }
  return value
}

// 模拟异步请求
export function send() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve({
        name: "test",
        age: 10
      })
    },2000)
  })
}
