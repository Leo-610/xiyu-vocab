import { getContentStatus } from './content.js'
import { todayStr } from './learning.js'

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

/** 院内试用 / 大创中期数据汇总（管理后台导出） */
export function getPilotReport(db) {
  const today = todayStr()
  const weekAgo = daysAgo(7)
  const monthAgo = daysAgo(30)

  const usersTotal = db.prepare('SELECT COUNT(*) AS c FROM users').get().c
  const wechatUsers = db.prepare(`
    SELECT COUNT(*) AS c FROM users WHERE openid IS NOT NULL AND openid != ''
  `).get().c
  const active7d = db.prepare(`
    SELECT COUNT(DISTINCT user_id) AS c FROM daily_sessions
    WHERE session_date >= ?
  `).get(weekAgo).c
  const active30d = db.prepare(`
    SELECT COUNT(DISTINCT user_id) AS c FROM daily_sessions
    WHERE session_date >= ?
  `).get(monthAgo).c

  const sessionAgg = db.prepare(`
    SELECT
      COUNT(*) AS sessions,
      COALESCE(SUM(new_count + review_count), 0) AS wordsAnswered,
      COALESCE(SUM(correct_count), 0) AS correct,
      COALESCE(SUM(wrong_count), 0) AS wrong,
      COALESCE(SUM(finished), 0) AS finishedSessions
    FROM daily_sessions
  `).get()

  const wordsAnswered = sessionAgg.wordsAnswered || 0
  const accuracy = wordsAnswered > 0
    ? Math.round((sessionAgg.correct / wordsAnswered) * 100)
    : 0

  const checkinsTotal = db.prepare('SELECT COUNT(*) AS c FROM checkin_log').get().c
  const avgStreak = db.prepare(`
    SELECT ROUND(AVG(streak_days), 1) AS v FROM users WHERE streak_days > 0
  `).get().v || 0

  const wordsLearned = db.prepare(`
    SELECT COUNT(*) AS c FROM user_word_progress
    WHERE status IN ('learning', 'mastered')
  `).get().c
  const mistakesOpen = db.prepare(`
    SELECT COUNT(*) AS c FROM mistake_book WHERE resolved = 0
  `).get().c
  const dueReview = db.prepare(`
    SELECT COUNT(*) AS c FROM user_word_progress
    WHERE status = 'learning' AND date(next_review) <= date(?)
  `).get(today).c

  const levelLearned = db.prepare(`
    SELECT w.level, COUNT(*) AS learned
    FROM user_word_progress uwp
    JOIN words w ON w.id = uwp.word_id
    WHERE uwp.status IN ('learning', 'mastered')
    GROUP BY w.level
    ORDER BY w.level
  `).all()

  const dailyActive = db.prepare(`
    SELECT session_date AS date,
           COUNT(DISTINCT user_id) AS users,
           SUM(new_count + review_count) AS words
    FROM daily_sessions
    WHERE session_date >= ?
    GROUP BY session_date
    ORDER BY session_date ASC
  `).all(daysAgo(13))

  const topMistakes = db.prepare(`
    SELECT w.lemma, w.meaning_zh, w.level, COUNT(*) AS times
    FROM mistake_book mb
    JOIN words w ON w.id = mb.word_id
    GROUP BY mb.word_id
    ORDER BY times DESC
    LIMIT 10
  `).all()

  const content = getContentStatus()

  const armUsers = db.prepare(`
    SELECT COALESCE(experiment_arm, '?') AS arm, COUNT(*) AS users
    FROM users GROUP BY COALESCE(experiment_arm, '?')
  `).all()

  const experimentByArm = db.prepare(`
    SELECT
      COALESCE(u.experiment_arm, '?') AS arm,
      COUNT(DISTINCT u.id) AS users,
      COUNT(DISTINCT ds.user_id) AS activeUsers,
      COALESCE(SUM(ds.new_count + ds.review_count), 0) AS wordsAnswered,
      COALESCE(SUM(ds.correct_count), 0) AS correct,
      COALESCE(SUM(ds.wrong_count), 0) AS wrong,
      COALESCE(SUM(ds.finished), 0) AS finishedSessions
    FROM users u
    LEFT JOIN daily_sessions ds ON ds.user_id = u.id AND ds.session_date >= ?
    GROUP BY COALESCE(u.experiment_arm, '?')
    ORDER BY arm
  `).all(weekAgo).map((row) => {
    const answered = row.wordsAnswered || 0
    return {
      arm: row.arm,
      label: row.arm === 'A' ? '对照组（无 RAG/LLM）' : row.arm === 'B' ? '实验组（RAG+解析）' : '未分配',
      users: row.users,
      activeLast7Days: row.activeUsers,
      wordsAnswered: answered,
      accuracyPercent: answered > 0 ? Math.round((row.correct / answered) * 100) : 0,
      finishedSessions: row.finishedSessions,
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    period: { from: 'all', to: today },
    users: {
      total: usersTotal,
      wechat: wechatUsers,
      demo: usersTotal - wechatUsers,
      activeLast7Days: active7d,
      activeLast30Days: active30d,
      pilotTarget: 30,
      pilotProgress: `${active30d}/30`,
      byExperimentArm: armUsers,
    },
    learning: {
      sessions: sessionAgg.sessions,
      finishedSessions: sessionAgg.finishedSessions,
      wordsAnswered,
      accuracyPercent: accuracy,
      checkins: checkinsTotal,
      avgStreakDays: avgStreak,
      wordsLearned,
      mistakesOpen,
      dueReview,
    },
    experiment: {
      description: 'A=对照组（无 RAG/LLM UI）；B=实验组（可溯源例句+错题解析）。按 userId 奇偶分流。',
      last7DaysByArm: experimentByArm,
    },
    levelLearned,
    dailyActive,
    topMistakes,
    content: {
      wordsTotal: content.wordsTotal,
      targetTotal: content.targetTotal,
      gaps: content.gaps,
      corpus: content.corpus,
    },
    notes: [
      '本报告用于大创中期附件，截图请包含生成时间与用户数。',
      '试用达标建议：30 日内活跃 ≥30 人，人均答题 ≥50 词。',
      '对照实验见 experiment.last7DaysByArm；问卷分析见 docs/survey/analysis.md。',
    ],
  }
}
