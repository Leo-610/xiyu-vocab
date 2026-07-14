import wordsData from '../static/words.json'

const EMOJI_MAP = {
  hola: '👋', adiós: '👋', gracias: '🙏', 'por favor': '🙏',
  sí: '✅', no: '❌', yo: '🙋', tú: '👉', él: '👨', ella: '👩',
  nosotros: '👥', ser: '💫', estar: '📍', tener: '🤲', ir: '🚶',
  hablar: '🗣️', comer: '🍽️', beber: '🥤', vivir: '🏠', casa: '🏠',
  escuela: '🏫', libro: '📖', agua: '💧', comida: '🍲', amigo: '👦',
  amiga: '👧', familia: '👨‍👩‍👧', trabajo: '💼', tiempo: '⏰', día: '☀️',
  noche: '🌙', bueno: '👍', malo: '👎', grande: '🐘', pequeño: '🐭',
  nuevo: '✨', viejo: '📜', mucho: '📈', poco: '📉', aquí: '📍',
  allí: '👉', ahora: '⏱️', siempre: '♾️', nunca: '🚫', por: '↔️',
  para: '🎯', con: '🤝', sin: '🚫', ciudad: '🏙️', país: '🌍', español: '🇪🇸',
}

let cachedWords = null

export function getAllWords() {
  if (!cachedWords) {
    cachedWords = wordsData.words.map((w) => ({
      ...w,
      emoji: EMOJI_MAP[w.lemma] || '📝',
    }))
  }
  return cachedWords
}

export function getWordsByLevel(level) {
  const all = getAllWords()
  if (!level || level === 'ALL') return all
  const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const maxIdx = order.indexOf(level)
  if (maxIdx < 0) return all
  return all.filter((w) => order.indexOf(w.level) <= maxIdx)
}

export function getDailyPack(level, count, learnedIds = []) {
  const pool = getWordsByLevel(level).filter((w) => !learnedIds.includes(w.id))
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export function shuffleOptions(word) {
  const opts = [...word.options]
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[opts[i], opts[j]] = [opts[j], opts[i]]
  }
  return opts
}

export function getWordById(id) {
  return getAllWords().find((w) => w.id === id)
}

export function getLevelStats(level) {
  const words = getWordsByLevel(level)
  return {
    total: words.length,
    byLevel: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lv) => ({
      level: lv,
      count: words.filter((w) => w.level === lv).length,
    })),
  }
}
