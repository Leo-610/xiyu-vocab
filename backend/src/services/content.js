import db from '../db.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { formatWord } from './learning.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BATCHES_DIR = path.join(__dirname, '..', '..', 'data', 'batches')
const IMAGES_DIR = path.join(__dirname, '..', '..', 'data', 'images')

/** 各 DELE 等级目标词量 — 由西语同学分批填满 */
export const LEVEL_TARGETS = {
  A1: 800,
  A2: 1000,
  B1: 1200,
  B2: 1200,
  C1: 400,
  C2: 400,
}

export function getContentStatus() {
  const total = db.prepare('SELECT COUNT(*) AS c FROM words').get().c
  const withImage = db.prepare(`
    SELECT COUNT(*) AS c FROM words
    WHERE image_url IS NOT NULL AND image_url != ''
  `).get().c
  const withConjugation = db.prepare(`
    SELECT COUNT(*) AS c FROM words
    WHERE conjugation_json IS NOT NULL AND conjugation_json != ''
  `).get().c
  const withAudio = db.prepare(`
    SELECT COUNT(*) AS c FROM words
    WHERE audio_url IS NOT NULL AND audio_url != ''
  `).get().c

  const byLevel = db.prepare(`
    SELECT level, COUNT(*) AS count FROM words GROUP BY level
  `).all()

  const levelProgress = Object.entries(LEVEL_TARGETS).map(([level, target]) => {
    const row = byLevel.find((r) => r.level === level)
    const current = row?.count || 0
    const batchDir = path.join(BATCHES_DIR, level)
    const csvExists = fs.existsSync(path.join(batchDir, `words_${level}.csv`))
    const imageDir = path.join(IMAGES_DIR, level)
    const imageDirExists = fs.existsSync(imageDir)
    let imageCount = 0
    if (imageDirExists) {
      imageCount = fs.readdirSync(imageDir).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).length
    }
    return {
      level,
      target,
      current,
      percent: Math.round((current / target) * 100),
      csvSubmitted: csvExists,
      imagesDirReady: imageDirExists,
      imageCount,
      slot: `data/batches/${level}/words_${level}.csv`,
      imageSlot: `data/images/${level}/`,
    }
  })

  const confusablePending = db.prepare(`
    SELECT COUNT(*) AS c FROM confusable_pairs WHERE content_status = 'pending'
  `).get().c

  const targetTotal = Object.values(LEVEL_TARGETS).reduce((a, b) => a + b, 0)

  return {
    targetTotal,
    wordsTotal: total,
    gaps: {
      words: targetTotal - total,
      images: total - withImage,
      conjugations: db.prepare(`SELECT COUNT(*) AS c FROM words WHERE pos='v'`).get().c - withConjugation,
      audio: total - withAudio,
      confusableNotes: confusablePending,
    },
    levelProgress,
    teamTasks: [
      { owner: '西语同学A', task: '词库 CSV', path: 'data/batches/{A1-C2}/words_*.csv', status: total >= 50 ? '进行中' : '待开始' },
      { owner: '西语同学B', task: '配图', path: 'data/images/{A1-C2}/', status: withImage > 0 ? '进行中' : '待开始' },
      { owner: '西语同学A', task: '动词变位 JSON', path: 'words.conjugation_json 字段', status: withConjugation > 0 ? '进行中' : '待开始' },
      { owner: '西语同学A', task: '易混词辨析文案', path: 'confusable_pairs.note_zh', status: confusablePending > 0 ? '待填写' : '已完成' },
      { owner: '西语同学B', task: '用户调研问卷', path: 'docs/survey/questionnaire.md', status: '模板已就绪' },
    ],
  }
}

export function seedConfusablePairs() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM confusable_pairs').get().c
  if (count > 0) return 0

  const pairs = [
    ['ser', 'estar'],
    ['por', 'para'],
    ['mucho', 'poco'],
    ['bueno', 'malo'],
  ]

  const findId = db.prepare('SELECT id FROM words WHERE lemma = ? LIMIT 1')
  const insert = db.prepare(`
    INSERT INTO confusable_pairs (word_id_a, word_id_b, note_zh, content_status)
    VALUES (?, ?, ?, 'pending')
  `)

  let n = 0
  for (const [a, b] of pairs) {
    const wa = findId.get(a)
    const wb = findId.get(b)
    if (wa && wb) {
      insert.run(wa.id, wb.id, `【待西语同学A填写】${a} 与 ${b} 的辨析说明`)
      n += 1
    }
  }
  return n
}

export function getConfusablePairs() {
  return db.prepare(`
    SELECT cp.id, cp.note_zh, cp.note_es, cp.content_status,
           wa.lemma AS lemmaA, wa.meaning_zh AS meaningA, wa.level AS levelA,
           wb.lemma AS lemmaB, wb.meaning_zh AS meaningB, wb.level AS levelB
    FROM confusable_pairs cp
    JOIN words wa ON wa.id = cp.word_id_a
    JOIN words wb ON wb.id = cp.word_id_b
    ORDER BY cp.id
  `).all()
}

export function getWordDetail(dbConn, wordId) {
  const row = dbConn.prepare('SELECT * FROM words WHERE id = ?').get(wordId)
  if (!row) return null
  const options = dbConn.prepare(
    'SELECT option_text, is_correct FROM word_options WHERE word_id = ?'
  ).all(wordId)
  const word = formatWord(row, options)

  let conjugation = null
  let conjugationPending = true
  if (row.conjugation_json) {
    try {
      conjugation = JSON.parse(row.conjugation_json)
      conjugationPending = false
    } catch {
      conjugation = null
    }
  }

  return {
    ...word,
    conjugation,
    conjugationPending,
    audio_url: row.audio_url,
    hasImage: Boolean(row.image_url),
  }
}
