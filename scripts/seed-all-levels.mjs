#!/usr/bin/env node
/**
 * 导入 data/batches 下全部等级词库 + 可选 master 表
 * node scripts/seed-all-levels.mjs
 */
import path from 'path'
import { fileURLToPath } from 'url'
import { seedWords, wordCount } from '../backend/src/seed.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

let total = 0
const before = wordCount()

for (const level of LEVELS) {
  const csvPath = path.join(ROOT, 'data', 'batches', level, `words_${level}.csv`)
  const n = seedWords(csvPath)
  console.log(`[${level}] 处理 ${n} 行`)
  total += n
}

const after = wordCount()
console.log(`\n导入完成: 共处理 ${total} 行, 库中 ${after} 词 (原有 ${before}, 净增 ${after - before})`)
