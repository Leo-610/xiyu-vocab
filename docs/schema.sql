-- 西语背单词 — 数据库建表脚本（个人开发者 · 完整版）
-- MySQL 8.0+ / SQLite 逻辑对齐见 backend/src/db.js

CREATE DATABASE IF NOT EXISTS spanish_vocab DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE spanish_vocab;

-- 词库表
CREATE TABLE words (
  id                BIGINT PRIMARY KEY AUTO_INCREMENT,
  lemma             VARCHAR(64) NOT NULL COMMENT '词典原形',
  pos               VARCHAR(16) COMMENT '词性',
  gender            ENUM('m','f','n/a') DEFAULT 'n/a',
  level             ENUM('A1','A2','B1','B2','C1','C2') NOT NULL,
  ipa               VARCHAR(128),
  meaning_zh        TEXT NOT NULL,
  meaning_en        TEXT,
  example_es        TEXT,
  example_zh        TEXT,
  image_url         VARCHAR(512),
  audio_url         VARCHAR(512),
  conjugation_json  JSON COMMENT '动词变位表',
  tags              JSON,
  frequency         INT DEFAULT 0,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_lemma_pos (lemma, pos),
  INDEX idx_level (level)
) ENGINE=InnoDB COMMENT='西语词库';

CREATE TABLE word_options (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  word_id     BIGINT NOT NULL,
  option_text VARCHAR(256) NOT NULL,
  is_correct  TINYINT(1) DEFAULT 0,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
  INDEX idx_word (word_id)
) ENGINE=InnoDB COMMENT='识记选项';

-- 用户表（个人微信 openid）
CREATE TABLE users (
  id                BIGINT PRIMARY KEY AUTO_INCREMENT,
  openid            VARCHAR(64) UNIQUE COMMENT '微信openid或demo_昵称',
  unionid           VARCHAR(64) COMMENT '微信unionid',
  nickname          VARCHAR(64),
  avatar_url        VARCHAR(512),
  auth_type         ENUM('wechat','demo') DEFAULT 'wechat',
  session_token     VARCHAR(64) UNIQUE,
  target_level      ENUM('A1','A2','B1','B2','C1','C2') DEFAULT 'A2',
  daily_new         INT DEFAULT 10,
  streak_days       INT DEFAULT 0,
  last_checkin      DATE,
  last_login_at     DATETIME,
  token_expires_at  DATETIME,
  privacy_agreed_at DATETIME,
  settings_json     JSON DEFAULT ('{"soundEnabled":true,"vibrationEnabled":true,"showIpa":true}'),
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_openid (openid)
) ENGINE=InnoDB COMMENT='用户';

CREATE TABLE user_word_progress (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id       BIGINT NOT NULL,
  word_id       BIGINT NOT NULL,
  status        ENUM('new','learning','mastered') DEFAULT 'new',
  ease_factor   DECIMAL(4,2) DEFAULT 2.50,
  interval_days INT DEFAULT 0,
  next_review   DATE,
  wrong_count   INT DEFAULT 0,
  last_review   DATETIME,
  UNIQUE KEY uk_user_word (user_id, word_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
  INDEX idx_next_review (user_id, next_review)
) ENGINE=InnoDB COMMENT='SM-2学习进度';

CREATE TABLE mistake_book (
  id       BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id  BIGINT NOT NULL,
  word_id  BIGINT NOT NULL,
  wrong_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved TINYINT(1) DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
  INDEX idx_user (user_id, resolved)
) ENGINE=InnoDB COMMENT='错题本';

CREATE TABLE daily_sessions (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id       BIGINT NOT NULL,
  session_date  DATE NOT NULL,
  new_count     INT DEFAULT 0,
  review_count  INT DEFAULT 0,
  correct_count INT DEFAULT 0,
  wrong_count   INT DEFAULT 0,
  finished      TINYINT(1) DEFAULT 0,
  UNIQUE KEY uk_user_date (user_id, session_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='每日学习会话';

CREATE TABLE checkin_log (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id       BIGINT NOT NULL,
  checkin_date  DATE NOT NULL,
  words_done    INT DEFAULT 0,
  UNIQUE KEY uk_user_checkin (user_id, checkin_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_checkin (user_id, checkin_date)
) ENGINE=InnoDB COMMENT='打卡记录';

-- 答题行为日志（试用分析 / 统计页）
CREATE TABLE study_events (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id     BIGINT NOT NULL,
  word_id     BIGINT NOT NULL,
  event_type  ENUM('answer','dictation','review','exam') NOT NULL,
  is_correct  TINYINT(1) NOT NULL DEFAULT 0,
  study_mode  VARCHAR(32),
  duration_ms INT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
  INDEX idx_user_time (user_id, created_at),
  INDEX idx_word (word_id)
) ENGINE=InnoDB COMMENT='学习行为日志';

CREATE TABLE confusable_pairs (
  id             BIGINT PRIMARY KEY AUTO_INCREMENT,
  word_id_a      BIGINT NOT NULL,
  word_id_b      BIGINT NOT NULL,
  note_zh        TEXT,
  note_es        TEXT,
  content_status ENUM('pending','draft','approved') DEFAULT 'pending',
  FOREIGN KEY (word_id_a) REFERENCES words(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id_b) REFERENCES words(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='易混词对';

-- RAG 语料（三期）
CREATE TABLE corpus_chunks (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  source       VARCHAR(128),
  level        ENUM('A1','A2','B1','B2','C1','C2'),
  text_es      TEXT NOT NULL,
  text_zh      TEXT,
  embedding_id VARCHAR(64),
  word_ids     JSON,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_level (level)
) ENGINE=InnoDB COMMENT='RAG语料';
