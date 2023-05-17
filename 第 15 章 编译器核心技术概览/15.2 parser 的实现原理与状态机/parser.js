// 定义状态机的状态
const State = {
  initial: 1, // 初始状态
  tagOpen: 2, // 标签开始状态
  tagName: 3, // 标签名状态
  text: 4, // 文本状态
  tagEnd: 5, // 标签结束
  tagEndName: 6 // 结束标签名称状态
}

// 用于判断是否是字母
function isAlpha(char) {
  return char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z'
}

// 返回token
function tokenize(str) {
  // 当前状态
  let currentState = State.initial
  // 用于缓存字符
  const chars = []
  // 返回结果
  const tokens = []

  while (str) {
    // 第一个字符
    const char = str[0]
    switch (currentState) {
      case State.initial: {
        if (char === '<') {
          currentState = State.tagOpen
          str = str.slice(1)
        } else if (isAlpha(char)) {
          currentState = State.text
          chars.push(char)
          str = str.slice(1)
        }
        break
      }
      case State.tagOpen: {
        if (isAlpha(char)) {
          currentState = State.tagName
          chars.push(char)
          str = str.slice(1)
        } else if (char === '/') {
          currentState=State.tagEnd
          str = str.slice(1)
        }
        break
      }
      case State.tagName: {
        if (isAlpha(char)) {
          chars.push(char)
          str = str.slice(1)
        } else if(char === '>') {
          currentState = State.initial
          tokens.push({
            type: 'tag',
            name: chars.join('')
          })
          chars.length = 0
          str = str.slice(1)
        }
        break
      }
      case State.text: {
        if (isAlpha(char)) {
          chars.push(char)
          str = str.slice(1)
        } else if (char === '<') {
          currentState = State.tagOpen
          tokens.push({
            type: 'text',
            content: chars.join('')
          })
          chars.length = 0
          str = str.slice(1)
        }
        break
      }
      case State.tagEnd: {
        if (isAlpha(char)) {
          currentState = State.tagEndName
          chars.push(char)
          str = str.slice(1)
        }
        break
      }
      case State.tagEndName: {
        if (isAlpha(char)) {
          chars.push(char)
          str = str.slice(1)
        } else if (char === '>') {
          currentState = State.initial
          tokens.push({
            type: 'tagEnd',
            name: chars.join('')
          })
          chars.length = 0
          str = str.slice(1)
        }
        break
      }
    }
  }
  return tokens
}
function dump(node, indent = 0) {
  const type = node.type
  const desc = node.type === 'Root' ? "" : node.type === 'Element' ? node.tag : node.content
  console.log(`${'-'.repeat(indent)}${type}: ${desc}`)
  if (node.children) {
    node.children.forEach( n => dump(node, indent + 2))
  }
}

const ast = tokenize(`<div><p>Vue</p><p>Template</p></div>`)
dump(ast)
