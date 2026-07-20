async function migrateWordsSenseUnique(db) {
  const cols = await db.prepare('PRAGMA table_info(words)').all();
  if (cols.some((c) => c.name === 'sense')) return;

  await db.exec('PRAGMA foreign_keys = OFF');
  await db.exec('BEGIN');
  try {
    await db.exec(`
      CREATE TABLE words_new (
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
      )
    `);

    const hasConj = cols.some((c) => c.name === 'conjugation_json');
    if (hasConj) {
      await db.exec(`
        INSERT INTO words_new (
          id, lemma, pos, gender, level, sense, ipa, meaning_zh, meaning_en,
          example_es, example_zh, image_url, audio_url, conjugation_json, tags, frequency, created_at
        )
        SELECT
          id, lemma, pos, gender, level, 1, ipa, meaning_zh, meaning_en,
          example_es, example_zh, image_url, audio_url, conjugation_json, tags, frequency, created_at
        FROM words
      `);
    } else {
      await db.exec(`
        INSERT INTO words_new (
          id, lemma, pos, gender, level, sense, ipa, meaning_zh, meaning_en,
          example_es, example_zh, image_url, audio_url, tags, frequency, created_at
        )
        SELECT
          id, lemma, pos, gender, level, 1, ipa, meaning_zh, meaning_en,
          example_es, example_zh, image_url, audio_url, tags, frequency, created_at
        FROM words
      `);
    }

    await db.exec('DROP TABLE words');
    await db.exec('ALTER TABLE words_new RENAME TO words');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_words_level ON words(level)');
    await db.exec('COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  } finally {
    await db.exec('PRAGMA foreign_keys = ON');
  }
  console.log('[migrate] words 表已支持义项 sense（UNIQUE lemma+pos+sense）');
}

export async function runMigrations(db) {
  await migrateWordsSenseUnique(db);

  const MIGRATIONS = [
  `ALTER TABLE words ADD COLUMN conjugation_json TEXT`,
  `CREATE TABLE IF NOT EXISTS confusable_pairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id_a INTEGER NOT NULL,
      word_id_b INTEGER NOT NULL,
      note_zh TEXT,
      note_es TEXT,
      content_status TEXT DEFAULT 'pending' CHECK(content_status IN ('pending','draft','approved')),
      FOREIGN KEY (word_id_a) REFERENCES words(id) ON DELETE CASCADE,
      FOREIGN KEY (word_id_b) REFERENCES words(id) ON DELETE CASCADE
    )`,
  `CREATE TABLE IF NOT EXISTS checkin_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      checkin_date TEXT NOT NULL,
      words_done INTEGER DEFAULT 0,
      UNIQUE(user_id, checkin_date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
  `CREATE INDEX IF NOT EXISTS idx_checkin_user ON checkin_log(user_id, checkin_date)`,
  `ALTER TABLE users ADD COLUMN avatar_url TEXT`,
  `ALTER TABLE users ADD COLUMN unionid TEXT`,
  `ALTER TABLE users ADD COLUMN last_login_at TEXT`,
  `ALTER TABLE users ADD COLUMN token_expires_at TEXT`,
  `ALTER TABLE users ADD COLUMN auth_type TEXT DEFAULT 'wechat'`,
  `ALTER TABLE users ADD COLUMN privacy_agreed_at TEXT`,
  `ALTER TABLE users ADD COLUMN settings_json TEXT`,
  `ALTER TABLE users ADD COLUMN updated_at TEXT`,
  `ALTER TABLE daily_sessions ADD COLUMN finished INTEGER DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS study_events (
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
    )`,
  `CREATE INDEX IF NOT EXISTS idx_study_user_time ON study_events(user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_study_word ON study_events(word_id)`,
  `ALTER TABLE users ADD COLUMN email TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT NOT NULL,
      expires TEXT NOT NULL,
      PRIMARY KEY (identifier, token)
    )`,
  `CREATE TABLE IF NOT EXISTS rate_limit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  `CREATE INDEX IF NOT EXISTS idx_rate_limit_key_time ON rate_limit_events(key, created_at)`,
  `ALTER TABLE users ADD COLUMN password_hash TEXT`,
  `ALTER TABLE users ADD COLUMN phone TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`,
  `ALTER TABLE users ADD COLUMN experiment_arm TEXT`,
  `CREATE TABLE IF NOT EXISTS corpus_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      level TEXT NOT NULL CHECK(level IN ('A1','A2','B1','B2','C1','C2')),
      text_es TEXT NOT NULL,
      text_zh TEXT,
      lemmas_json TEXT NOT NULL DEFAULT '[]',
      embedding BLOB,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  `CREATE INDEX IF NOT EXISTS idx_corpus_level ON corpus_chunks(level)`,
  `CREATE INDEX IF NOT EXISTS idx_corpus_source ON corpus_chunks(source)`,
  `CREATE TABLE IF NOT EXISTS example_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER NOT NULL,
      chunk_id INTEGER NOT NULL,
      rank INTEGER DEFAULT 0,
      approved INTEGER DEFAULT 0,
      note TEXT,
      UNIQUE(word_id, chunk_id),
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
      FOREIGN KEY (chunk_id) REFERENCES corpus_chunks(id) ON DELETE CASCADE
    )`,
  `CREATE TABLE IF NOT EXISTS ai_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL CHECK(kind IN ('mistake_explain','confusable')),
      word_id INTEGER,
      prompt_hash TEXT,
      model TEXT,
      input_json TEXT,
      output_json TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      reviewer TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT,
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE SET NULL
    )`,
  `CREATE INDEX IF NOT EXISTS idx_ai_reviews_status ON ai_reviews(status, created_at)`];


  for (const sql of MIGRATIONS) {
    try {
      await db.exec(sql);
    } catch (e) {
      if (!String(e.message).includes('duplicate column name')) throw e;
    }
  }
}