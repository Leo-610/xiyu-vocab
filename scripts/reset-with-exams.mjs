#!/usr/bin/env node
/**
 * 清空词库，导入：A1 义项包 + 专四 + 专八。
 * node scripts/reset-with-exams.mjs
 */
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import db from '../backend/src/db.js'
import { runMigrations } from '../backend/src/migrate.js'
import { seedWords, wordCount } from '../backend/src/seed.js'
import { seedConfusablePairs } from '../backend/src/services/content.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const LIVE = path.join(ROOT, 'backend', 'data', 'xiyu.db')
const SEED = path.join(ROOT, 'backend', 'data', 'xiyu.seed.db')

const CSVs = [
  path.join(ROOT, 'data', 'batches', 'A1', 'words_senses_team.csv'),
  path.join(ROOT, 'data', 'batches', 'exam', 'words_tem4.csv'),
  path.join(ROOT, 'data', 'batches', 'exam', 'words_tem8.csv'),
]

runMigrations(db)

console.log(`[reset] 清空旧词库（原有 ${wordCount()} 词）…`)
db.exec('PRAGMA foreign_keys = OFF')
db.exec('BEGIN')
try {
  db.exec('DELETE FROM study_events')
  db.exec('DELETE FROM word_options')
  db.exec('DELETE FROM user_word_progress')
  db.exec('DELETE FROM mistake_book')
  db.exec('DELETE FROM confusable_pairs')
  db.exec('DELETE FROM daily_sessions')
  db.exec('DELETE FROM checkin_log')
  db.exec('DELETE FROM example_cache')
  db.exec('DELETE FROM ai_reviews')
  db.exec('DELETE FROM corpus_chunks')
  db.exec('DELETE FROM words')
  db.exec('COMMIT')
} catch (e) {
  db.exec('ROLLBACK')
  throw e
} finally {
  db.exec('PRAGMA foreign_keys = ON')
}

let total = 0
for (const csv of CSVs) {
  if (!fs.existsSync(csv)) {
    console.warn(`[skip] 缺少 ${csv}`)
    continue
  }
  const n = seedWords(csv)
  total += n
  console.log(`[seed] ${path.relative(ROOT, csv)} → ${n}`)
}

seedConfusablePairs()

// 导入 CSV 不含变位，随后补全 presente
const fill = spawnSync(process.execPath, [path.join(__dirname, 'fill-conjugations.mjs')], {
  cwd: ROOT,
  stdio: 'inherit',
})
if (fill.status !== 0) {
  console.warn('[reset] 变位补全脚本未成功，请手动运行 node scripts/fill-conjugations.mjs')
}

const corpus = spawnSync(process.execPath, [path.join(__dirname, 'import-corpus.mjs'), '--from-words', '--seed-db'], {
  cwd: ROOT,
  stdio: 'inherit',
})
if (corpus.status !== 0) {
  console.warn('[reset] 语料导入未成功，请手动运行 npm run import:corpus')
}

const after = wordCount()
console.log(`[reset] 合计导入 ${total} 行，库中 ${after} 词`)

const tem4 = db.prepare(`SELECT COUNT(*) AS c FROM words WHERE tags LIKE '%"专四"%'`).get().c
const tem8 = db.prepare(`SELECT COUNT(*) AS c FROM words WHERE tags LIKE '%"专八"%'`).get().c
const withImg = db.prepare(`SELECT COUNT(*) AS c FROM words WHERE image_url IS NOT NULL AND image_url != ''`).get().c
console.log(`[stats] 专四=${tem4} 专八=${tem8} 有图=${withImg}`)

if (fs.existsSync(LIVE)) {
  fs.copyFileSync(LIVE, SEED)
  console.log(`[reset] 已更新 seed: ${SEED}`)
}

const sample = db.prepare(`
  SELECT lemma, sense, meaning_zh, tags, image_url FROM words
  WHERE tags LIKE '%专四%' OR tags LIKE '%专八%'
  ORDER BY lemma LIMIT 6
`).all()
console.log('[sample exam]', sample)
