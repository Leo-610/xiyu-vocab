import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from './db.js'
import { runMigrations } from './migrate.js'

runMigrations(db)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', '..')
/** 严格以同学义项表为准 */
const DEFAULT_CSV = path.join(ROOT, 'data', 'batches', 'A1', 'words_senses_team.csv')
const IMAGES_ROOT = path.join(ROOT, 'data', 'images')

function resolveImageUrl(imageFile, level) {
  if (!imageFile?.trim()) return null
  let file = imageFile.trim().replace(/^images\//, '')

  const candidates = [
    path.join(IMAGES_ROOT, file),
    path.join(IMAGES_ROOT, level || '', file),
    path.join(IMAGES_ROOT, 'A1', file),
    path.join(IMAGES_ROOT, 'tem4', file),
    path.join(IMAGES_ROOT, 'tem8', file),
    path.join(IMAGES_ROOT, 'exam', file),
  ]
  // 同 stem 兼容 .png / .jpg
  const stem = file.replace(/\.(png|jpg|jpeg|webp)$/i, '')
  for (const dir of ['', level || '', 'A1', 'tem4', 'tem8', 'exam']) {
    for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
      candidates.push(path.join(IMAGES_ROOT, dir, stem + ext))
    }
  }
  const found = candidates.find((p) => fs.existsSync(p))
  if (!found) return null

  const rel = path.relative(IMAGES_ROOT, found).split(path.sep).join('/')
  return `/static/images/${rel}`
}

function parseCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseTags(raw) {
  if (!raw?.trim()) return []
  return raw.replace(/\|/g, ',').split(',').map((t) => t.trim()).filter(Boolean)
}

function loadRows(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8').replace(/^\uFEFF/, '')
  const lines = content.split(/\r?\n/).filter((l) => l.trim())
  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const row = {}
    headers.forEach((h, i) => {
      row[h.trim()] = values[i]?.trim() ?? ''
    })
    return row
  })
}

export function seedWords(csvPath = DEFAULT_CSV) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV 不存在: ${csvPath}`)
  }

  const rows = loadRows(csvPath)
  const insertWord = db.prepare(`
    INSERT INTO words (lemma, pos, gender, level, sense, ipa, meaning_zh, meaning_en, example_es, example_zh, image_url, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(lemma, pos, sense) DO UPDATE SET
      level = excluded.level,
      meaning_zh = excluded.meaning_zh,
      meaning_en = excluded.meaning_en,
      example_es = excluded.example_es,
      example_zh = excluded.example_zh,
      image_url = excluded.image_url,
      tags = excluded.tags
  `)

  const getWordId = db.prepare(
    'SELECT id FROM words WHERE lemma = ? AND pos = ? AND sense = ?'
  )
  const deleteOptions = db.prepare('DELETE FROM word_options WHERE word_id = ?')
  const insertOption = db.prepare(
    'INSERT INTO word_options (word_id, option_text, is_correct) VALUES (?, ?, ?)'
  )

  let count = 0
  db.exec('BEGIN')
  try {
    for (const row of rows) {
      const lemma = row.lemma?.trim()
      if (!lemma) continue

      const genderRaw = (row.gender?.trim().toLowerCase() || 'n/a')
      const gender = ['m', 'f'].includes(genderRaw) ? genderRaw : 'n/a'
      const imageFile = row.image_file?.trim()
      const baseTags = parseTags(row.tags || '')
      const examTags = parseTags(row.exam_tags || '')
      const sense = Math.max(1, parseInt(row.sense, 10) || 1)
      if (sense > 1) baseTags.push(`义项${sense}`)
      const tags = JSON.stringify([...new Set([...baseTags, ...examTags])])
      const level = row.level?.trim().toUpperCase()
      const pos = row.pos?.trim() || ''

      insertWord.run(
        lemma,
        pos,
        gender,
        level,
        sense,
        row.ipa?.trim() || null,
        row.meaning_zh?.trim(),
        row.meaning_en?.trim() || null,
        row.example_es?.trim() || null,
        row.example_zh?.trim() || null,
        resolveImageUrl(imageFile, level),
        tags
      )

      const wordRow = getWordId.get(lemma, pos, sense)
      const wordId = wordRow.id

      deleteOptions.run(wordId)
      insertOption.run(wordId, row.meaning_zh?.trim(), 1)
      insertOption.run(wordId, row.distractor_1?.trim() || '待填写', 0)
      insertOption.run(wordId, row.distractor_2?.trim() || '待填写', 0)
      insertOption.run(wordId, row.distractor_3?.trim() || '待填写', 0)
      count += 1
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }

  return count
}

export function wordCount() {
  return db.prepare('SELECT COUNT(*) AS c FROM words').get().c
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isMain) {
  const csvArg = process.argv[2]
  const csvPath = csvArg ? path.resolve(csvArg) : DEFAULT_CSV
  const before = wordCount()
  const added = seedWords(csvPath)
  const after = wordCount()
  console.log(`词库导入完成: 处理 ${added} 行, 库中 ${after} 词 (原有 ${before})`)
}
