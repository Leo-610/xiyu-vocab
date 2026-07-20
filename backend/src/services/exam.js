import { formatWord, todayStr } from './learning.js';

/** 考试路径配置 — 底层仍用 words.tags 筛选，不改 DELE level 字段 */
export const EXAM_PACKS = {
  tem4: {
    id: 'tem4',
    title: '专四冲刺词包',
    subtitle: '国内专四考纲高频 · 看图四选一',
    tag: '专四'
  },
  tem8: {
    id: 'tem8',
    title: '专八高频词包',
    subtitle: '国内专八核心词汇 · 看图四选一',
    tag: '专八'
  }
};

function tagLikePattern(tag) {
  return `%"${tag}"%`;
}

async function mapWordRows(db, rows, studyMode) {
  const out = []
  for (const row of rows) {
    const options = await db.prepare(
      'SELECT option_text, is_correct FROM word_options WHERE word_id = ?'
    ).all(row.id)
    out.push({ ...formatWord(row, options), studyMode })
  }
  return out
}

export async function getExamPack(db, packId, userId, totalCount = 10) {
  const pack = EXAM_PACKS[packId];
  if (!pack) return null;

  const pattern = tagLikePattern(pack.tag);
  const today = todayStr();

  const reviewLimit = Math.min(Math.ceil(totalCount / 2), 5);
  const reviewRows = await db.prepare(`
    SELECT w.* FROM words w
    JOIN user_word_progress uwp ON uwp.word_id = w.id AND uwp.user_id = ?
    WHERE w.tags LIKE ?
      AND uwp.status = 'learning'
      AND date(uwp.next_review) <= date(?)
    ORDER BY uwp.next_review ASC
    LIMIT ?
  `).all(userId, pattern, today, reviewLimit);

  const remaining = Math.max(totalCount - reviewRows.length, 0);
  let newRows = [];
  if (remaining > 0) {
    newRows = await db.prepare(`
      SELECT w.* FROM words w
      LEFT JOIN user_word_progress uwp ON uwp.word_id = w.id AND uwp.user_id = ?
      WHERE w.tags LIKE ? AND uwp.id IS NULL
      ORDER BY RANDOM()
      LIMIT ?
    `).all(userId, pattern, remaining);
  }

  let extraRows = [];
  const have = reviewRows.length + newRows.length;
  if (have < totalCount) {
    const usedIds = [...reviewRows, ...newRows].map((r) => r.id);
    if (usedIds.length) {
      const ph = usedIds.map(() => '?').join(',');
      extraRows = await db.prepare(`
        SELECT w.* FROM words w
        JOIN user_word_progress uwp ON uwp.word_id = w.id AND uwp.user_id = ?
        WHERE w.tags LIKE ? AND w.id NOT IN (${ph})
        ORDER BY RANDOM()
        LIMIT ?
      `).all(userId, pattern, ...usedIds, totalCount - have);
    } else {
      extraRows = await db.prepare(`
        SELECT w.* FROM words w
        JOIN user_word_progress uwp ON uwp.word_id = w.id AND uwp.user_id = ?
        WHERE w.tags LIKE ?
        ORDER BY RANDOM()
        LIMIT ?
      `).all(userId, pattern, totalCount - have);
    }
  }

  const words = [
    ...(await mapWordRows(db, reviewRows, 'review')),
    ...(await mapWordRows(db, newRows, 'exam')),
    ...(await mapWordRows(db, extraRows, 'exam')),
  ]

  return {
    pack: {
      id: pack.id,
      title: pack.title,
      subtitle: pack.subtitle,
      tag: pack.tag,
    },
    words,
  }
}

export async function getExamSummaries(db, userId) {
  const out = []
  for (const pack of Object.values(EXAM_PACKS)) {
    const pattern = tagLikePattern(pack.tag)
    const total = (await db.prepare('SELECT COUNT(*) AS c FROM words WHERE tags LIKE ?').get(pattern)).c
    const learned = (await db.prepare(`
      SELECT COUNT(*) AS c FROM user_word_progress uwp
      JOIN words w ON w.id = uwp.word_id
      WHERE uwp.user_id = ? AND w.tags LIKE ?
        AND uwp.status IN ('learning', 'mastered')
    `).get(userId, pattern)).c
    out.push({
      id: pack.id,
      title: pack.title,
      subtitle: pack.subtitle,
      tag: pack.tag,
      total,
      learned,
      percent: total ? Math.round((learned / total) * 100) : 0,
    })
  }
  return out
}
