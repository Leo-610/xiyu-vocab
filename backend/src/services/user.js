import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveAuthType } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVATAR_DIR = path.join(__dirname, '..', '..', 'data', 'avatars');

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_BYTES = 2 * 1024 * 1024;

function extFromMime(mime) {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
  };
  return map[mime] || '.jpg';
}

export function isWechatUser(user) {
  return resolveAuthType(user) === 'wechat';
}

export function needsProfile(user) {
  if (!isWechatUser(user)) return false;
  const name = String(user.nickname || '').trim();
  return !name || name === '微信用户';
}

export async function updateUserProfile(db, userId, { nickname }) {
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
  await db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(name, userId);
}

export async function saveUserAvatar(db, userId, buffer, mimeType) {
  if (!buffer?.length) {
    const err = new Error('头像文件为空');
    err.code = 'EMPTY_FILE';
    throw err;
  }
  if (buffer.length > MAX_BYTES) {
    const err = new Error('头像不能超过 2MB');
    err.code = 'FILE_TOO_LARGE';
    throw err;
  }

  const ext = extFromMime(mimeType);
  if (!ALLOWED_EXT.has(ext)) {
    const err = new Error('仅支持 jpg/png/webp');
    err.code = 'INVALID_TYPE';
    throw err;
  }

  if (!fs.existsSync(AVATAR_DIR)) {
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
  }

  const filename = `${userId}${ext}`;
  const filePath = path.join(AVATAR_DIR, filename);

  for (const old of fs.readdirSync(AVATAR_DIR)) {
    if (old.startsWith(`${userId}.`)) {
      fs.unlinkSync(path.join(AVATAR_DIR, old));
    }
  }

  fs.writeFileSync(filePath, buffer);
  const avatarUrl = `/static/avatars/${filename}`;
  await db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, userId);
  return avatarUrl;
}

export function getAvatarDir() {
  return AVATAR_DIR;
}