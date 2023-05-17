function fetch() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject('err')
    }, 1000)
  })
}

function load(onError) {
  const p = fetch()
  return p.catch((err) => {
    return new Promise((resolve, reject) => {
      const retry = () => {
        resolve(load(onError))
      }
      const fail = () => reject(err)
      onError(retry, fail)
    })
  })
}

load((retry) => {
  retry()
}).then(res => {
  console.log(res)
})
