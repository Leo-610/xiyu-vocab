const STORAGE_KEY = 'xiyu_vocab_state'

const defaultState = () => ({
  targetLevel: 'A2',
  dailyNew: 10,
  streakDays: 3,
  lastCheckin: new Date().toISOString().slice(0, 10),
  learnedIds: [],
  masteredIds: [],
  mistakes: [],
  todaySession: {
    date: new Date().toISOString().slice(0, 10),
    total: 0,
    correct: 0,
    wrong: 0,
    finished: false,
  },
  history: [],
})

export function loadState() {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (!raw) return defaultState()
    const state = JSON.parse(raw)
    const today = new Date().toISOString().slice(0, 10)
    if (state.todaySession?.date !== today) {
      state.todaySession = {
        date: today,
        total: 0,
        correct: 0,
        wrong: 0,
        finished: false,
      }
    }
    return { ...defaultState(), ...state }
  } catch {
    return defaultState()
  }
}

export function saveState(state) {
  uni.setStorageSync(STORAGE_KEY, JSON.stringify(state))
}

export function resetState() {
  uni.removeStorageSync(STORAGE_KEY)
}

export function recordAnswer(state, word, isCorrect) {
  const next = { ...state }
  next.todaySession = { ...next.todaySession, total: next.todaySession.total + 1 }

  if (isCorrect) {
    next.todaySession.correct += 1
    if (!next.learnedIds.includes(word.id)) {
      next.learnedIds = [...next.learnedIds, word.id]
    }
    next.mistakes = next.mistakes.filter((m) => m.wordId !== word.id)
  } else {
    next.todaySession.wrong += 1
    const exists = next.mistakes.find((m) => m.wordId === word.id)
    if (!exists) {
      next.mistakes = [
        {
          wordId: word.id,
          lemma: word.lemma,
          meaning_zh: word.meaning_zh,
          level: word.level,
          wrongAt: new Date().toISOString(),
        },
        ...next.mistakes,
      ]
    }
  }

  next.history = [
    {
      wordId: word.id,
      lemma: word.lemma,
      isCorrect,
      at: new Date().toISOString(),
    },
    ...next.history.slice(0, 199),
  ]

  saveState(next)
  return next
}

export function finishToday(state) {
  const next = { ...state }
  next.todaySession = { ...next.todaySession, finished: true }
  const today = new Date().toISOString().slice(0, 10)
  if (next.lastCheckin !== today) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yStr = yesterday.toISOString().slice(0, 10)
    next.streakDays = next.lastCheckin === yStr ? next.streakDays + 1 : 1
    next.lastCheckin = today
  }
  saveState(next)
  return next
}
