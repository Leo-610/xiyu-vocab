import db from '../db.js'

function parseLemmas(lemmasJson) {
  try {
    const arr = JSON.parse(lemmasJson || '[]')
    return Array.isArray(arr) ? arr.map((x) => String(x).toLowerCase()) : []
  } catch {
    return []
  }
}

function scoreChunk(chunk, lemma) {
  const L = lemma.toLowerCase()
  const lemmas = parseLemmas(chunk.lemmas_json)
  let score = 0
  if (lemmas.includes(L)) score += 3
  if (lemmas.some((x) => x.includes(L) || L.includes(x))) score += 1
  const text = String(chunk.text_es || '').toLowerCase()
  if (text.includes(` ${L} `) || text.startsWith(`${L} `) || text.endsWith(` ${L}`) || text === L) {
    score += 2
  } else if (text.includes(L)) {
    score += 1
  }
  return score
}

/** 按词形检索可溯源例句（词形命中；embedding 预留） */
export function retrieveExamplesForWord(wordId, k = 3) {
  const word = db.prepare('SELECT id, lemma, level, meaning_zh FROM words WHERE id = ?').get(wordId)
  if (!word) return { word: null, examples: [] }

  const limit = Math.min(Math.max(parseInt(k, 10) || 3, 1), 8)
  const lemma = String(word.lemma || '').toLowerCase()

  const cached = db.prepare(`
    SELECT c.id, c.source, c.level, c.text_es, c.text_zh, c.lemmas_json, ec.rank, ec.approved
    FROM example_cache ec
    JOIN corpus_chunks c ON c.id = ec.chunk_id
    WHERE ec.word_id = ? AND ec.approved = 1
    ORDER BY ec.rank ASC, c.id ASC
    LIMIT ?
  `).all(wordId, limit)

  if (cached.length) {
    return {
      word: { id: word.id, lemma: word.lemma, level: word.level, meaning_zh: word.meaning_zh },
      examples: cached.map((c, i) => ({
        chunkId: c.id,
        text_es: c.text_es,
        text_zh: c.text_zh,
        source: c.source,
        level: c.level,
        score: 10 - i,
        via: 'cache',
      })),
    }
  }

  const candidates = db.prepare(`
    SELECT id, source, level, text_es, text_zh, lemmas_json
    FROM corpus_chunks
    WHERE lower(lemmas_json) LIKE ?
       OR lower(text_es) LIKE ?
    LIMIT 80
  `).all(`%${lemma}%`, `%${lemma}%`)

  const ranked = candidates
    .map((c) => ({ ...c, score: scoreChunk(c, lemma) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .slice(0, limit)

  // 惰性写入 cache，便于下次与 admin 审核
  const insert = db.prepare(`
    INSERT OR IGNORE INTO example_cache (word_id, chunk_id, rank, approved)
    VALUES (?, ?, ?, 1)
  `)
  ranked.forEach((c, i) => insert.run(wordId, c.id, i))

  return {
    word: { id: word.id, lemma: word.lemma, level: word.level, meaning_zh: word.meaning_zh },
    examples: ranked.map((c) => ({
      chunkId: c.id,
      text_es: c.text_es,
      text_zh: c.text_zh,
      source: c.source,
      level: c.level,
      score: c.score,
      via: 'lemma',
    })),
  }
}

export function corpusStats() {
  const chunks = db.prepare('SELECT COUNT(*) AS c FROM corpus_chunks').get().c
  const linked = db.prepare('SELECT COUNT(*) AS c FROM example_cache').get().c
  return { chunks, linked }
}
