#!/usr/bin/env python3
"""
CSV 词库导入脚本 — 将 data/sample_50.csv 导入 MySQL

用法:
  pip install pymysql
  python scripts/import_words.py --csv data/sample_50.csv \\
    --host 127.0.0.1 --user root --password xxx --database spanish_vocab

  # 仅校验 CSV 不写入数据库
  python scripts/import_words.py --csv data/sample_50.csv --dry-run

  # 导出为 JSON（供 H5 原型使用）
  python scripts/import_words.py --csv data/sample_50.csv --export-json frontend/src/static/words.json
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

REQUIRED_COLUMNS = [
    "lemma", "pos", "gender", "level", "meaning_zh",
    "distractor_1", "distractor_2", "distractor_3",
]

OPTIONAL_COLUMNS = [
    "ipa", "meaning_en", "example_es", "example_zh",
    "image_file", "tags", "copyright_note",
]

VALID_LEVELS = {"A1", "A2", "B1", "B2", "C1", "C2"}
VALID_GENDERS = {"m", "f", "n/a", "na", ""}


def parse_tags(raw: str) -> list[str]:
    if not raw or not raw.strip():
        return []
    return [t.strip() for t in raw.replace("|", ",").split(",") if t.strip()]


def load_csv(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        missing = [c for c in REQUIRED_COLUMNS if c not in headers]
        if missing:
            raise ValueError(f"CSV 缺少必填列: {', '.join(missing)}")

        for i, row in enumerate(reader, start=2):
            lemma = (row.get("lemma") or "").strip()
            if not lemma:
                continue

            level = (row.get("level") or "").strip().upper()
            if level not in VALID_LEVELS:
                raise ValueError(f"第 {i} 行 level 无效: {level}")

            gender = (row.get("gender") or "n/a").strip().lower()
            if gender in ("", "na"):
                gender = "n/a"
            if gender not in VALID_LEVELS and gender not in VALID_GENDERS:
                if gender not in ("m", "f", "n/a"):
                    raise ValueError(f"第 {i} 行 gender 无效: {gender}")

            meaning = (row.get("meaning_zh") or "").strip()
            if not meaning:
                raise ValueError(f"第 {i} 行 meaning_zh 不能为空")

            distractors = [
                (row.get("distractor_1") or "").strip(),
                (row.get("distractor_2") or "").strip(),
                (row.get("distractor_3") or "").strip(),
            ]
            if any(not d for d in distractors):
                raise ValueError(f"第 {i} 行干扰项不能为空")

            image_file = (row.get("image_file") or "").strip()
            image_url = f"/static/images/{image_file}" if image_file else ""

            tags = parse_tags(row.get("tags") or "")

            options = [
                {"text": meaning, "correct": True},
                {"text": distractors[0], "correct": False},
                {"text": distractors[1], "correct": False},
                {"text": distractors[2], "correct": False},
            ]

            rows.append({
                "lemma": lemma,
                "pos": (row.get("pos") or "").strip(),
                "gender": gender,
                "level": level,
                "ipa": (row.get("ipa") or "").strip(),
                "meaning_zh": meaning,
                "meaning_en": (row.get("meaning_en") or "").strip(),
                "example_es": (row.get("example_es") or "").strip(),
                "example_zh": (row.get("example_zh") or "").strip(),
                "image_url": image_url,
                "tags": tags,
                "options": options,
                "copyright_note": (row.get("copyright_note") or "").strip(),
            })

    if not rows:
        raise ValueError("CSV 中没有有效数据行")
    return rows


def export_json(rows: list[dict], out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": 1,
        "total": len(rows),
        "words": [
            {
                "id": idx + 1,
                **row,
            }
            for idx, row in enumerate(rows)
        ],
    }
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已导出 JSON: {out_path} ({len(rows)} 词)")


def import_mysql(rows: list[dict], host: str, user: str, password: str, database: str, port: int) -> None:
    try:
        import pymysql
    except ImportError:
        print("请先安装: pip install pymysql", file=sys.stderr)
        sys.exit(1)

    conn = pymysql.connect(
        host=host, user=user, password=password,
        database=database, port=port, charset="utf8mb4",
    )
    inserted = 0
    try:
        with conn.cursor() as cur:
            for row in rows:
                tags_json = json.dumps(row["tags"], ensure_ascii=False)
                cur.execute(
                    """
                    INSERT INTO words
                      (lemma, pos, gender, level, ipa, meaning_zh, meaning_en,
                       example_es, example_zh, image_url, tags)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON DUPLICATE KEY UPDATE
                      meaning_zh=VALUES(meaning_zh),
                      example_es=VALUES(example_es),
                      image_url=VALUES(image_url),
                      tags=VALUES(tags)
                    """,
                    (
                        row["lemma"], row["pos"], row["gender"], row["level"],
                        row["ipa"] or None, row["meaning_zh"],
                        row["meaning_en"] or None,
                        row["example_es"] or None, row["example_zh"] or None,
                        row["image_url"] or None, tags_json,
                    ),
                )
                word_id = cur.lastrowid
                if word_id == 0:
                    cur.execute(
                        "SELECT id FROM words WHERE lemma=%s AND pos=%s",
                        (row["lemma"], row["pos"]),
                    )
                    word_id = cur.fetchone()[0]

                cur.execute("DELETE FROM word_options WHERE word_id=%s", (word_id,))
                for opt in row["options"]:
                    cur.execute(
                        """
                        INSERT INTO word_options (word_id, option_text, is_correct)
                        VALUES (%s, %s, %s)
                        """,
                        (word_id, opt["text"], 1 if opt["correct"] else 0),
                    )
                inserted += 1
        conn.commit()
    finally:
        conn.close()
    print(f"已导入 MySQL: {inserted} 词")


def main() -> None:
    parser = argparse.ArgumentParser(description="西语词库 CSV 导入工具")
    parser.add_argument("--csv", type=Path, default=Path("data/sample_50.csv"))
    parser.add_argument("--dry-run", action="store_true", help="仅校验，不写入")
    parser.add_argument("--export-json", type=Path, help="导出为前端 JSON")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=3306)
    parser.add_argument("--user", default="root")
    parser.add_argument("--password", default="")
    parser.add_argument("--database", default="spanish_vocab")
    args = parser.parse_args()

    if not args.csv.exists():
        print(f"文件不存在: {args.csv}", file=sys.stderr)
        sys.exit(1)

    rows = load_csv(args.csv)
    print(f"校验通过: {len(rows)} 词")

    if args.dry_run and not args.export_json:
        for r in rows[:3]:
            print(f"  - {r['lemma']} ({r['level']}): {r['meaning_zh']}")
        if len(rows) > 3:
            print(f"  ... 共 {len(rows)} 词")
        return

    if args.export_json:
        export_json(rows, args.export_json)

    if not args.dry_run and args.export_json is None:
        import_mysql(rows, args.host, args.user, args.password, args.database, args.port)
    elif not args.dry_run and args.export_json:
        pass
    elif args.dry_run:
        pass


if __name__ == "__main__":
    main()
