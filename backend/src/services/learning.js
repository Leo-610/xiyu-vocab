import { needsProfile } from './user.js'
import { resolveAuthType } from '../middleware/auth.js'
import { checkSpelling } from '../utils/spanish.js'
import { logStudyEvent, parseUserSettings, getStudySummary } from './studyEvents.js'
import { getExperimentArm, ragFeaturesEnabled } from './experiment.js'

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export function levelMaxIndex(level) {
  const idx = LEVEL_ORDER.indexOf(level)
  return idx >= 0 ? idx : LEVEL_ORDER.length - 1
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function getOrCreateDailySession(db, userId) {
  const today = todayStr()
  let session = db.prepare(
    'SELECT * FROM daily_sessions WHERE user_id = ? AND session_date = ?'
  ).get(userId, today)

  if (!session) {
    db.prepare(`
      INSERT INTO daily_sessions (user_id, session_date)
      VALUES (?, ?)
    `).run(userId, today)
    session = db.prepare(
      'SELECT * FROM daily_sessions WHERE user_id = ? AND session_date = ?'
    ).get(userId, today)
  }
  return session
}

export function buildUserState(db, userId) {
  const experimentArm = getExperimentArm(userId)
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  const session = getOrCreateDailySession(db, userId)
  const learned = db.prepare(`
    SELECT word_id FROM user_word_progress
    WHERE user_id = ? AND status IN ('learning', 'mastered')
  `).all(userId)

  const mistakes = db.prepare(`
    SELECT mb.word_id AS wordId, w.lemma, w.meaning_zh, w.level, mb.wrong_at AS wrongAt
    FROM mistake_book mb
    JOIN words w ON w.id = mb.word_id
    WHERE mb.user_id = ? AND mb.resolved = 0
    ORDER BY mb.wrong_at DESC
  `).all(userId)

  const dueReviewCount = db.prepare(`
    SELECT COUNT(*) AS c FROM user_word_progress
    WHERE user_id = ? AND status = 'learning' AND next_review <= ?
  `).get(userId, todayStr()).c

  return {
    userId: user.id,
    nickname: user.nickname,
    email: user.email || null,
    phone: user.phone || null,
    avatarUrl: user.avatar_url || null,
    experimentArm,
    ragEnabled: ragFeaturesEnabled(userId),
    isWechatUser: resolveAuthType(user) === 'wechat',
    authType: resolveAuthType(user),
    needsProfile: needsProfile(user),
    sessionExpiresAt: user.token_expires_at || null,
    lastLoginAt: user.last_login_at || null,
    privacyAgreedAt: user.privacy_agreed_at || null,
    settings: parseUserSettings(user.settings_json),
    targetLevel: user.target_level,
    dailyNew: user.daily_new,
    streakDays: user.streak_days,
    lastCheckin: user.last_checkin,
    dueReviewCount,
    learnedIds: learned.map((r) => r.word_id),
    masteredIds: db.prepare(`
      SELECT word_id FROM user_word_progress WHERE user_id = ? AND status = 'mastered'
    `).all(userId).map((r) => r.word_id),
    mistakes,
    todaySession: {
      date: session.session_date,
      total: session.new_count + session.review_count,
      newCount: session.new_count,
      reviewCount: session.review_count,
      correct: session.correct_count,
      wrong: session.wrong_count,
      finished: session.finished === 1,
    },
  }
}

export function formatWord(row, options) {
  let tags = []
  try {
    tags = row.tags ? JSON.parse(row.tags) : []
  } catch {
    tags = []
  }

  let conjugationPending = row.pos === 'v'
  let conjugation = null
  if (row.conjugation_json) {
    try {
      conjugation = JSON.parse(row.conjugation_json)
      conjugationPending = false
    } catch { /* pending */ }
  }

  return {
    id: row.id,
    lemma: row.lemma,
    pos: row.pos,
    gender: row.gender,
    level: row.level,
    sense: row.sense ?? 1,
    ipa: row.ipa,
    meaning_zh: row.meaning_zh,
    meaning_en: row.meaning_en,
    example_es: row.example_es,
    example_zh: row.example_zh,
    image_url: row.image_url,
    audio_url: row.audio_url,
    tags,
    conjugation,
    conjugationPending,
    options: options.map((o) => ({ text: o.option_text, correct: o.is_correct === 1 })),
  }
}

function mapWordRows(db, rows, studyMode) {
  return rows.map((row) => {
    const options = db.prepare(
      'SELECT option_text, is_correct FROM word_options WHERE word_id = ?'
    ).all(row.id)
    return { ...formatWord(row, options), studyMode }
  })
}

/** SM-2 混合词包：到期复习优先 + 新词 */
export function getMixedDailyPack(db, userId, totalCount = 10) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  const maxLevel = levelMaxIndex(user.target_level)
  const eligibleLevels = LEVEL_ORDER.slice(0, maxLevel + 1)
  const ph = eligibleLevels.map(() => '?').join(',')
  const today = todayStr()

  const reviewLimit = Math.min(Math.ceil(totalCount / 2), 5)
  const reviewRows = db.prepare(`
    SELECT w.* FROM words w
    JOIN user_word_progress uwp ON uwp.word_id = w.id AND uwp.user_id = ?
    WHERE w.level IN (${ph})
      AND uwp.status = 'learning'
      AND date(uwp.next_review) <= date(?)
    ORDER BY uwp.next_review ASC
    LIMIT ?
  `).all(userId, ...eligibleLevels, today, reviewLimit)

  const remaining = Math.max(totalCount - reviewRows.length, 0)
  let newRows = []
  if (remaining > 0) {
    // 优先抽「义项包」内容组词，再用普通词补齐
    const teamRows = db.prepare(`
      SELECT w.* FROM words w
      LEFT JOIN user_word_progress uwp ON uwp.word_id = w.id AND uwp.user_id = ?
      WHERE w.level IN (${ph}) AND uwp.id IS NULL
        AND w.tags LIKE '%义项包%'
      ORDER BY RANDOM()
      LIMIT ?
    `).all(userId, ...eligibleLevels, remaining)

    const need = remaining - teamRows.length
    let fillRows = []
    if (need > 0) {
      const used = teamRows.map((r) => r.id)
      if (used.length) {
        const uph = used.map(() => '?').join(',')
        fillRows = db.prepare(`
          SELECT w.* FROM words w
          LEFT JOIN user_word_progress uwp ON uwp.word_id = w.id AND uwp.user_id = ?
          WHERE w.level IN (${ph}) AND uwp.id IS NULL
            AND w.id NOT IN (${uph})
          ORDER BY RANDOM()
          LIMIT ?
        `).all(userId, ...eligibleLevels, ...used, need)
      } else {
        fillRows = db.prepare(`
          SELECT w.* FROM words w
          LEFT JOIN user_word_progress uwp ON uwp.word_id = w.id AND uwp.user_id = ?
          WHERE w.level IN (${ph}) AND uwp.id IS NULL
          ORDER BY RANDOM()
          LIMIT ?
        `).all(userId, ...eligibleLevels, need)
      }
    }
    newRows = [...teamRows, ...fillRows]
  }

  return [
    ...mapWordRows(db, reviewRows, 'review'),
    ...mapWordRows(db, newRows, 'new'),
  ]
}

/** 兼容旧接口 */
export function getDailyPack(db, userId, count = 10) {
  return getMixedDailyPack(db, userId, count)
}

/** 听写词包：不返回 lemma / 释义，避免泄题 */
export function formatWordForDictation(row, studyMode) {
  return {
    id: row.id,
    level: row.level,
    pos: row.pos,
    ipa: row.ipa,
    audio_url: row.audio_url,
    studyMode,
    /** 仅客户端发音用，作答前 UI 不得展示 */
    _speak: row.lemma,
  }
}

export function getDictationPack(db, userId, totalCount = 10) {
  const words = getMixedDailyPack(db, userId, totalCount)
  return words.map((w) => formatWordForDictation(
    db.prepare('SELECT * FROM words WHERE id = ?').get(w.id),
    w.studyMode,
  ))
}

/** 错题本专项复习 */
export function getMistakeReviewPack(db, userId, count = 10) {
  const rows = db.prepare(`
    SELECT w.* FROM mistake_book mb
    JOIN words w ON w.id = mb.word_id
    WHERE mb.user_id = ? AND mb.resolved = 0
    ORDER BY mb.wrong_at DESC
    LIMIT ?
  `).all(userId, count)
  return mapWordRows(db, rows, 'mistake')
}

function applySm2(db, userId, wordId, isCorrect) {
  const now = new Date().toISOString()
  const existing = db.prepare(
    'SELECT * FROM user_word_progress WHERE user_id = ? AND word_id = ?'
  ).get(userId, wordId)

  if (isCorrect) {
    let ease = existing?.ease_factor ?? 2.5
    let interval = existing?.interval_days ?? 0
    if (interval === 0) interval = 1
    else if (interval === 1) interval = 6
    else interval = Math.max(1, Math.round(interval * ease))
    ease = Math.min(2.5, ease + 0.08)
    const status = interval >= 21 ? 'mastered' : 'learning'

    db.prepare(`
      INSERT INTO user_word_progress
        (user_id, word_id, status, ease_factor, interval_days, next_review, last_review, wrong_count)
      VALUES (?, ?, ?, ?, ?, date('now', '+' || ? || ' day'), ?, COALESCE(?, 0))
      ON CONFLICT(user_id, word_id) DO UPDATE SET
        status = excluded.status,
        ease_factor = excluded.ease_factor,
        interval_days = excluded.interval_days,
        next_review = excluded.next_review,
        last_review = excluded.last_review
    `).run(userId, wordId, status, ease, interval, interval, now, existing?.wrong_count ?? 0)

    db.prepare(`
      UPDATE mistake_book SET resolved = 1
      WHERE user_id = ? AND word_id = ? AND resolved = 0
    `).run(userId, wordId)
  } else {
    const ease = Math.max(1.3, (existing?.ease_factor ?? 2.5) - 0.2)
    db.prepare(`
      INSERT INTO user_word_progress
        (user_id, word_id, status, ease_factor, interval_days, next_review, last_review, wrong_count)
      VALUES (?, ?, 'learning', ?, 0, date('now', '+1 day'), ?, COALESCE(?, 0) + 1)
      ON CONFLICT(user_id, word_id) DO UPDATE SET
        wrong_count = wrong_count + 1,
        ease_factor = excluded.ease_factor,
        interval_days = 0,
        next_review = date('now', '+1 day'),
        last_review = excluded.last_review,
        status = 'learning'
    `).run(userId, wordId, ease, now, existing?.wrong_count ?? 0)

    const mb = db.prepare(
      'SELECT id FROM mistake_book WHERE user_id = ? AND word_id = ? AND resolved = 0'
    ).get(userId, wordId)
    if (!mb) {
      db.prepare('INSERT INTO mistake_book (user_id, word_id) VALUES (?, ?)').run(userId, wordId)
    } else {
      db.prepare('UPDATE mistake_book SET wrong_at = datetime(\'now\') WHERE id = ?').run(mb.id)
    }
  }
}

/** 听写 / 考试路径：更新 SM-2 / 错题本，不计入今日「看图识词」配额 */
export function recordDictationAnswer(db, userId, wordId, isCorrect, studyMode = 'dictation') {
  applySm2(db, userId, wordId, isCorrect)
  logStudyEvent(db, userId, {
    wordId,
    eventType: studyMode === 'exam' ? 'exam' : 'dictation',
    isCorrect,
    studyMode,
  })
  const word = db.prepare('SELECT * FROM words WHERE id = ?').get(wordId)
  const options = db.prepare(
    'SELECT option_text, is_correct FROM word_options WHERE word_id = ?'
  ).all(wordId)
  return {
    isCorrect,
    word: { ...formatWord(word, options), studyMode },
    state: buildUserState(db, userId),
  }
}

export function checkDictationAnswer(db, userId, wordId, userInput) {
  const word = db.prepare('SELECT * FROM words WHERE id = ?').get(wordId)
  if (!word) return null
  const spelling = checkSpelling(userInput, word.lemma)
  return {
    ...recordDictationAnswer(db, userId, wordId, spelling.ok),
    spelling: {
      normalizedInput: spelling.normalizedInput,
      normalizedExpected: spelling.normalizedExpected,
      strictAccents: false,
    },
  }
}

export function recordAnswer(db, userId, wordId, isCorrect, studyMode = 'new') {
  if (studyMode === 'dictation' || studyMode === 'exam') {
    return recordDictationAnswer(db, userId, wordId, isCorrect, studyMode)
  }

  const session = getOrCreateDailySession(db, userId)
  const isReview = studyMode === 'review' || studyMode === 'mistake'

  if (isCorrect) {
    if (isReview) {
      db.prepare(`
        UPDATE daily_sessions
        SET review_count = review_count + 1, correct_count = correct_count + 1
        WHERE id = ?
      `).run(session.id)
    } else {
      db.prepare(`
        UPDATE daily_sessions
        SET new_count = new_count + 1, correct_count = correct_count + 1
        WHERE id = ?
      `).run(session.id)
    }
  } else if (isReview) {
    db.prepare(`
      UPDATE daily_sessions
      SET review_count = review_count + 1, wrong_count = wrong_count + 1
      WHERE id = ?
    `).run(session.id)
  } else {
    db.prepare(`
      UPDATE daily_sessions
      SET new_count = new_count + 1, wrong_count = wrong_count + 1
      WHERE id = ?
    `).run(session.id)
  }

  applySm2(db, userId, wordId, isCorrect)

  const eventType = studyMode === 'dictation' ? 'dictation'
    : studyMode === 'exam' ? 'exam'
      : (studyMode === 'review' || studyMode === 'mistake') ? 'review' : 'answer'
  logStudyEvent(db, userId, { wordId, eventType, isCorrect, studyMode })

  const word = db.prepare('SELECT * FROM words WHERE id = ?').get(wordId)
  const options = db.prepare(
    'SELECT option_text, is_correct FROM word_options WHERE word_id = ?'
  ).all(wordId)

  return {
    isCorrect,
    word: { ...formatWord(word, options), studyMode },
    state: buildUserState(db, userId),
  }
}

export function finishSession(db, userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  const today = todayStr()
  const session = getOrCreateDailySession(db, userId)

  db.prepare('UPDATE daily_sessions SET finished = 1 WHERE id = ?').run(session.id)

  const wordsDone = session.new_count + session.review_count
  db.prepare(`
    INSERT INTO checkin_log (user_id, checkin_date, words_done)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, checkin_date) DO UPDATE SET words_done = excluded.words_done
  `).run(userId, today, wordsDone)

  if (user.last_checkin !== today) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yStr = yesterday.toISOString().slice(0, 10)
    const streak = user.last_checkin === yStr ? user.streak_days + 1 : 1
    db.prepare(`
      UPDATE users SET streak_days = ?, last_checkin = ? WHERE id = ?
    `).run(streak, today, userId)
  }

  return buildUserState(db, userId)
}

export function getCheckinHistory(db, userId, days = 35) {
  const rows = db.prepare(`
    SELECT checkin_date AS date, words_done AS count
    FROM checkin_log WHERE user_id = ?
    ORDER BY checkin_date DESC LIMIT ?
  `).all(userId, days)

  const map = Object.fromEntries(rows.map((r) => [r.date, r.count]))
  const result = []
  const d = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(d)
    dt.setDate(dt.getDate() - i)
    const key = dt.toISOString().slice(0, 10)
    result.push({ date: key, count: map[key] || 0 })
  }
  return result
}

export function getStats(db, userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  const state = buildUserState(db, userId)
  const maxLevel = levelMaxIndex(user.target_level)
  const eligibleLevels = LEVEL_ORDER.slice(0, maxLevel + 1)

  const levelBars = eligibleLevels.map((level) => {
    const total = db.prepare('SELECT COUNT(*) AS c FROM words WHERE level = ?').get(level).c
    const learned = db.prepare(`
      SELECT COUNT(*) AS c FROM user_word_progress uwp
      JOIN words w ON w.id = uwp.word_id
      WHERE uwp.user_id = ? AND w.level = ? AND uwp.status IN ('learning', 'mastered')
    `).get(userId, level).c
    return { level, count: total, learned, target: total }
  })

  const vocabularyTotal = db.prepare(`
    SELECT COUNT(*) AS c FROM words WHERE level IN (${eligibleLevels.map(() => '?').join(',')})
  `).get(...eligibleLevels).c

  return {
    ...state,
    vocabularyTotal,
    levelBars,
    checkins: getCheckinHistory(db, userId, 35),
    studySummary: getStudySummary(db, userId, 30),
    accuracy: state.todaySession.total
      ? Math.round((state.todaySession.correct / state.todaySession.total) * 100)
      : 0,
  }
}

export function resetUserProgress(db, userId) {
  db.prepare('DELETE FROM user_word_progress WHERE user_id = ?').run(userId)
  db.prepare('DELETE FROM mistake_book WHERE user_id = ?').run(userId)
  db.prepare('DELETE FROM daily_sessions WHERE user_id = ?').run(userId)
  db.prepare('DELETE FROM checkin_log WHERE user_id = ?').run(userId)
  db.prepare(`
    UPDATE users SET streak_days = 0, last_checkin = NULL WHERE id = ?
  `).run(userId)
  return buildUserState(db, userId)
}

export function resetTodaySession(db, userId) {
  const today = todayStr()
  db.prepare(`
    DELETE FROM daily_sessions WHERE user_id = ? AND session_date = ?
  `).run(userId, today)
  return buildUserState(db, userId)
}
