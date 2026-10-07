#!/usr/bin/env node
/**
 * 将本地 seed/live SQLite 灌入 Turso（生产持久库）
 *
 * 用法：
 *   export TURSO_DATABASE_URL=libsql://...
 *   export TURSO_AUTH_TOKEN=...
 *   node scripts/push-db-to-turso.mjs
 *   node scripts/push-db-to-turso.mjs --keep-users   # 保留远端用户，按 lemma 重挂进度
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { DatabaseSync } from 'node:sqlite'
import { createClient } from '@libsql/client'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const keepUsers = process.argv.includes('--keep-users')

const url = (process.env.TURSO_DATABASE_URL || '').trim()
const token = (process.env.TURSO_AUTH_TOKEN || '').trim()
if (!url || !token) {
  console.error('需要环境变量 TURSO_DATABASE_URL 与 TURSO_AUTH_TOKEN')
  process.exit(1)
}

const seed = path.join(ROOT, 'backend', 'data', 'xiyu.seed.db')
const live = path.join(ROOT, 'backend', 'data', 'xiyu.db')
const sourcePath = fs.existsSync(seed) ? seed : live
if (!fs.existsSync(sourcePath)) {
  console.error('找不到本地数据库', seed, '或', live)
  process.exit(1)
}

const local = new DatabaseSync(sourcePath, { readonly: true })
const remote = createClient({ url, authToken: token })

const CONTENT_TABLES = [
  'words',
  'word_options',
  'confusable_pairs',
  'corpus_chunks',
  'example_cache',
]

/** 依赖 words.id 的用户侧表：灌词前需解绑，灌词后按 lemma 重挂 */
const WORD_USER_TABLES = [
  'study_events',
  'mistake_book',
  'user_word_progress',
]

const USER_TABLES = [
  'users',
  'user_word_progress',
  'mistake_book',
  'daily_sessions',
  'checkin_log',
  'study_events',
  'verification_tokens',
  'rate_limit_events',
  'ai_reviews',
]

async function tableExists(name) {
  const r = await remote.execute({
    sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    args: [name],
  })
  return r.rows.length > 0
}

async function ensureRemoteSchema() {
  const creates = local.prepare(`
    SELECT sql FROM sqlite_master
    WHERE type IN ('table','index') AND sql IS NOT NULL
      AND name NOT LIKE 'sqlite_%'
    ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name
  `).all()
  for (const row of creates) {
    try {
      await remote.execute(row.sql)
    } catch (e) {
      const msg = String(e.message || e)
      if (!/already exists/i.test(msg)) console.warn('[schema]', msg.slice(0, 120))
    }
  }
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}

async function setForeignKeys(on) {
  try {
    await remote.execute(`PRAGMA foreign_keys = ${on ? 'ON' : 'OFF'}`)
  } catch (e) {
    console.warn('[pragma] foreign_keys', e.message)
  }
}

async function clearTable(name) {
  if (!(await tableExists(name))) return
  await remote.execute(`DELETE FROM ${quoteIdent(name)}`)
}

async function copyTable(name) {
  const cols = local.prepare(`PRAGMA table_info(${quoteIdent(name)})`).all()
  if (!cols.length) {
    console.warn('[skip] no table', name)
    return 0
  }
  const colNames = cols.map((c) => c.name)
  const placeholders = colNames.map(() => '?').join(',')
  const colList = colNames.map(quoteIdent).join(',')
  const rows = local.prepare(`SELECT * FROM ${quoteIdent(name)}`).all()
  let n = 0
  const batchSize = 40
  for (let i = 0; i < rows.length; i += batchSize) {
    const slice = rows.slice(i, i + batchSize)
    await remote.batch(
      slice.map((row) => ({
        sql: `INSERT OR REPLACE INTO ${quoteIdent(name)} (${colList}) VALUES (${placeholders})`,
        args: colNames.map((c) => row[c] ?? null),
      })),
      'write',
    )
    n += slice.length
  }
  console.log(`[copy] ${name}: ${n}`)
  return n
}

/** 灌词前：把远端进度按 lemma/sense/pos 暂存，避免 FK 挡住清空 words */
async function snapshotWordLinkedProgress() {
  const snap = { progress: [], mistakes: [], events: [] }
  if (!(await tableExists('words'))) return snap

  if (await tableExists('user_word_progress')) {
    const r = await remote.execute(`
      SELECT p.user_id, w.lemma, w.pos, w.sense, p.status, p.ease_factor, p.interval_days,
             p.next_review, p.wrong_count, p.last_review
      FROM user_word_progress p
      JOIN words w ON w.id = p.word_id
    `)
    snap.progress = r.rows.map((row) => ({
      user_id: row.user_id ?? row[0],
      lemma: row.lemma ?? row[1],
      pos: row.pos ?? row[2],
      sense: row.sense ?? row[3],
      status: row.status ?? row[4],
      ease_factor: row.ease_factor ?? row[5],
      interval_days: row.interval_days ?? row[6],
      next_review: row.next_review ?? row[7],
      wrong_count: row.wrong_count ?? row[8],
      last_review: row.last_review ?? row[9],
    }))
  }

  if (await tableExists('mistake_book')) {
    const r = await remote.execute(`
      SELECT m.user_id, w.lemma, w.pos, w.sense, m.wrong_at, m.resolved
      FROM mistake_book m
      JOIN words w ON w.id = m.word_id
    `)
    snap.mistakes = r.rows.map((row) => ({
      user_id: row.user_id ?? row[0],
      lemma: row.lemma ?? row[1],
      pos: row.pos ?? row[2],
      sense: row.sense ?? row[3],
      wrong_at: row.wrong_at ?? row[4],
      resolved: row.resolved ?? row[5],
    }))
  }

  if (await tableExists('study_events')) {
    const r = await remote.execute(`
      SELECT e.user_id, w.lemma, w.pos, w.sense, e.event_type, e.is_correct,
             e.study_mode, e.duration_ms, e.created_at
      FROM study_events e
      JOIN words w ON w.id = e.word_id
    `)
    snap.events = r.rows.map((row) => ({
      user_id: row.user_id ?? row[0],
      lemma: row.lemma ?? row[1],
      pos: row.pos ?? row[2],
      sense: row.sense ?? row[3],
      event_type: row.event_type ?? row[4],
      is_correct: row.is_correct ?? row[5],
      study_mode: row.study_mode ?? row[6],
      duration_ms: row.duration_ms ?? row[7],
      created_at: row.created_at ?? row[8],
    }))
  }

  console.log(
    `[snap] progress=${snap.progress.length} mistakes=${snap.mistakes.length} events=${snap.events.length}`,
  )
  return snap
}

async function lookupWordId(lemma, pos, sense) {
  const r = await remote.execute({
    sql: `SELECT id FROM words WHERE lemma = ? AND pos = ? AND sense = ? LIMIT 1`,
    args: [lemma, pos, sense ?? 1],
  })
  if (!r.rows.length) return null
  return r.rows[0].id ?? r.rows[0][0]
}

async function restoreWordLinkedProgress(snap) {
  let okP = 0
  let okM = 0
  let okE = 0
  let drop = 0

  for (const row of snap.progress) {
    const wordId = await lookupWordId(row.lemma, row.pos, row.sense)
    if (!wordId) {
      drop += 1
      continue
    }
    try {
      await remote.execute({
        sql: `INSERT OR REPLACE INTO user_word_progress
          (user_id, word_id, status, ease_factor, interval_days, next_review, wrong_count, last_review)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          row.user_id,
          wordId,
          row.status,
          row.ease_factor,
          row.interval_days,
          row.next_review,
          row.wrong_count,
          row.last_review,
        ],
      })
      okP += 1
    } catch {
      drop += 1
    }
  }

  for (const row of snap.mistakes) {
    const wordId = await lookupWordId(row.lemma, row.pos, row.sense)
    if (!wordId) {
      drop += 1
      continue
    }
    try {
      await remote.execute({
        sql: `INSERT OR REPLACE INTO mistake_book
          (user_id, word_id, wrong_at, resolved)
          VALUES (?, ?, ?, ?)`,
        args: [row.user_id, wordId, row.wrong_at, row.resolved ?? 0],
      })
      okM += 1
    } catch {
      drop += 1
    }
  }

  for (const row of snap.events) {
    const wordId = await lookupWordId(row.lemma, row.pos, row.sense)
    if (!wordId) {
      drop += 1
      continue
    }
    try {
      await remote.execute({
        sql: `INSERT INTO study_events
          (user_id, word_id, event_type, is_correct, study_mode, duration_ms, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          row.user_id,
          wordId,
          row.event_type || 'answer',
          row.is_correct,
          row.study_mode,
          row.duration_ms,
          row.created_at,
        ],
      })
      okE += 1
    } catch {
      drop += 1
    }
  }

  console.log(`[restore] progress=${okP} mistakes=${okM} events=${okE} dropped=${drop}`)
}

console.log('[push] source=', sourcePath)
console.log('[push] target=', url)
await ensureRemoteSchema()

let snap = { progress: [], mistakes: [], events: [] }
if (keepUsers) {
  snap = await snapshotWordLinkedProgress()
}

await setForeignKeys(false)

if (!keepUsers) {
  console.log('[push] 重建用户相关表…')
  for (const t of [...USER_TABLES].reverse()) {
    try {
      await clearTable(t)
    } catch (e) {
      console.warn(t, e.message)
    }
  }
} else {
  console.log('[push] --keep-users：暂清空挂词进度表，稍后按 lemma 重挂')
  for (const t of WORD_USER_TABLES) {
    try {
      await clearTable(t)
    } catch (e) {
      console.warn(t, e.message)
    }
  }
}

console.log('[push] 覆盖内容表…')
for (const t of [...CONTENT_TABLES].reverse()) {
  try {
    await clearTable(t)
  } catch (e) {
    console.warn(t, e.message)
  }
}
for (const t of CONTENT_TABLES) {
  await copyTable(t)
}

if (!keepUsers) {
  for (const t of USER_TABLES) {
    await copyTable(t)
  }
} else {
  await restoreWordLinkedProgress(snap)
  console.log('[push] --keep-users：已保留 users / sessions，进度按词形重挂')
}

await setForeignKeys(true)

const words = await remote.execute('SELECT COUNT(*) AS c FROM words')
console.log('[push] remote words=', words.rows[0]?.c ?? words.rows[0]?.[0])
console.log('[push] 完成')
