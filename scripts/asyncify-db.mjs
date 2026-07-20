#!/usr/bin/env node
/**
 * AST: 将 db.prepare/exec 调用改为 await，并给含 await 的函数加 async
 */
import fs from 'fs'
import path from 'path'
import * as parser from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import * as t from '@babel/types'

const traverse = _traverse.default || _traverse
const generate = _generate.default || _generate

import { fileURLToPath } from 'url'
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'backend', 'src')

function walk(dir, acc = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f)
    if (fs.statSync(p).isDirectory()) walk(p, acc)
    else if (f.endsWith('.js') && f !== 'db.js') acc.push(p)
  }
  return acc
}

function isDbMember(node, name) {
  return (
    t.isMemberExpression(node) &&
    t.isIdentifier(node.object, { name: 'db' }) &&
    t.isIdentifier(node.property, { name })
  )
}

function needsAwaitCall(path) {
  // db.exec(...)
  if (isDbMember(path.node.callee, 'exec')) return true
  // db.prepare(...).get/all/run(...)
  if (
    t.isMemberExpression(path.node.callee) &&
    t.isIdentifier(path.node.callee.property) &&
    ['get', 'all', 'run'].includes(path.node.callee.property.name) &&
    t.isCallExpression(path.node.callee.object) &&
    isDbMember(path.node.callee.object.callee, 'prepare')
  ) {
    return true
  }
  return false
}

function transformFile(file) {
  const code = fs.readFileSync(file, 'utf8')
  if (!code.includes('db.prepare') && !code.includes('db.exec')) return false

  const ast = parser.parse(code, {
    sourceType: 'module',
    allowAwaitOutsideFunction: true,
  })

  const funcsNeedingAsync = new Set()

  // Pass 1: wrap db calls with await
  traverse(ast, {
    CallExpression(path) {
      if (!needsAwaitCall(path)) return
      if (t.isAwaitExpression(path.parent)) return
      path.replaceWith(t.awaitExpression(path.node))
      const fn = path.getFunctionParent()
      if (fn) funcsNeedingAsync.add(fn)
    },
  })

  // Pass 2: mark functions async
  for (const fnPath of funcsNeedingAsync) {
    const node = fnPath.node
    if (node.async) continue
    node.async = true
  }

  // Pass 3: await calls to local/imported async helpers that we know about
  // (handled later in index by awaiting service calls)

  const out = generate(ast, { retainLines: true, compact: false }, code)
  fs.writeFileSync(file, out.code)
  return true
}

let n = 0
for (const file of walk(ROOT)) {
  try {
    if (transformFile(file)) {
      console.log('transformed', path.relative(process.cwd(), file))
      n++
    }
  } catch (e) {
    console.error('FAIL', file, e.message)
  }
}
console.log('done', n)
