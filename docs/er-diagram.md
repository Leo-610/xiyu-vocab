# 数据库 ER 关系图

> 完整字段说明见 [database-design.md](database-design.md)

```mermaid
erDiagram
  users ||--o{ user_word_progress : has
  users ||--o{ mistake_book : has
  users ||--o{ daily_sessions : has
  users ||--o{ checkin_log : has
  users ||--o{ study_events : logs
  words ||--o{ user_word_progress : tracked_in
  words ||--o{ mistake_book : appears_in
  words ||--o{ word_options : has
  words ||--o{ study_events : answered
  words ||--o{ confusable_pairs : paired_a
  words ||--o{ confusable_pairs : paired_b
  corpus_chunks }o--o{ words : references

  users {
    bigint id PK
    varchar openid UK
    varchar unionid
    varchar nickname
    varchar avatar_url
    enum auth_type
    varchar session_token UK
    enum target_level
    int daily_new
    int streak_days
    json settings_json
    datetime token_expires_at
    datetime privacy_agreed_at
  }

  words {
    bigint id PK
    varchar lemma
    varchar pos
    enum gender
    enum level
    text meaning_zh
    varchar image_url
    json conjugation_json
    json tags
  }

  word_options {
    bigint id PK
    bigint word_id FK
    varchar option_text
    tinyint is_correct
  }

  user_word_progress {
    bigint id PK
    bigint user_id FK
    bigint word_id FK
    enum status
    decimal ease_factor
    int interval_days
    date next_review
  }

  mistake_book {
    bigint id PK
    bigint user_id FK
    bigint word_id FK
    datetime wrong_at
    tinyint resolved
  }

  daily_sessions {
    bigint id PK
    bigint user_id FK
    date session_date
    int new_count
    int review_count
    int finished
  }

  checkin_log {
    bigint id PK
    bigint user_id FK
    date checkin_date
    int words_done
  }

  study_events {
    bigint id PK
    bigint user_id FK
    bigint word_id FK
    enum event_type
    tinyint is_correct
    varchar study_mode
    datetime created_at
  }

  confusable_pairs {
    bigint id PK
    bigint word_id_a FK
    bigint word_id_b FK
    text note_zh
    enum content_status
  }

  corpus_chunks {
    bigint id PK
    varchar source
    enum level
    text text_es
    varchar embedding_id
    json word_ids
  }
```

## 表关系说明

1. **words ↔ word_options**：一对多，每词 4 个选项（1 正 3 干扰）。
2. **users ↔ user_word_progress**：SM-2 复习状态，按 `(user_id, next_review)` 索引调度。
3. **mistake_book**：答错写入，复习正确后 `resolved=1`。
4. **study_events**：每次答题/听写写入，支撑统计页与大创数据分析。
5. **users.settings_json**：发音、震动、IPA 显示等个人偏好。
6. **corpus_chunks**：RAG 语料（三期），通过 `word_ids` 关联词库。
