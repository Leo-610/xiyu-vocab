import db from '../db.js';

const LIMITS = {
  email_signin: { limit: 5, windowMs: 60 * 60 * 1000 },
  email_otp_verify: { limit: 10, windowMs: 60 * 60 * 1000 }
};

function buildKey(scope, identifier) {
  return `${scope}:${identifier}`;
}

async function countRecent(key, windowMs) {
  const since = new Date(Date.now() - windowMs).toISOString();
  const row = await db.prepare(`
    SELECT COUNT(*) AS count FROM rate_limit_events
    WHERE key = ? AND created_at >= ?
  `).get(key, since);
  return row?.count || 0;
}

async function recordEvent(key) {
  await db.prepare('INSERT INTO rate_limit_events (key) VALUES (?)').run(key);
}

export async function checkRateLimit(scope, identifier) {
  const config = LIMITS[scope];
  if (!config) return { allowed: true };

  const key = buildKey(scope, identifier);
  const recent = await countRecent(key, config.windowMs);

  if (recent >= config.limit) {
    const messages = {
      email_signin: '发送过于频繁，请一小时后再试',
      email_otp_verify: '验证尝试过多，请一小时后再试'
    };
    return { allowed: false, error: messages[scope] || '操作过于频繁' };
  }

  await recordEvent(key);
  return { allowed: true };
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}