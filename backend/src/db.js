import { DatabaseSync } from 'node:sqlite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_DIR = path.join(__dirname, '..', 'data')
const SEED_DB = path.join(DB_DIR, 'xiyu.seed.db')
const LOCAL_DB = path.join(DB_DIR, 'xiyu.db')

function resolveDbPath() {
  const isServerless = Boolean(process.env.VERCEL || process.env.XIYU_USE_TMP_DB === '1')
  if (!isServerless) {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true })
    }
    return LOCAL_DB
  }

  // Vercel 只读部署包：运行时拷到 /tmp 以便写入学习进度
  const tmpDir = process.env.XIYU_DB_DIR || '/tmp'
  const runtime = path.join(tmpDir, 'xiyu.db')
  if (!fs.existsSync(runtime)) {
    const source = fs.existsSync(SEED_DB) ? SEED_DB : LOCAL_DB
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, runtime)
    }
  }
  return runtime
}

const DB_PATH = resolveDbPath()

if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
}

const db = new DatabaseSync(DB_PATH)

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openid TEXT UNIQUE,
  unionid TEXT,
  email TEXT UNIQUE,
  nickname TEXT,
  avatar_url TEXT,
  auth_type TEXT DEFAULT 'wechat' CHECK(auth_type IN ('wechat','demo')),
  session_token TEXT UNIQUE,
  target_level TEXT DEFAULT 'A2' CHECK(target_level IN ('A1','A2','B1','B2','C1','C2')),
  daily_new INTEGER DEFAULT 10,
  streak_days INTEGER DEFAULT 0,
  last_checkin TEXT,
  last_login_at TEXT,
  token_expires_at TEXT,
  privacy_agreed_at TEXT,
  settings_json TEXT DEFAULT '{"soundEnabled":true,"vibrationEnabled":true,"showIpa":true}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lemma TEXT NOT NULL,
  pos TEXT,
  gender TEXT DEFAULT 'n/a' CHECK(gender IN ('m','f','n/a')),
  level TEXT NOT NULL CHECK(level IN ('A1','A2','B1','B2','C1','C2')),
  sense INTEGER NOT NULL DEFAULT 1,
  ipa TEXT,
  meaning_zh TEXT NOT NULL,
  meaning_en TEXT,
  example_es TEXT,
  example_zh TEXT,
  image_url TEXT,
  audio_url TEXT,
  conjugation_json TEXT,
  tags TEXT,
  frequency INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(lemma, pos, sense)
);

CREATE TABLE IF NOT EXISTS word_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word_id INTEGER NOT NULL,
  option_text TEXT NOT NULL,
  is_correct INTEGER DEFAULT 0,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_word_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  word_id INTEGER NOT NULL,
  status TEXT DEFAULT 'new' CHECK(status IN ('new','learning','mastered')),
  ease_factor REAL DEFAULT 2.5,
  interval_days INTEGER DEFAULT 0,
  next_review TEXT,
  wrong_count INTEGER DEFAULT 0,
  last_review TEXT,
  UNIQUE(user_id, word_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mistake_book (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  word_id INTEGER NOT NULL,
  wrong_at TEXT DEFAULT (datetime('now')),
  resolved INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_date TEXT NOT NULL,
  new_count INTEGER DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  wrong_count INTEGER DEFAULT 0,
  finished INTEGER DEFAULT 0,
  UNIQUE(user_id, session_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checkin_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  checkin_date TEXT NOT NULL,
  words_done INTEGER DEFAULT 0,
  UNIQUE(user_id, checkin_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS confusable_pairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word_id_a INTEGER NOT NULL,
  word_id_b INTEGER NOT NULL,
  note_zh TEXT,
  note_es TEXT,
  content_status TEXT DEFAULT 'pending' CHECK(content_status IN ('pending','draft','approved')),
  FOREIGN KEY (word_id_a) REFERENCES words(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id_b) REFERENCES words(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  word_id INTEGER NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('answer','dictation','review','exam')),
  is_correct INTEGER NOT NULL DEFAULT 0,
  study_mode TEXT,
  duration_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_words_level ON words(level);
CREATE INDEX IF NOT EXISTS idx_mistake_user ON mistake_book(user_id, resolved);
CREATE INDEX IF NOT EXISTS idx_progress_review ON user_word_progress(user_id, next_review);
CREATE INDEX IF NOT EXISTS idx_checkin_user ON checkin_log(user_id, checkin_date);
CREATE INDEX IF NOT EXISTS idx_study_user_time ON study_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_study_word ON study_events(word_id);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TEXT NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE IF NOT EXISTS rate_limit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_key_time ON rate_limit_events(key, created_at);
`

db.exec(SCHEMA)

export function getDb() {
  return db
}

export function getDbPath() {
  return DB_PATH
}

export default db
