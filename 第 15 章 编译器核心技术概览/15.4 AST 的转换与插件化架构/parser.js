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
          currentState = State.tagEnd
          str = str.slice(1)
        }
        break
      }
      case State.tagName: {
        if (isAlpha(char)) {
          chars.push(char)
          str = str.slice(1)
        } else if (char === '>') {
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

function parse(str) {
  const tokens = tokenize(str)
  // 根节点
  const root = {
    type: 'Root',
    children: []
  }
  // 创建栈
  const elementStack = [root]

  while (tokens.length) {
    // 栈顶节点为父节点
    const parent = elementStack[elementStack.length - 1]
    // 当前扫描节点
    const t = tokens[0]

    switch (t.type) {
      case 'tag': {
        const elementNode = {
          type: 'Element',
          tag: t.name,
          children: []
        }
        parent.children.push(elementNode)
        // 当前节点入栈
        elementStack.push(elementNode)
        break
      }
      case 'text': {
        const textNode = {
          type: 'Text',
          content: t.content
        }
        parent.children.push(textNode)
        break
      }
      case 'tagEnd': {
        elementStack.pop()
        break
      }
    }
    tokens.shift()
  }
  return root
}

function dump(node, indent = 0) {
  const type = node.type
  const desc = node.type === 'Root' ? "" : node.type === 'Element' ? node.tag : node.content
  console.log(`${'-'.repeat(indent)}${type}: ${desc}`)
  if (node.children) {
    node.children.forEach(n => dump(n, indent + 2))
  }
}
function traverseNode(ast) {
  const currentNode = ast
  if (currentNode.type === '') {

  }
  const children = currentNode.children

  if (children) {
    children.forEach(item => {
      traverseNode(item)
    })
  }
}
const ast = parse(`<div><p>Vue</p><p>Template</p></div>`)
console.log(ast)
dump(ast)
