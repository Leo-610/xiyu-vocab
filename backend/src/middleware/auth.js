import db from '../db.js'
import { normalizeEmail } from '../services/emailOtp.js'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/** 会话有效期（天），大创试用场景默认 30 天 */
export const SESSION_TTL_DAYS = 30

export function resolveAuthType(user) {
  if (!user) return 'demo'
  if (user.auth_type === 'password' || String(user.openid || '').startsWith('acct_')) return 'password'
  if (user.email || String(user.openid || '').startsWith('email_')) return 'email'
  if (String(user.openid || '').startsWith('demo_')) return 'demo'
  return 'wechat'
}

export function isEmailUser(user) {
  return resolveAuthType(user) === 'email'
}

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
  if (fields.password_hash !== undefined) {
    sets.push('password_hash = ?')
    params.push(fields.password_hash)
  }
  if (fields.auth_type !== undefined) {
    sets.push('auth_type = ?')
    params.push(fields.auth_type)
  }

  params.push(userId)
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(String(password), salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  if (!stored || !String(stored).includes(':')) return false
  const [salt, hash] = String(stored).split(':')
  if (!salt || !hash) return false
  try {
    const expected = Buffer.from(hash, 'hex')
    const actual = scryptSync(String(password), salt, 64)
    if (expected.length !== actual.length) return false
    return timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

function sanitizePassword(password) {
  const pw = String(password || '')
  if (pw.length < 6) {
    const err = new Error('密码至少 6 位')
    err.code = 'INVALID_PASSWORD'
    throw err
  }
  if (pw.length > 64) {
    const err = new Error('密码不能超过 64 位')
    err.code = 'INVALID_PASSWORD'
    throw err
  }
  return pw
}

function accountOpenid(nickname) {
  const digest = createHash('sha256').update(nickname).digest('hex').slice(0, 16)
  return `acct_${digest}`
}

function findAccountUser(nickname) {
  const name = sanitizeNickname(nickname)
  const byNick = db.prepare(`
    SELECT * FROM users
    WHERE nickname = ?
      AND (openid LIKE 'acct_%' OR openid LIKE 'demo_%' OR auth_type IN ('password','demo'))
    ORDER BY CASE WHEN password_hash IS NOT NULL AND password_hash != '' THEN 0 ELSE 1 END
    LIMIT 1
  `).get(name)
  if (byNick) return byNick
  return db.prepare('SELECT * FROM users WHERE openid = ? OR openid = ?').get(
    accountOpenid(name),
    demoOpenid(name),
  )
}

/** 正式账号：注册（昵称 + 密码） */
export function registerPasswordUser(nickname, password) {
  const name = sanitizeNickname(nickname)
  if (name.length < 2) {
    const err = new Error('昵称至少 2 个字符')
    err.code = 'INVALID_NICKNAME'
    throw err
  }
  const pw = sanitizePassword(password)
  const existing = findAccountUser(name)
  if (existing) {
    const err = new Error('该昵称已被注册，请直接登录')
    err.code = 'NICKNAME_TAKEN'
    throw err
  }

  const token = createSessionToken()
  const expires = sessionExpiresAt()
  const loginAt = nowIso()
  const openid = accountOpenid(name)
  const passwordHash = hashPassword(pw)
  const result = db.prepare(`
    INSERT INTO users (
      openid, nickname, password_hash, session_token, streak_days,
      auth_type, last_login_at, token_expires_at
    ) VALUES (?, ?, ?, ?, 0, 'password', ?, ?)
  `).run(openid, name, passwordHash, token, loginAt, expires)

  return db.prepare('SELECT * FROM users WHERE id = ?').get(Number(result.lastInsertRowid))
}

/** 正式账号：登录（昵称 + 密码） */
export function loginPasswordUser(nickname, password) {
  const name = sanitizeNickname(nickname)
  const pw = sanitizePassword(password)
  const existing = findAccountUser(name)

  if (!existing) {
    const err = new Error('账号不存在，请先注册')
    err.code = 'USER_NOT_FOUND'
    throw err
  }

  if (existing.password_hash) {
    if (!verifyPassword(pw, existing.password_hash)) {
      const err = new Error('昵称或密码错误')
      err.code = 'INVALID_CREDENTIALS'
      throw err
    }
    return issueSession(existing.id, { auth_type: 'password' })
  }

  // 旧演示账号无密码：首次用密码登录时绑定密码，升级为正式账号
  return issueSession(existing.id, {
    password_hash: hashPassword(pw),
    auth_type: 'password',
  })
}

/** @deprecated 演示登录：仅昵称（须已注册） */
export function loginUser(nickname = '演示用户') {
  const name = sanitizeNickname(nickname)
  const existing = findAccountUser(name)

  if (!existing) {
    const err = new Error('账号不存在，请先注册')
    err.code = 'USER_NOT_FOUND'
    throw err
  }

  if (existing.password_hash) {
    const err = new Error('该账号已设置密码，请使用密码登录')
    err.code = 'PASSWORD_REQUIRED'
    throw err
  }

  return issueSession(existing.id, { nickname: name })
}

/** @deprecated 演示注册：仅昵称 */
export function registerUser(nickname = '演示用户') {
  const name = sanitizeNickname(nickname)
  const existing = findAccountUser(name)

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
  `).run(demoOpenid(name), name, token, loginAt, expires)

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

/** 邮箱验证码登录：已存在则刷新 token，否则自动注册 */
export function loginEmailUser(email) {
  const normalized = normalizeEmail(email)
  const openid = `email_${normalized}`
  const existing = db.prepare(`
    SELECT * FROM users WHERE email = ? OR openid = ?
  `).get(normalized, openid)

  if (existing) {
    if (!existing.email) {
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(normalized, existing.id)
    }
    return issueSession(existing.id)
  }

  const nickname = normalized.split('@')[0].slice(0, 32) || '学习者'
  const token = createSessionToken()
  const expires = sessionExpiresAt()
  const loginAt = nowIso()
  const result = db.prepare(`
    INSERT INTO users (openid, email, nickname, session_token, streak_days, auth_type, last_login_at, token_expires_at)
    VALUES (?, ?, ?, ?, 0, 'email', ?, ?)
  `).run(openid, normalized, nickname, token, loginAt, expires)

  return db.prepare('SELECT * FROM users WHERE id = ?').get(Number(result.lastInsertRowid))
}

export function formatAuthMeta(user) {
  return {
    authType: resolveAuthType(user),
    sessionExpiresAt: user.token_expires_at || null,
    lastLoginAt: user.last_login_at || null,
  }
}
