#!/usr/bin/env node
/**
 * 清空词库，导入：A1 义项包 + 专四 + 专八。
 * 始终写入本地 SQLite（backend/data/xiyu.db），不会碰 Turso。
 * node scripts/reset-with-exams.mjs
 */
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

// 强制本地库，避免 shell 里残留的 TURSO_* 误伤生产
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN

const { default: db, getDbBackend } = await import('../backend/src/db.js')
const { runMigrations } = await import('../backend/src/migrate.js')
const { seedWords, wordCount } = await import('../backend/src/seed.js')
const { seedConfusablePairs } = await import('../backend/src/services/content.js')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const LIVE = path.join(ROOT, 'backend', 'data', 'xiyu.db')
const SEED = path.join(ROOT, 'backend', 'data', 'xiyu.seed.db')

const CSVs = [
  path.join(ROOT, 'data', 'batches', 'A1', 'words_senses_team.csv'),
  path.join(ROOT, 'data', 'batches', 'exam', 'words_tem4.csv'),
  path.join(ROOT, 'data', 'batches', 'exam', 'words_tem8.csv'),
]

async function main() {
  if (getDbBackend() !== 'sqlite-local') {
    throw new Error(`拒绝在非本地库上 reset（当前 ${getDbBackend()}）。请 unset TURSO_* 后重试。`)
  }

  await runMigrations(db)

  const before = await wordCount()
  console.log(`[reset] 清空旧词库（原有 ${before} 词）…`)
  await db.exec('PRAGMA foreign_keys = OFF')
  await db.exec('BEGIN')
  try {
    await db.exec('DELETE FROM study_events')
    await db.exec('DELETE FROM word_options')
    await db.exec('DELETE FROM user_word_progress')
    await db.exec('DELETE FROM mistake_book')
    await db.exec('DELETE FROM confusable_pairs')
    await db.exec('DELETE FROM daily_sessions')
    await db.exec('DELETE FROM checkin_log')
    await db.exec('DELETE FROM example_cache')
    await db.exec('DELETE FROM ai_reviews')
    await db.exec('DELETE FROM corpus_chunks')
    await db.exec('DELETE FROM words')
    await db.exec('COMMIT')
  } catch (e) {
    await db.exec('ROLLBACK')
    throw e
  } finally {
    await db.exec('PRAGMA foreign_keys = ON')
  }

  let total = 0
  for (const csv of CSVs) {
    if (!fs.existsSync(csv)) {
      console.warn(`[skip] 缺少 ${csv}`)
      continue
    }
    const n = await seedWords(csv)
    total += n
    console.log(`[seed] ${path.relative(ROOT, csv)} → ${n}`)
  }

  await seedConfusablePairs()

  const fill = spawnSync(process.execPath, [path.join(__dirname, 'fill-conjugations.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, TURSO_DATABASE_URL: '', TURSO_AUTH_TOKEN: '' },
  })
  if (fill.status !== 0) {
    console.warn('[reset] 变位补全脚本未成功，请手动运行 node scripts/fill-conjugations.mjs')
  }

  const corpus = spawnSync(process.execPath, [path.join(__dirname, 'import-corpus.mjs'), '--from-words', '--seed-db'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, TURSO_DATABASE_URL: '', TURSO_AUTH_TOKEN: '' },
  })
  if (corpus.status !== 0) {
    console.warn('[reset] 语料导入未成功，请手动运行 npm run import:corpus')
  }

  const after = await wordCount()
  console.log(`[reset] 合计导入 ${total} 行，库中 ${after} 词`)

  const tem4 = (await db.prepare(`SELECT COUNT(*) AS c FROM words WHERE tags LIKE '%"专四"%'`).get()).c
  const tem8 = (await db.prepare(`SELECT COUNT(*) AS c FROM words WHERE tags LIKE '%"专八"%'`).get()).c
  const withImg = (await db.prepare(`SELECT COUNT(*) AS c FROM words WHERE image_url IS NOT NULL AND image_url != ''`).get()).c
  console.log(`[stats] 专四=${tem4} 专八=${tem8} 有图=${withImg}`)

  if (fs.existsSync(LIVE)) {
    fs.copyFileSync(LIVE, SEED)
    console.log(`[reset] 已更新 seed: ${SEED}`)
  }

  const sample = await db.prepare(`
    SELECT lemma, sense, meaning_zh, tags, image_url FROM words
    WHERE tags LIKE '%专四%' OR tags LIKE '%专八%'
    ORDER BY lemma LIMIT 6
  `).all()
  console.log('[sample exam]', sample)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
