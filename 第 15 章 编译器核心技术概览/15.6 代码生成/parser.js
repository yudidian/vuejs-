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
  console.dir(tokens)
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

function traverseNode(ast, context) {
  context.currentNode = ast
  // 退出阶段回调函数组
  const exitFns = []
  // 数组 => 函数
  const transforms = context.nodeTransforms

  for (let i = 0; i < transforms.length; i++) {
    const onExit = transforms[i](context.currentNode, context)
    if (onExit) {
      exitFns.push(onExit)
    }
    // 当前节点为空直接返回
    if (!context.currentNode) return
  }
  const children = context.currentNode.children
  if (children) {
    for (let i = 0; i < children.length; i++) {
      context.parent = context.currentNode
      context.childIndex = i
      traverseNode(children[i], context)
    }
  }
  let i = exitFns.length
  // 倒叙执行
  while (i--) {
    exitFns[i]()
  }
}

function transformRoot(node) {
  return () => {
    if (node.type !== 'Root') {
      return
    }
    const vnodeJSAST = node.children[0].jsNode

    node.jsNode = {
      type: 'FunctionDecl',
      id: {
        type: 'Identifier',
        name: 'render'
      },
      params: [],
      body: [
        {
          type: 'ReturnStatement',
          return: vnodeJSAST
        }
      ]
    }
  }
}

function transformElement(node) {
  return () => {
    if (node.type !== 'Element') {
      return
    }
    const callExp = createCallExpression('h', [createStringLiteral(node.tag)])
    node.children.length === 1
        ? callExp.arguments.push(node.children[0].jsNode)
        : callExp.arguments.push(createArrayExpression(node.children.map(c => c.jsNode)))
    node.jsNode = callExp
  }
}

function transformText(node) {
  // 只处理文本节点
  if (node.type !== 'Text') {
    return
  }
  node.jsNode = createStringLiteral(node.content)
}

function transform(ast) {
  const context = {
    currentNode: null, // 当前转化节点
    childIndex: 0, // child 位置
    parent: null, // 当前转化节点的父节点
    nodeTransforms: [
      transformElement,
      transformText,
      transformRoot
    ],
    // 替换节点
    replaceNode(node) {
      context.parent.children[context.childIndex] = node
      context.currentNode = node
    },
    removeNode() {
      if (context.parent) {
        context.parent.children.splice(context.childIndex, 1)
        context.currentNode = null
      }
    }
  }
  traverseNode(ast, context)
  // dump(ast)
}

function createStringLiteral(value) {
  return {
    type: 'StringLiteral',
    value
  }
}

function createIdentifier(name) {
  return {
    type: 'Identifier',
    name
  }
}

function createArrayExpression(elements) {
  return {
    type: 'ArrayExpression',
    elements
  }
}

function createCallExpression(callee, arguments) {
  return {
    type: 'CallExpression',
    callee: createIdentifier(callee),
    arguments
  }
}

function genNodeList(nodes, context) {
  const {push} = context
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    genNode(node, context)
    if (i < nodes.length - 1) {
      push(',')
    }
  }
}

function genFunctionDecl(node, context) {
  const {push, indent, deIndent} = context
  push(`function ${node.id.name}`)
  push('(')
  genNodeList(node.params, context)
  push(')')
  push('{')
  indent()
  node.body.forEach(n => genNode(n, context))
  deIndent()
  push('}')
}

function genArrayExpression(node, context) {
  const {push} = context
  push('[')
  genNodeList(node.elements, context)
  push(']')
}

function genReturnStatement(node, context) {
  const {push} = context
  push(`return `)
  genNode(node.return, context)
}

function genStringLiteral(node, context) {
  const {push} = context
  push(`'${node.value}'`)
}

function genCallExpression(node, context) {
  const {push} = context
  const {callee, arguments: args} = node
  push(`${callee.name}(`)
  genNodeList(args, context)
  push(')')
}

function genNode(node, context) {
  switch (node.type) {
    case 'FunctionDecl': {
      genFunctionDecl(node, context)
      break
    }
    case 'ReturnStatement': {
      genReturnStatement(node, context)
      break
    }
    case 'CallExpression': {
      genCallExpression(node, context)
      break
    }
    case 'StringLiteral': {
      genStringLiteral(node, context)
      break
    }
    case 'ArrayExpression': {
      genArrayExpression(node, context)
      break
    }
  }
}

function generate(node) {
  const context = {
    code: '',
    push(code) {
      context.code += code
    },
    currentIndent: 0,
    newline() {
      context.code += '\n' + `  `.repeat(context.currentIndent)
    },
    // 设置缩进
    indent() {
      context.currentIndent++
      context.newline()
    },
    // 取消缩进
    deIndent() {
      context.currentIndent--
      context.newline()
    }
  }
  genNode(node, context)
  return context.code
}

function compile(template) {
  const ast = parse(template)
  console.log(ast)
  transform(ast)
  return generate(ast.jsNode)
}

const ast = compile(`<div><p>Vue</p><p>Template</p></div>`)
console.dir(ast)
