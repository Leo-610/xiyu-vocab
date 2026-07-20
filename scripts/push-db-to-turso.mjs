#!/usr/bin/env node
/**
 * 将本地 seed/live SQLite 灌入 Turso（生产持久库）
 *
 * 用法：
 *   export TURSO_DATABASE_URL=libsql://...
 *   export TURSO_AUTH_TOKEN=...
 *   node scripts/push-db-to-turso.mjs
 *   node scripts/push-db-to-turso.mjs --keep-users   # 不清空远端 users 相关表
 *
 * 默认覆盖词库/语料；用户表：无 --keep-users 时整库重建（首次灌库用）
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
  // 用本地 schema 的 CREATE（从 migrate/ensure）——直接读 seed 的 sqlite_master
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

console.log('[push] source=', sourcePath)
console.log('[push] target=', url)
await ensureRemoteSchema()

if (!keepUsers) {
  console.log('[push] 重建用户相关表…')
  for (const t of [...USER_TABLES].reverse()) {
    try { await clearTable(t) } catch (e) { console.warn(t, e.message) }
  }
}

console.log('[push] 覆盖内容表…')
for (const t of [...CONTENT_TABLES].reverse()) {
  try { await clearTable(t) } catch (e) { console.warn(t, e.message) }
}
for (const t of CONTENT_TABLES) {
  await copyTable(t)
}

if (!keepUsers) {
  for (const t of USER_TABLES) {
    await copyTable(t)
  }
} else {
  console.log('[push] --keep-users：跳过 users / progress 等表')
}

const words = await remote.execute('SELECT COUNT(*) AS c FROM words')
console.log('[push] remote words=', words.rows[0]?.c ?? words.rows[0]?.[0])
console.log('[push] 完成')
