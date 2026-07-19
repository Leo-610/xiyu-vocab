import * as api from './api.js'
import { performDemoLogin, performWechatLogin, performEmailSendOtp, performEmailVerifyOtp, performPasswordLogin, performPasswordRegister } from './authLogin.js'
import { safeReLaunch } from './nav.js'

const LAST_NICKNAME_KEY = 'last_nickname'
const LAST_EMAIL_KEY = 'last_email'
const LAST_ACCOUNT_KEY = 'last_account'

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
  estudiar: '📚', usted: '🎩',
}

let cachedState = null
let apiOnline = null
let authConfig = { email: false, password: true, demoLogin: true }

export function getAuthConfig() {
  return authConfig
}

export function getLastEmail() {
  try {
    return uni.getStorageSync(LAST_EMAIL_KEY) || ''
  } catch {
    return ''
  }
}

function saveLastEmail(email) {
  if (email) {
    uni.setStorageSync(LAST_EMAIL_KEY, email)
  }
}

function attachEmoji(word) {
  return { ...word, emoji: EMOJI_MAP[word.lemma] || '📝' }
}

function attachEmojiList(words) {
  return words.map(attachEmoji)
}

export function enrichWord(word) {
  return attachEmoji(word)
}

export async function checkApiOnline() {
  try {
    const health = await api.healthCheck()
    apiOnline = true
    authConfig = {
      email: Boolean(health?.auth?.email),
      password: health?.auth?.password !== false,
      demoLogin: health?.auth?.demoLogin !== false,
    }
  } catch {
    apiOnline = false
  }
  return apiOnline
}

export function isApiOnline() {
  return apiOnline === true
}

export function isLoggedIn() {
  return Boolean(api.getToken())
}

export function getLastNickname() {
  try {
    return uni.getStorageSync(LAST_NICKNAME_KEY) || ''
  } catch {
    return ''
  }
}

export function getLastAccount() {
  try {
    return uni.getStorageSync(LAST_ACCOUNT_KEY) || getLastEmail() || getLastNickname() || ''
  } catch {
    return ''
  }
}

function saveLastNickname(nickname) {
  if (nickname) {
    uni.setStorageSync(LAST_NICKNAME_KEY, nickname)
  }
}

function saveLastAccount(account) {
  if (account) {
    uni.setStorageSync(LAST_ACCOUNT_KEY, account)
  }
}

function applyAuthResponse(res) {
  api.setToken(res.token)
  cachedState = res.user
  if (res.user?.nickname) {
    saveLastNickname(res.user.nickname)
  }
  if (res.user?.email) {
    saveLastEmail(res.user.email)
    saveLastAccount(res.user.email)
  }
  if (res.user?.phone) {
    saveLastAccount(res.user.phone)
  }
  return cachedState
}

export async function sendEmailLoginCode(email) {
  const res = await performEmailSendOtp(email)
  saveLastEmail(email)
  return res
}

export async function loginWithEmailOtp(email, code) {
  const res = await performEmailVerifyOtp(email, code)
  saveLastEmail(email)
  return applyAuthResponse(res)
}

export async function loginWithAccount(account, password) {
  const res = await performPasswordLogin(account, password)
  saveLastAccount(account)
  return applyAuthResponse(res)
}

export async function registerWithAccount({ account, password, email, nickname }) {
  const res = await performPasswordRegister({ account, password, email, nickname })
  saveLastAccount(account)
  return applyAuthResponse(res)
}

/** @deprecated 使用 loginWithAccount */
export async function loginWithNickname(nickname, password) {
  if (password !== undefined && password !== null && String(password).length > 0) {
    return loginWithAccount(nickname, password)
  }
  const res = await performDemoLogin(nickname)
  return applyAuthResponse(res)
}

/** @deprecated 使用 registerWithAccount */
export async function registerWithNickname(nickname, password) {
  if (password !== undefined && password !== null && String(password).length > 0) {
    return registerWithAccount({ account: nickname, password })
  }
  const res = await api.register(nickname)
  return applyAuthResponse(res)
}

export async function loginWithWechat() {
  const res = await performWechatLogin()
  return applyAuthResponse(res)
}

export async function logout() {
  try {
    if (api.getToken()) {
      await api.logout()
    }
  } catch {
    // 网络失败也继续清本地态
  }
  api.clearToken()
  cachedState = null
  safeReLaunch('/pages/auth/login')
}

export async function requireAuth() {
  if (apiOnline === false) {
    throw new Error('OFFLINE')
  }
  if (!api.getToken()) {
    safeReLaunch('/pages/auth/login')
    throw new Error('UNAUTHORIZED')
  }
  try {
    return await getUserState(true)
  } catch {
    api.clearToken()
    cachedState = null
    safeReLaunch('/pages/auth/login')
    throw new Error('UNAUTHORIZED')
  }
}

export async function ensureAuth() {
  return requireAuth()
}

export async function getUserState(force = false) {
  if (apiOnline === false) {
    throw new Error('OFFLINE')
  }
  if (!force && cachedState) {
    return cachedState
  }
  if (!api.getToken()) {
    return ensureAuth()
  }
  cachedState = await api.getMe()
  return cachedState
}

export function getCachedState() {
  return cachedState
}

export function setCachedState(state) {
  cachedState = state
}

export async function updateTargetLevel(level) {
  cachedState = await api.updateSettings({ targetLevel: level })
  return cachedState
}

export async function fetchDailyPack(count) {
  const res = await api.getDailyWords(count)
  return {
    words: attachEmojiList(res.words || []),
    finished: res.finished || false,
    message: res.message,
  }
}

export async function submitWordAnswer(wordId, isCorrect, studyMode = 'new') {
  const res = await api.submitAnswer(wordId, isCorrect, studyMode)
  cachedState = res.state
  return res
}

export async function completeSession() {
  cachedState = await api.finishSession()
  return cachedState
}

export async function fetchMistakes() {
  const res = await api.getMistakes()
  return res.mistakes || []
}

export async function fetchStats() {
  const stats = await api.getStats()
  cachedState = stats
  return stats
}

export async function resetAllProgress() {
  cachedState = await api.resetProgress()
  return cachedState
}

export async function resetTodaySession() {
  cachedState = await api.resetToday()
  return cachedState
}

export async function fetchVocabularyTotal() {
  const res = await api.getVocabularyTotal()
  return res.total || 0
}

export async function fetchReviewPack(mode = 'mistakes', count = 10) {
  const res = await api.getReviewWords(mode, count)
  return {
    words: attachEmojiList(res.words || []),
    mode: res.mode,
  }
}

export async function fetchExamPacks() {
  const res = await api.getExamPacks()
  return res.packs || []
}

export async function fetchExamPack(packId, count = 10) {
  const res = await api.getExamWords(packId, count)
  return {
    pack: res.pack,
    words: attachEmojiList(res.words || []),
    empty: res.empty,
    message: res.message,
  }
}

export async function fetchDictationPack(count = 10) {
  const res = await api.getDictationWords(count)
  return { words: res.words || [], count: res.count || 0 }
}

export async function submitDictationAnswer(wordId, answer) {
  const res = await api.checkDictationAnswer(wordId, answer)
  cachedState = res.state
  return res
}

export async function fetchConfusables() {
  const res = await api.getConfusables()
  return res.pairs || []
}

export { getContentStatus } from './api.js'

export function shuffleOptions(word) {
  const opts = [...(word.options || [])]
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[opts[i], opts[j]] = [opts[j], opts[i]]
  }
  return opts
}

export function posLabel(pos) {
  const map = {
    n: '名词', v: '动词', adj: '形容词', adv: '副词',
    prep: '介词', pron: '代词', int: '感叹词',
  }
  return map[pos] || pos
}
