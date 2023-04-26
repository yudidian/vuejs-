const fn = () => {
  console.log(123)
}
const obj = {
  scheduler: fn
}

console.log(obj.scheduler)
