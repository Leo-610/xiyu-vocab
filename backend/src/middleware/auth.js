import db from '../db.js';
import { normalizeEmail } from '../services/emailOtp.js';
import { setExperimentArmForUser } from '../services/experiment.js';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

async function finalizeNewUser(userId) {
  await setExperimentArmForUser(userId);
  return await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

/** 会话有效期（天），大创试用场景默认 30 天 */
export const SESSION_TTL_DAYS = 30;

export function resolveAuthType(user) {
  if (!user) return 'demo';
  if (user.auth_type === 'password' || String(user.openid || '').startsWith('acct_')) return 'password';
  if (user.email || String(user.openid || '').startsWith('email_')) return 'email';
  if (String(user.openid || '').startsWith('demo_')) return 'demo';
  return 'wechat';
}

export function isEmailUser(user) {
  return resolveAuthType(user) === 'email';
}

export async function authMiddleware(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return { ok: false, status: 401, error: '未登录', code: 'UNAUTHORIZED' };
  }

  const user = await db.prepare('SELECT * FROM users WHERE session_token = ?').get(token);
  if (!user) {
    return { ok: false, status: 401, error: '登录已失效', code: 'INVALID_TOKEN' };
  }

  if (user.token_expires_at && new Date(user.token_expires_at) < new Date()) {
    await invalidateSession(user.id);
    return { ok: false, status: 401, error: '登录已过期，请重新登录', code: 'TOKEN_EXPIRED' };
  }

  return { ok: true, user };
}

export function createSessionToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function sessionExpiresAt() {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_TTL_DAYS);
  return d.toISOString();
}

function nowIso() {
  return new Date().toISOString();
}

export async function invalidateSession(userId) {
  await db.prepare(`
    UPDATE users SET session_token = NULL, token_expires_at = NULL WHERE id = ?
  `).run(userId);
}

async function issueSession(userId, fields = {}) {
  const token = createSessionToken();
  const expires = sessionExpiresAt();
  const loginAt = nowIso();

  const sets = ['session_token = ?', 'token_expires_at = ?', 'last_login_at = ?'];
  const params = [token, expires, loginAt];

  if (fields.nickname !== undefined) {
    sets.push('nickname = ?');
    params.push(fields.nickname);
  }
  if (fields.unionid !== undefined) {
    sets.push('unionid = ?');
    params.push(fields.unionid);
  }
  if (fields.password_hash !== undefined) {
    sets.push('password_hash = ?');
    params.push(fields.password_hash);
  }
  if (fields.auth_type !== undefined) {
    sets.push('auth_type = ?');
    params.push(fields.auth_type);
  }

  params.push(userId);
  await db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !String(stored).includes(':')) return false;
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  try {
    const expected = Buffer.from(hash, 'hex');
    const actual = scryptSync(String(password), salt, 64);
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function requirePasswordPresent(password) {
  const pw = String(password || '');
  if (!pw) {
    const err = new Error('请输入密码');
    err.code = 'INVALID_PASSWORD';
    throw err;
  }
  if (pw.length > 64) {
    const err = new Error('密码不能超过 64 位');
    err.code = 'INVALID_PASSWORD';
    throw err;
  }
  return pw;
}

/** 注册用：须含大小写字母与数字，至少 8 位 */
function sanitizeStrongPassword(password) {
  const pw = requirePasswordPresent(password);
  if (pw.length < 8) {
    const err = new Error('密码至少 8 位');
    err.code = 'INVALID_PASSWORD';
    throw err;
  }
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) {
    const err = new Error('密码须同时包含大写字母、小写字母和数字');
    err.code = 'WEAK_PASSWORD';
    throw err;
  }
  return pw;
}

function normalizePhone(phone) {
  let raw = String(phone || '').trim().replace(/[\s\-()]/g, '');
  if (raw.startsWith('+86')) raw = raw.slice(3);
  if (raw.startsWith('0086')) raw = raw.slice(4);
  return raw;
}

function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

/**
 * 解析登录/注册账号：邮箱 或 手机号
 * @returns {{ kind: 'email'|'phone', email: string|null, phone: string|null, accountKey: string }}
 */
export function parseAccount(account) {
  const raw = String(account || '').trim();
  if (!raw) {
    const err = new Error('请输入邮箱或手机号');
    err.code = 'INVALID_ACCOUNT';
    throw err;
  }
  if (raw.includes('@')) {
    const email = normalizeEmail(raw);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const err = new Error('请输入有效的邮箱地址');
      err.code = 'INVALID_EMAIL';
      throw err;
    }
    return { kind: 'email', email, phone: null, accountKey: email };
  }
  const phone = normalizePhone(raw);
  if (!isValidPhone(phone)) {
    const err = new Error('请输入有效的手机号（11 位）');
    err.code = 'INVALID_PHONE';
    throw err;
  }
  return { kind: 'phone', email: null, phone, accountKey: phone };
}

function accountOpenidFromKey(accountKey) {
  const digest = createHash('sha256').update(String(accountKey)).digest('hex').slice(0, 16);
  return `acct_${digest}`;
}

/** @deprecated 旧昵称账号 openid */
function accountOpenid(nickname) {
  return accountOpenidFromKey(nickname);
}

async function findAccountUserByCredentials(account, nicknameFallback) {
  if (account) {
    try {
      const parsed = parseAccount(account);
      if (parsed.kind === 'email') {
        const byEmail = await db.prepare(`
          SELECT * FROM users WHERE email = ? OR openid = ?
          LIMIT 1
        `).get(parsed.email, `email_${parsed.email}`);
        if (byEmail) return byEmail;
        return await db.prepare('SELECT * FROM users WHERE openid = ?').get(accountOpenidFromKey(parsed.email));
      }
      const byPhone = await db.prepare('SELECT * FROM users WHERE phone = ? LIMIT 1').get(parsed.phone);
      if (byPhone) return byPhone;
      return await db.prepare('SELECT * FROM users WHERE openid = ?').get(accountOpenidFromKey(parsed.phone));
    } catch (err) {
      if (err.code === 'INVALID_ACCOUNT' || err.code === 'INVALID_EMAIL' || err.code === 'INVALID_PHONE') {
        throw err;
      }
    }
  }

  // 兼容旧版：昵称登录
  if (!nicknameFallback) return null;
  const name = sanitizeNickname(nicknameFallback);
  const byNick = await db.prepare(`
    SELECT * FROM users
    WHERE nickname = ?
      AND (openid LIKE 'acct_%' OR openid LIKE 'demo_%' OR auth_type IN ('password','demo'))
    ORDER BY CASE WHEN password_hash IS NOT NULL AND password_hash != '' THEN 0 ELSE 1 END
    LIMIT 1
  `).get(name);
  if (byNick) return byNick;
  return await db.prepare('SELECT * FROM users WHERE openid = ? OR openid = ?').get(
    accountOpenid(name),
    demoOpenid(name)
  );
}

async function findAccountUser(nickname) {
  return await findAccountUserByCredentials(null, nickname);
}

/**
 * 正式账号注册：账号（邮箱或手机号）+ 密码
 * 手机号注册须同时绑定邮箱
 * registerPasswordUser({ account, password, email?, nickname? })
 * 或兼容旧调用 registerPasswordUser(nickname, password) —— 将昵称当作非法账号时回退不可用，请传 account
 */
export async function registerPasswordUser(accountOrOpts, passwordMaybe, extras = {}) {
  let account;
  let nicknameOpt;
  let bindEmail;
  let password = passwordMaybe;

  if (accountOrOpts && typeof accountOrOpts === 'object') {
    account = accountOrOpts.account;
    nicknameOpt = accountOrOpts.nickname;
    bindEmail = accountOrOpts.email;
    password = accountOrOpts.password;
  } else {
    account = extras.account ?? accountOrOpts;
    nicknameOpt = extras.nickname;
    bindEmail = extras.email;
  }

  const parsed = parseAccount(account);
  const pw = sanitizeStrongPassword(password);

  let email = parsed.email;
  let phone = parsed.phone;

  if (parsed.kind === 'phone') {
    if (!bindEmail) {
      const err = new Error('手机号注册须绑定邮箱');
      err.code = 'EMAIL_REQUIRED';
      throw err;
    }
    email = normalizeEmail(bindEmail);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const err = new Error('请输入有效的绑定邮箱');
      err.code = 'INVALID_EMAIL';
      throw err;
    }
  }

  const emailTaken = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (emailTaken) {
    const err = new Error('该邮箱已被注册，请直接登录');
    err.code = 'EMAIL_TAKEN';
    throw err;
  }
  if (phone) {
    const phoneTaken = await db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (phoneTaken) {
      const err = new Error('该手机号已被注册，请直接登录');
      err.code = 'PHONE_TAKEN';
      throw err;
    }
  }

  const openidKey = email;
  const openid = accountOpenidFromKey(openidKey);
  if (await db.prepare('SELECT id FROM users WHERE openid = ?').get(openid)) {
    const err = new Error('该账号已被注册，请直接登录');
    err.code = 'ACCOUNT_TAKEN';
    throw err;
  }

  let name = nicknameOpt ? String(nicknameOpt).trim() : '';
  if (!name) {
    name = parsed.kind === 'email' ?
    email.split('@')[0].slice(0, 32) :
    `用户${phone.slice(-4)}`;
  }
  if (name.length < 2) name = '学习者';
  if (name.length > 32) name = name.slice(0, 32);

  const token = createSessionToken();
  const expires = sessionExpiresAt();
  const loginAt = nowIso();
  const passwordHash = hashPassword(pw);
  const result = await db.prepare(`
    INSERT INTO users (
      openid, email, phone, nickname, password_hash, session_token, streak_days,
      auth_type, last_login_at, token_expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 'password', ?, ?)
  `).run(openid, email, phone, name, passwordHash, token, loginAt, expires);

  return await finalizeNewUser(Number(result.lastInsertRowid));
}

/**
 * 正式账号登录：邮箱或手机号 + 密码（兼容旧昵称）
 * loginPasswordUser({ account, password }) 或 loginPasswordUser(nickname, password)
 */
export async function loginPasswordUser(accountOrOpts, passwordMaybe) {
  let account = null;
  let nicknameFallback = null;
  let password = passwordMaybe;

  if (accountOrOpts && typeof accountOrOpts === 'object') {
    account = accountOrOpts.account || null;
    nicknameFallback = accountOrOpts.nickname || null;
    password = accountOrOpts.password;
  } else {
    const raw = String(accountOrOpts || '').trim();
    if (raw.includes('@') || /^1[3-9]\d{9}$/.test(normalizePhone(raw))) {
      account = raw;
    } else {
      nicknameFallback = raw;
    }
  }

  const pw = requirePasswordPresent(password);
  const existing = await findAccountUserByCredentials(account, nicknameFallback);

  if (!existing) {
    const err = new Error('账号不存在，请先注册');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  if (existing.password_hash) {
    if (!verifyPassword(pw, existing.password_hash)) {
      const err = new Error('账号或密码错误');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }
    return await issueSession(existing.id, { auth_type: 'password' });
  }

  // 旧演示账号无密码：首次用密码登录时绑定密码（仍要求强度）
  const strong = sanitizeStrongPassword(pw);
  return await issueSession(existing.id, {
    password_hash: hashPassword(strong),
    auth_type: 'password'
  });
}

/** @deprecated 演示登录：仅昵称（须已注册） */
export async function loginUser(nickname = '演示用户') {
  const name = sanitizeNickname(nickname);
  const existing = await findAccountUser(name);

  if (!existing) {
    const err = new Error('账号不存在，请先注册');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  if (existing.password_hash) {
    const err = new Error('该账号已设置密码，请使用密码登录');
    err.code = 'PASSWORD_REQUIRED';
    throw err;
  }

  return await issueSession(existing.id, { nickname: name });
}

/** @deprecated 演示注册：仅昵称 */
export async function registerUser(nickname = '演示用户') {
  const name = sanitizeNickname(nickname);
  const existing = await findAccountUser(name);

  if (existing) {
    const err = new Error('该昵称已被注册，请直接登录');
    err.code = 'NICKNAME_TAKEN';
    throw err;
  }

  const token = createSessionToken();
  const expires = sessionExpiresAt();
  const loginAt = nowIso();
  const result = await db.prepare(`
    INSERT INTO users (openid, nickname, session_token, streak_days, auth_type, last_login_at, token_expires_at)
    VALUES (?, ?, ?, 0, 'demo', ?, ?)
  `).run(demoOpenid(name), name, token, loginAt, expires);

  return await finalizeNewUser(Number(result.lastInsertRowid));
}

function sanitizeNickname(nickname) {
  const name = String(nickname || '').trim();
  if (!name) {
    const err = new Error('请输入昵称');
    err.code = 'INVALID_NICKNAME';
    throw err;
  }
  if (name.length > 32) {
    const err = new Error('昵称不能超过 32 字');
    err.code = 'INVALID_NICKNAME';
    throw err;
  }
  return name;
}

function demoOpenid(nickname) {
  return `demo_${nickname}`;
}

/** 微信 openid 登录：已存在则刷新 token，否则注册 */
export async function loginWechatUser(openid, nickname = '微信用户', unionid = null) {
  const existing = await db.prepare('SELECT * FROM users WHERE openid = ?').get(openid);

  if (existing) {
    const nextNickname = nickname && nickname !== '微信用户' ? nickname : existing.nickname;
    return await issueSession(existing.id, {
      nickname: nextNickname || '微信用户',
      unionid: unionid || existing.unionid
    });
  }

  const token = createSessionToken();
  const expires = sessionExpiresAt();
  const loginAt = nowIso();
  const result = await db.prepare(`
    INSERT INTO users (openid, unionid, nickname, session_token, streak_days, auth_type, last_login_at, token_expires_at)
    VALUES (?, ?, ?, ?, 0, 'wechat', ?, ?)
  `).run(openid, unionid, nickname || '微信用户', token, loginAt, expires);

  return await finalizeNewUser(Number(result.lastInsertRowid));
}

export async function logoutUser(userId) {
  await invalidateSession(userId);
  return { ok: true };
}

export async function findUserByToken(token) {
  return await db.prepare('SELECT * FROM users WHERE session_token = ?').get(token);
}

/** 邮箱验证码登录：已存在则刷新 token，否则自动注册 */
export async function loginEmailUser(email) {
  const normalized = normalizeEmail(email);
  const openid = `email_${normalized}`;
  const existing = await db.prepare(`
    SELECT * FROM users WHERE email = ? OR openid = ?
  `).get(normalized, openid);

  if (existing) {
    if (!existing.email) {
      await db.prepare('UPDATE users SET email = ? WHERE id = ?').run(normalized, existing.id);
    }
    return await issueSession(existing.id);
  }

  const nickname = normalized.split('@')[0].slice(0, 32) || '学习者';
  const token = createSessionToken();
  const expires = sessionExpiresAt();
  const loginAt = nowIso();
  const result = await db.prepare(`
    INSERT INTO users (openid, email, nickname, session_token, streak_days, auth_type, last_login_at, token_expires_at)
    VALUES (?, ?, ?, ?, 0, 'email', ?, ?)
  `).run(openid, normalized, nickname, token, loginAt, expires);

  return await finalizeNewUser(Number(result.lastInsertRowid));
}

export function formatAuthMeta(user) {
  return {
    authType: resolveAuthType(user),
    sessionExpiresAt: user.token_expires_at || null,
    lastLoginAt: user.last_login_at || null
  };
}