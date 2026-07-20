#!/usr/bin/env node
/** 给已知 async 函数调用补 await */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as parser from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import * as t from '@babel/types'

const traverse = _traverse.default || _traverse
const generate = _generate.default || _generate
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'backend', 'src')

function walk(dir, acc = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f)
    if (fs.statSync(p).isDirectory()) walk(p, acc)
    else if (f.endsWith('.js')) acc.push(p)
  }
  return acc
}

const asyncNames = new Set()
for (const file of walk(ROOT)) {
  const code = fs.readFileSync(file, 'utf8')
  const ast = parser.parse(code, { sourceType: 'module', allowAwaitOutsideFunction: true })
  traverse(ast, {
    FunctionDeclaration(p) {
      if (p.node.async && p.node.id) asyncNames.add(p.node.id.name)
    },
    ExportNamedDeclaration(p) {
      const d = p.node.declaration
      if (d && t.isFunctionDeclaration(d) && d.async && d.id) asyncNames.add(d.id.name)
    },
  })
}

console.log('async names', asyncNames.size)

for (const file of walk(ROOT)) {
  if (file.endsWith('/db.js')) continue
  const code = fs.readFileSync(file, 'utf8')
  const ast = parser.parse(code, { sourceType: 'module', allowAwaitOutsideFunction: true })
  let changed = false
  traverse(ast, {
    CallExpression(path) {
      if (!t.isIdentifier(path.node.callee)) return
      const name = path.node.callee.name
      if (!asyncNames.has(name)) return
      if (t.isAwaitExpression(path.parent)) return
      // skip new Foo() style N/A
      // skip if defining: export function name - callee won't be that
      const fn = path.getFunctionParent()
      // top-level in module: allow await (TLA)
      path.replaceWith(t.awaitExpression(path.node))
      changed = true
      if (fn && !fn.node.async) fn.node.async = true
    },
  })
  if (changed) {
    fs.writeFileSync(file, generate(ast, { retainLines: true }, code).code)
    console.log('await-calls', path.relative(process.cwd(), file))
  }
}
console.log('done')
