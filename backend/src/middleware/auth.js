import db from '../db.js'

/** 会话有效期（天），大创试用场景默认 30 天 */
export const SESSION_TTL_DAYS = 30

export function authMiddleware(req) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return { ok: false, status: 401, error: '未登录', code: 'UNAUTHORIZED' }
  }

  const user = db.prepare('SELECT * FROM users WHERE session_token = ?').get(token)
  if (!user) {
    return { ok: false, status: 401, error: '登录已失效', code: 'INVALID_TOKEN' }
  }

  if (user.token_expires_at && new Date(user.token_expires_at) < new Date()) {
    invalidateSession(user.id)
    return { ok: false, status: 401, error: '登录已过期，请重新登录', code: 'TOKEN_EXPIRED' }
  }

  return { ok: true, user }
}

export function createSessionToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function sessionExpiresAt() {
  const d = new Date()
  d.setDate(d.getDate() + SESSION_TTL_DAYS)
  return d.toISOString()
}

function nowIso() {
  return new Date().toISOString()
}

export function invalidateSession(userId) {
  db.prepare(`
    UPDATE users SET session_token = NULL, token_expires_at = NULL WHERE id = ?
  `).run(userId)
}

function issueSession(userId, fields = {}) {
  const token = createSessionToken()
  const expires = sessionExpiresAt()
  const loginAt = nowIso()

  const sets = ['session_token = ?', 'token_expires_at = ?', 'last_login_at = ?']
  const params = [token, expires, loginAt]

  if (fields.nickname !== undefined) {
    sets.push('nickname = ?')
    params.push(fields.nickname)
  }
  if (fields.unionid !== undefined) {
    sets.push('unionid = ?')
    params.push(fields.unionid)
  }

  params.push(userId)
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
}

export function loginUser(nickname = '演示用户') {
  const name = sanitizeNickname(nickname)
  const openid = demoOpenid(name)
  const existing = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid)

  if (!existing) {
    const err = new Error('账号不存在，请先注册')
    err.code = 'USER_NOT_FOUND'
    throw err
  }

  return issueSession(existing.id, { nickname: name })
}

export function registerUser(nickname = '演示用户') {
  const name = sanitizeNickname(nickname)
  const openid = demoOpenid(name)
  const existing = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid)

  if (existing) {
    const err = new Error('该昵称已被注册，请直接登录')
    err.code = 'NICKNAME_TAKEN'
    throw err
  }

  const token = createSessionToken()
  const expires = sessionExpiresAt()
  const loginAt = nowIso()
  const result = db.prepare(`
    INSERT INTO users (openid, nickname, session_token, streak_days, auth_type, last_login_at, token_expires_at)
    VALUES (?, ?, ?, 0, 'demo', ?, ?)
  `).run(openid, name, token, loginAt, expires)

  return db.prepare('SELECT * FROM users WHERE id = ?').get(Number(result.lastInsertRowid))
}

function sanitizeNickname(nickname) {
  const name = String(nickname || '').trim()
  if (!name) {
    const err = new Error('请输入昵称')
    err.code = 'INVALID_NICKNAME'
    throw err
  }
  if (name.length > 32) {
    const err = new Error('昵称不能超过 32 字')
    err.code = 'INVALID_NICKNAME'
    throw err
  }
  return name
}

function demoOpenid(nickname) {
  return `demo_${nickname}`
}

/** 微信 openid 登录：已存在则刷新 token，否则注册 */
export function loginWechatUser(openid, nickname = '微信用户', unionid = null) {
  const existing = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid)

  if (existing) {
    const nextNickname = nickname && nickname !== '微信用户' ? nickname : existing.nickname
    return issueSession(existing.id, {
      nickname: nextNickname || '微信用户',
      unionid: unionid || existing.unionid,
    })
  }

  const token = createSessionToken()
  const expires = sessionExpiresAt()
  const loginAt = nowIso()
  const result = db.prepare(`
    INSERT INTO users (openid, unionid, nickname, session_token, streak_days, auth_type, last_login_at, token_expires_at)
    VALUES (?, ?, ?, ?, 0, 'wechat', ?, ?)
  `).run(openid, unionid, nickname || '微信用户', token, loginAt, expires)

  return db.prepare('SELECT * FROM users WHERE id = ?').get(Number(result.lastInsertRowid))
}

export function logoutUser(userId) {
  invalidateSession(userId)
  return { ok: true }
}

export function findUserByToken(token) {
  return db.prepare('SELECT * FROM users WHERE session_token = ?').get(token)
}

export function formatAuthMeta(user) {
  const isDemo = !user.openid || String(user.openid).startsWith('demo_')
  return {
    authType: isDemo ? 'demo' : 'wechat',
    sessionExpiresAt: user.token_expires_at || null,
    lastLoginAt: user.last_login_at || null,
  }
}
