/** API 根路径：开发 H5 用 /api（Vite 代理）；小程序生产构建用 .env.production */
function normalizeApiBase(base) {
  const trimmed = (base || '/api').replace(/\/+$/, '')
  return trimmed || '/api'
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE)

const TOKEN_KEY = 'auth_token'

export function getToken() {
  return uni.getStorageSync(TOKEN_KEY) || ''
}

export function setToken(token) {
  uni.setStorageSync(TOKEN_KEY, token)
}

export function clearToken() {
  uni.removeStorageSync(TOKEN_KEY)
}

function buildUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${p}`
}

function toError(payload, fallback) {
  if (payload instanceof Error) return payload
  const msg =
    (typeof payload === 'string' && payload) ||
    payload?.error ||
    payload?.errMsg ||
    payload?.message ||
    fallback
  return new Error(String(msg))
}

function request(path, options = {}) {
  const token = getToken()
  const header = {
    'Content-Type': 'application/json',
    ...(options.header || {}),
  }
  if (token) {
    header.Authorization = `Bearer ${token}`
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url: buildUrl(path),
      method: options.method || 'GET',
      data: options.data,
      header,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
          return
        }
        if (res.statusCode === 401) {
          clearToken()
          const code = res.data?.code
          if (code === 'TOKEN_EXPIRED') {
            uni.showToast({ title: '登录已过期', icon: 'none' })
            setTimeout(() => {
              import('./nav.js').then(({ safeReLaunch }) => {
                safeReLaunch('/pages/auth/login')
              })
            }, 600)
          }
        }
        reject(toError(res.data, `请求失败 (${res.statusCode})`))
      },
      fail(err) {
        reject(toError(err, '网络错误'))
      },
    })
  })
}

export function healthCheck() {
  return request('/health')
}

export function logout() {
  return request('/auth/logout', { method: 'POST' })
}

export function getSession() {
  return request('/auth/session')
}

export function login(nickname = '演示用户', password) {
  const data = { nickname }
  if (password !== undefined) data.password = password
  return request('/login', { method: 'POST', data })
}

export function register(nickname, password) {
  const data = { nickname }
  if (password !== undefined) data.password = password
  return request('/register', { method: 'POST', data })
}

/** 微信小程序：code 换 session（后端调微信 jscode2session） */
export function loginWechat(code, nickname) {
  return request('/auth/wechat', {
    method: 'POST',
    data: { code, nickname },
  })
}

/** 邮箱验证码：发送登录码 */
export function sendEmailOtp(email) {
  return request('/auth/email/send', {
    method: 'POST',
    data: { email },
  })
}

/** 邮箱验证码：验证并登录（首次自动注册） */
export function verifyEmailOtp(email, code) {
  return request('/auth/email/verify', {
    method: 'POST',
    data: { email, code },
  })
}

export function getApiBase() {
  return API_BASE
}

/** 文件上传根路径（uni.uploadFile 不走 Vite 代理） */
export function getUploadApiBase() {
  if (API_BASE.startsWith('http')) return API_BASE
  // #ifdef H5
  return 'http://localhost:3000/api'
  // #endif
  return API_BASE
}

export function uploadAvatar(filePath, nickname) {
  return new Promise((resolve, reject) => {
    const formData = {}
    if (nickname?.trim()) {
      formData.nickname = nickname.trim()
    }
    uni.uploadFile({
      url: `${getUploadApiBase()}/user/avatar`,
      filePath,
      name: 'file',
      formData,
      header: {
        Authorization: `Bearer ${getToken()}`,
      },
      success(res) {
        let data = {}
        try {
          data = JSON.parse(res.data || '{}')
        } catch {
          reject(new Error('上传响应解析失败'))
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data)
          return
        }
        reject(new Error(data.error || `上传失败 (${res.statusCode})`))
      },
      fail(err) {
        reject(new Error(err.errMsg || '上传失败'))
      },
    })
  })
}

export function updateProfile(data) {
  return request('/me/profile', { method: 'PATCH', data })
}

export function getMe() {
  return request('/me')
}

export function updateSettings(data) {
  return request('/settings', { method: 'PATCH', data })
}

export function getDailyWords(count) {
  const query = count ? `?count=${count}` : ''
  return request(`/words/daily${query}`)
}

export function submitAnswer(wordId, isCorrect, studyMode = 'new') {
  return request('/words/answer', {
    method: 'POST',
    data: { wordId, isCorrect, studyMode },
  })
}

export function getMistakes() {
  return request('/mistakes')
}

export function getStats() {
  return request('/stats')
}

export function finishSession() {
  return request('/session/finish', { method: 'POST' })
}

export function resetProgress() {
  return request('/dev/reset', { method: 'POST' })
}

export function resetToday() {
  return request('/dev/reset-today', { method: 'POST' })
}

export function getVocabularyTotal() {
  return request('/words')
}

export function getContentStatus() {
  return request('/content/status')
}

export function getReviewWords(mode = 'mistakes', count = 10) {
  return request(`/words/review?mode=${mode}&count=${count}`)
}

export function getExamPacks() {
  return request('/exams')
}

export function getExamWords(pack, count = 10) {
  return request(`/words/exam?pack=${pack}&count=${count}`)
}

export function getDictationWords(count = 10) {
  return request(`/words/dictation?count=${count}`)
}

export function checkDictationAnswer(wordId, answer) {
  return request('/words/dictation/check', {
    method: 'POST',
    data: { wordId, answer },
  })
}

export function getConfusables() {
  return request('/confusables')
}

export function getWordDetail(id) {
  return request(`/words/${id}`)
}
