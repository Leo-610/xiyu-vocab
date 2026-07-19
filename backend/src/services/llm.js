import { createHash } from 'node:crypto'
import db from '../db.js'
import { retrieveExamplesForWord } from './rag.js'
import { getConfig } from '../config.js'

const CACHE_DAYS = 7

function promptHash(parts) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32)
}

function getLlmConfig() {
  const cfg = getConfig()
  const apiKey = process.env.AI_GATEWAY_API_KEY
    || process.env.OPENAI_API_KEY
    || process.env.VERCEL_AI_GATEWAY_API_KEY
    || ''
  const baseUrl = (process.env.AI_GATEWAY_BASE_URL
    || process.env.OPENAI_BASE_URL
    || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini'
  return {
    configured: Boolean(apiKey),
    apiKey,
    baseUrl,
    model,
    nodeEnv: cfg.nodeEnv,
  }
}

function templateExplain({ word, wrongChoice, examples }) {
  const cites = examples.slice(0, 3).map((e, i) => ({
    index: i + 1,
    text_es: e.text_es,
    source: e.source,
  }))
  const lines = [
    `「${word.lemma}」的正确释义是「${word.meaning_zh}」。`,
  ]
  if (wrongChoice) {
    lines.push(`你选的「${wrongChoice}」不是本义项的准确对应。`)
  }
  if (cites.length) {
    lines.push('结合语料语境：')
    for (const c of cites) {
      lines.push(`${c.index}. ${c.text_es}（出处：${c.source}）`)
    }
  } else {
    lines.push('当前语料库暂无匹配例句，请结合词卡释义继续复习。')
  }
  return {
    summary_zh: lines.join('\n'),
    citations: cites,
    insufficient_context: cites.length === 0,
    mode: 'template',
  }
}

async function callChatCompletions({ system, user }) {
  const { apiKey, baseUrl, model } = getLlmConfig()
  if (!apiKey) return null

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`LLM 调用失败 (${res.status}): ${text.slice(0, 200)}`)
    err.code = 'LLM_ERROR'
    throw err
  }
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || '{}'
  try {
    return { parsed: JSON.parse(content), model: data.model || model }
  } catch {
    return {
      parsed: {
        summary_zh: content,
        citations: [],
        insufficient_context: false,
      },
      model: data.model || model,
    }
  }
}

function findCachedReview(kind, wordId, hash) {
  const since = new Date()
  since.setDate(since.getDate() - CACHE_DAYS)
  return db.prepare(`
    SELECT * FROM ai_reviews
    WHERE kind = ? AND word_id = ? AND prompt_hash = ?
      AND status IN ('pending','approved')
      AND created_at >= ?
    ORDER BY CASE status WHEN 'approved' THEN 0 ELSE 1 END, created_at DESC
    LIMIT 1
  `).get(kind, wordId, hash, since.toISOString())
}

/**
 * 错题解析：必须基于 RAG chunks；无语料时标记 insufficient_context，不编造例句。
 */
export async function explainMistake({ wordId, wrongChoice, selectedText }) {
  const { word, examples } = retrieveExamplesForWord(wordId, 3)
  if (!word) {
    const err = new Error('单词不存在')
    err.code = 'NOT_FOUND'
    throw err
  }

  const hash = promptHash({
    kind: 'mistake_explain',
    wordId,
    lemma: word.lemma,
    wrongChoice: wrongChoice || selectedText || '',
    chunkIds: examples.map((e) => e.chunkId),
  })

  const cached = findCachedReview('mistake_explain', wordId, hash)
  if (cached) {
    let output
    try { output = JSON.parse(cached.output_json) } catch { output = { summary_zh: cached.output_json } }
    return {
      explanation: output,
      reviewId: cached.id,
      status: cached.status,
      cached: true,
      examples,
      llmConfigured: getLlmConfig().configured,
    }
  }

  let explanation
  let model = 'template'
  const llm = getLlmConfig()

  if (examples.length === 0) {
    explanation = templateExplain({ word, wrongChoice: wrongChoice || selectedText, examples })
  } else if (llm.configured) {
    const system = [
      '你是西语学习助手。只能基于用户提供的 chunks 解释错题。',
      '禁止编造未出现在 chunks 中的例句。',
      '输出严格 JSON：{"summary_zh":"...","citations":[{"index":1,"text_es":"...","source":"..."}],"insufficient_context":false}',
      '每条 citations 必须来自提供的 chunks，并标注 source。',
    ].join('')
    const user = JSON.stringify({
      lemma: word.lemma,
      meaning_zh: word.meaning_zh,
      wrong_choice: wrongChoice || selectedText || null,
      chunks: examples.map((e, i) => ({
        index: i + 1,
        text_es: e.text_es,
        text_zh: e.text_zh,
        source: e.source,
      })),
    }, null, 2)
    try {
      const result = await callChatCompletions({ system, user })
      if (result) {
        explanation = {
          summary_zh: result.parsed.summary_zh || '',
          citations: Array.isArray(result.parsed.citations) ? result.parsed.citations : [],
          insufficient_context: Boolean(result.parsed.insufficient_context),
          mode: 'llm',
        }
        model = result.model
      } else {
        explanation = templateExplain({ word, wrongChoice: wrongChoice || selectedText, examples })
      }
    } catch {
      explanation = templateExplain({ word, wrongChoice: wrongChoice || selectedText, examples })
      model = 'template-fallback'
    }
  } else {
    explanation = templateExplain({ word, wrongChoice: wrongChoice || selectedText, examples })
  }

  const insert = db.prepare(`
    INSERT INTO ai_reviews (kind, word_id, prompt_hash, model, input_json, output_json, status)
    VALUES ('mistake_explain', ?, ?, ?, ?, ?, 'pending')
  `).run(
    wordId,
    hash,
    model,
    JSON.stringify({ wrongChoice: wrongChoice || selectedText || null, examples }),
    JSON.stringify(explanation),
  )

  return {
    explanation,
    reviewId: Number(insert.lastInsertRowid),
    status: 'pending',
    cached: false,
    examples,
    llmConfigured: llm.configured,
  }
}

export function listAiReviews({ status = 'pending', limit = 50 } = {}) {
  const rows = db.prepare(`
    SELECT r.*, w.lemma, w.meaning_zh
    FROM ai_reviews r
    LEFT JOIN words w ON w.id = r.word_id
    WHERE (? = 'all' OR r.status = ?)
    ORDER BY r.created_at DESC
    LIMIT ?
  `).all(status, status, Math.min(limit, 100))

  return rows.map((r) => {
    let output = null
    let input = null
    try { output = JSON.parse(r.output_json) } catch { output = { summary_zh: r.output_json } }
    try { input = JSON.parse(r.input_json || 'null') } catch { input = null }
    return {
      id: r.id,
      kind: r.kind,
      wordId: r.word_id,
      lemma: r.lemma,
      meaning_zh: r.meaning_zh,
      model: r.model,
      status: r.status,
      reviewer: r.reviewer,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
      output,
      input,
    }
  })
}

export function reviewAiItem(id, { status, reviewer }) {
  if (!['approved', 'rejected'].includes(status)) {
    const err = new Error('status 须为 approved 或 rejected')
    err.code = 'INVALID_STATUS'
    throw err
  }
  const row = db.prepare('SELECT * FROM ai_reviews WHERE id = ?').get(id)
  if (!row) {
    const err = new Error('审核项不存在')
    err.code = 'NOT_FOUND'
    throw err
  }
  db.prepare(`
    UPDATE ai_reviews
    SET status = ?, reviewer = ?, reviewed_at = datetime('now')
    WHERE id = ?
  `).run(status, reviewer || 'admin', id)

  // 通过后：确保关联 example_cache 标记 approved
  if (status === 'approved' && row.word_id) {
    try {
      const input = JSON.parse(row.input_json || '{}')
      const chunks = input.examples || []
      const upsert = db.prepare(`
        INSERT INTO example_cache (word_id, chunk_id, rank, approved, note)
        VALUES (?, ?, ?, 1, 'ai-approved')
        ON CONFLICT(word_id, chunk_id) DO UPDATE SET approved = 1, note = 'ai-approved'
      `)
      chunks.forEach((e, i) => {
        if (e.chunkId) upsert.run(row.word_id, e.chunkId, i)
      })
    } catch { /* ignore */ }
  }

  return listAiReviews({ status: 'all', limit: 1 }).find((x) => x.id === id)
    || { id, status }
}

export function llmStatus() {
  const cfg = getLlmConfig()
  const pending = db.prepare(`SELECT COUNT(*) AS c FROM ai_reviews WHERE status = 'pending'`).get().c
  const approved = db.prepare(`SELECT COUNT(*) AS c FROM ai_reviews WHERE status = 'approved'`).get().c
  return {
    configured: cfg.configured,
    model: cfg.model,
    pendingReviews: pending,
    approvedReviews: approved,
  }
}
