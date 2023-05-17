const el = document.createElement('div')

el.classList.add('box')
el.classList.add('enter-form')
el.classList.add('enter-active')
document.body.appendChild(el)
requestAnimationFrame(() => {
  el.classList.remove('enter-form')
  el.classList.add('enter-to')
})

document.body.offsetHeight
el.addEventListener('click', () => {
  const performRemove = () => el.parentNode.removeChild(el)
  el.classList.add('leave-from')
  el.classList.add('leave-active')
  requestAnimationFrame(() => {
    el.classList.remove('leave-from')
    el.classList.add('leave-to')
    el.addEventListener('transitionend', () => {
      el.classList.remove('leave-to')
      el.classList.remove('leave-active')
      performRemove()
    })
  })
})
