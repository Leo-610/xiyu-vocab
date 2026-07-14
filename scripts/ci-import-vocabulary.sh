#!/usr/bin/env bash
# 词库 CI 导入：校验 CSV → 写入 SQLite
# 用法：./scripts/ci-import-vocabulary.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

source scripts/env.sh 2>/dev/null || true

echo "[ci] 校验 sample_50.csv"
python3 scripts/import_words.py --csv data/sample_50.csv --dry-run

echo "[ci] 导入全部等级词库"
node scripts/seed-all-levels.mjs

echo "[ci] 词库统计"
sqlite3 backend/data/xiyu.db "SELECT level, COUNT(*) FROM words GROUP BY level; SELECT 'TOTAL', COUNT(*) FROM words;"

echo "[ci] 完成"
