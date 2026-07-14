#!/usr/bin/env node
/**
 * 清空词库，仅保留 senses_table 义项包。
 * node scripts/reset-to-senses.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../backend/src/db.js'
import { runMigrations } from '../backend/src/migrate.js'
import { seedWords, wordCount } from '../backend/src/seed.js'
import { seedConfusablePairs } from '../backend/src/services/content.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SENSES_CSV = path.join(ROOT, 'data', 'batches', 'A1', 'words_senses_team.csv')
const LIVE = path.join(ROOT, 'backend', 'data', 'xiyu.db')
const SEED = path.join(ROOT, 'backend', 'data', 'xiyu.seed.db')

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
  db.exec('DELETE FROM words')
  // 可选：保留 users，仅重置学习进度相关
  db.exec('COMMIT')
} catch (e) {
  db.exec('ROLLBACK')
  throw e
} finally {
  db.exec('PRAGMA foreign_keys = ON')
}

const n = seedWords(SENSES_CSV)
seedConfusablePairs()

const after = wordCount()
console.log(`[reset] 已导入义项包 ${n} 行，库中 ${after} 词`)

if (fs.existsSync(LIVE)) {
  fs.copyFileSync(LIVE, SEED)
  console.log(`[reset] 已更新 seed: ${SEED}`)
}

const sample = db.prepare(`
  SELECT lemma, sense, meaning_zh, image_url FROM words
  ORDER BY lemma, sense LIMIT 8
`).all()
console.log('[sample]', sample)
