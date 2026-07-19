#!/usr/bin/env node
/**
 * 导入 RAG 语料 JSONL → corpus_chunks
 * node scripts/import-corpus.mjs
 * node scripts/import-corpus.mjs --from-words
 * node scripts/import-corpus.mjs --seed-db   # 同时写入 xiyu.seed.db
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { DatabaseSync } from 'node:sqlite'
import { runMigrations } from '../backend/src/migrate.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const CORPUS_DIR = path.join(ROOT, 'data', 'corpus')
const fromWords = process.argv.includes('--from-words')
const alsoSeed = process.argv.includes('--seed-db')

function openDb(dbPath) {
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const db = new DatabaseSync(dbPath)
  runMigrations(db)
  return db
}

function upsertChunk(db, { source, level, text_es, text_zh, lemmas }) {
  const textEs = String(text_es || '').trim()
  if (!textEs) return false
  const lemmasJson = JSON.stringify(
    (Array.isArray(lemmas) ? lemmas : [])
      .map((l) => String(l || '').trim().toLowerCase())
      .filter(Boolean),
  )
  const existing = db.prepare(`
    SELECT id FROM corpus_chunks WHERE source = ? AND text_es = ?
  `).get(source, textEs)
  if (existing) {
    db.prepare(`
      UPDATE corpus_chunks SET level = ?, text_zh = ?, lemmas_json = ? WHERE id = ?
    `).run(level || 'A1', text_zh || null, lemmasJson, existing.id)
    return false
  }
  db.prepare(`
    INSERT INTO corpus_chunks (source, level, text_es, text_zh, lemmas_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(source || 'team', level || 'A1', textEs, text_zh || null, lemmasJson)
  return true
}

function importJsonlFiles(db) {
  let inserted = 0
  let updated = 0
  if (!fs.existsSync(CORPUS_DIR)) {
    console.log('[corpus] no data/corpus directory')
    return { inserted, updated }
  }
  const levels = fs.readdirSync(CORPUS_DIR).filter((n) => {
    const p = path.join(CORPUS_DIR, n)
    return fs.statSync(p).isDirectory() && /^[ABC][12]$/.test(n)
  })
  for (const level of levels) {
    const dir = path.join(CORPUS_DIR, level)
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'))) {
      const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        let row
        try {
          row = JSON.parse(trimmed)
        } catch {
          console.warn('[corpus] skip bad json:', trimmed.slice(0, 80))
          continue
        }
        const isNew = upsertChunk(db, {
          source: row.source || `team-${level}`,
          level: row.level || level,
          text_es: row.text_es,
          text_zh: row.text_zh,
          lemmas: row.lemmas,
        })
        if (isNew) inserted += 1
        else updated += 1
      }
    }
  }
  return { inserted, updated }
}

function importFromWords(db) {
  let inserted = 0
  const rows = db.prepare(`
    SELECT lemma, level, example_es, example_zh
    FROM words
    WHERE example_es IS NOT NULL AND trim(example_es) != ''
  `).all()
  for (const row of rows) {
    const isNew = upsertChunk(db, {
      source: 'words-example',
      level: row.level || 'A1',
      text_es: row.example_es,
      text_zh: row.example_zh,
      lemmas: [row.lemma],
    })
    if (isNew) inserted += 1
  }
  return inserted
}

function linkExampleCache(db) {
  const words = db.prepare('SELECT id, lemma FROM words').all()
  const insert = db.prepare(`
    INSERT OR IGNORE INTO example_cache (word_id, chunk_id, rank, approved)
    VALUES (?, ?, ?, 1)
  `)
  let linked = 0
  for (const w of words) {
    const lemma = String(w.lemma || '').toLowerCase()
    if (!lemma) continue
    const chunks = db.prepare(`
      SELECT id FROM corpus_chunks
      WHERE lower(lemmas_json) LIKE ?
         OR lower(text_es) LIKE ?
      ORDER BY id
      LIMIT 5
    `).all(`%"${lemma}"%`, `%${lemma}%`)
    chunks.forEach((c, i) => {
      const r = insert.run(w.id, c.id, i)
      if (r.changes) linked += 1
    })
  }
  return linked
}

function runOn(dbPath, label) {
  const db = openDb(dbPath)
  const { inserted, updated } = importJsonlFiles(db)
  let fromWordsCount = 0
  if (fromWords) fromWordsCount = importFromWords(db)
  const linked = linkExampleCache(db)
  const total = db.prepare('SELECT COUNT(*) AS c FROM corpus_chunks').get().c
  console.log(`[corpus:${label}] jsonl +${inserted} ~${updated} | fromWords +${fromWordsCount} | cache links +${linked} | total=${total}`)
  db.close?.()
}

const localDb = path.join(ROOT, 'backend', 'data', 'xiyu.db')
runOn(localDb, 'local')
if (alsoSeed || fs.existsSync(path.join(ROOT, 'backend', 'data', 'xiyu.seed.db'))) {
  runOn(path.join(ROOT, 'backend', 'data', 'xiyu.seed.db'), 'seed')
}
