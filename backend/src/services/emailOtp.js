import { randomInt } from 'node:crypto';
import db from '../db.js';
import { sendResendEmail } from './resend.js';

const OTP_TTL_MS = 10 * 60 * 1000;

function generateOtpCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function sendEmailLoginOtp(email) {
  const normalized = normalizeEmail(email);
  const code = generateOtpCode();
  const expires = new Date(Date.now() + OTP_TTL_MS).toISOString();
  const minutes = OTP_TTL_MS / 60000;

  await db.prepare('DELETE FROM verification_tokens WHERE identifier = ?').run(normalized);
  await db.prepare(`
    INSERT INTO verification_tokens (identifier, token, expires)
    VALUES (?, ?, ?)
  `).run(normalized, code, expires);

  const result = await sendResendEmail({
    to: normalized,
    subject: `【西语背单词】登录验证码 ${code}`,
    text: `你的登录验证码是 ${code}，${minutes} 分钟内有效。请在登录页输入验证码，勿将验证码转发给他人。`,
    html: `
      <div style="font-family:sans-serif;line-height:1.6;color:#1a1a2e">
        <p style="font-size:16px;margin:0 0 12px">西语背单词登录验证码</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:0.2em;margin:16px 0;color:#c1121f">${code}</p>
        <p style="font-size:14px;color:#555;margin:0 0 8px">验证码 ${minutes} 分钟内有效。</p>
        <p style="font-size:12px;color:#888;margin:16px 0 0">请勿在微信内点击可疑链接；本邮件仅含验证码，无需点击任何按钮。</p>
      </div>
    `
  });

  if (!result.ok) {
    await db.prepare(`
      DELETE FROM verification_tokens
      WHERE identifier = ? AND token = ?
    `).run(normalized, code);
    return { error: result.error };
  }

  return { success: true, email: normalized };
}

export async function verifyEmailLoginOtp(email, code) {
  const normalized = normalizeEmail(email);
  const normalizedCode = String(code || '').trim();
  if (!/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  const row = await db.prepare(`
    SELECT * FROM verification_tokens
    WHERE identifier = ? AND token = ?
  `).get(normalized, normalizedCode);

  if (!row || new Date(row.expires) < new Date()) {
    return false;
  }

  await db.prepare(`
    DELETE FROM verification_tokens
    WHERE identifier = ? AND token = ?
  `).run(normalized, normalizedCode);

  return true;
}