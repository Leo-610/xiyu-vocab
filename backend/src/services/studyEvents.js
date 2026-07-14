const DEFAULT_SETTINGS = {
  soundEnabled: true,
  vibrationEnabled: true,
  showIpa: true,
}

export function parseUserSettings(raw) {
  if (!raw) return { ...DEFAULT_SETTINGS }
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function serializeUserSettings(settings) {
  return JSON.stringify({ ...DEFAULT_SETTINGS, ...settings })
}

export function updateUserSettings(db, userId, partial) {
  const row = db.prepare('SELECT settings_json FROM users WHERE id = ?').get(userId)
  const next = { ...parseUserSettings(row?.settings_json), ...partial }
  db.prepare(`
    UPDATE users SET settings_json = ?, updated_at = datetime('now') WHERE id = ?
  `).run(serializeUserSettings(next), userId)
  return next
}

export function logStudyEvent(db, userId, {
  wordId,
  eventType = 'answer',
  isCorrect,
  studyMode = null,
  durationMs = null,
}) {
  db.prepare(`
    INSERT INTO study_events (user_id, word_id, event_type, is_correct, study_mode, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, wordId, eventType, isCorrect ? 1 : 0, studyMode, durationMs)
}

export function getStudySummary(db, userId, days = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().slice(0, 10)

  const agg = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(is_correct) AS correct,
      COUNT(DISTINCT date(created_at)) AS activeDays
    FROM study_events
    WHERE user_id = ? AND date(created_at) >= date(?)
  `).get(userId, sinceStr)

  const byMode = db.prepare(`
    SELECT study_mode AS mode, COUNT(*) AS count
    FROM study_events
    WHERE user_id = ? AND date(created_at) >= date(?)
    GROUP BY study_mode
    ORDER BY count DESC
  `).all(userId, sinceStr)

  const total = agg.total || 0
  return {
    periodDays: days,
    totalEvents: total,
    correctEvents: agg.correct || 0,
    accuracyPercent: total > 0 ? Math.round((agg.correct / total) * 100) : 0,
    activeDays: agg.activeDays || 0,
    byMode,
  }
}
