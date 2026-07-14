#!/usr/bin/env python3
"""
从西语词频表生成 5000 词分级 CSV（A1–C2 + 专四/专八标签）。
中文释义：优先 sample_50 → 缓存 → Google 翻译（deep-translator）。
配图文件名写入 CSV，实际图片由内容组生成；导入时仅当文件存在才写 image_url。

用法:
  pip install deep-translator   # 首次
  python3 scripts/build_vocabulary_5000.py
  python3 scripts/build_vocabulary_5000.py --no-translate   # 仅用缓存/占位
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import re
import time
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FREQ_PATH = ROOT / "data" / "sources" / "frequency.csv"
SAMPLE_PATH = ROOT / "data" / "sample_50.csv"
CACHE_PATH = ROOT / "data" / "sources" / "es-zh-cache.json"
BATCHES_DIR = ROOT / "data" / "batches"
MASTER_PATH = ROOT / "data" / "vocabulary_5000.csv"

LEVEL_TARGETS = {"A1": 800, "A2": 1000, "B1": 1200, "B2": 1200, "C1": 400, "C2": 400}
LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]
TOTAL = sum(LEVEL_TARGETS.values())

POS_MAP = {
    "n": "n",
    "v": "v",
    "adj": "adj",
    "adv": "adv",
    "prep": "prep",
    "pron": "pron",
    "conj": "conj",
    "int": "int",
    "art": "art",
    "num": "n",
    "determiner": "adj",
    "contraction": "prep",
    "none": "adv",
}

SKIP_POS = set()

CSV_FIELDS = [
    "lemma", "pos", "gender", "level", "ipa", "meaning_zh", "meaning_en",
    "example_es", "example_zh", "image_file", "tags", "exam_tags",
    "distractor_1", "distractor_2", "distractor_3", "copyright_note",
]


def slugify(lemma: str) -> str:
    s = lemma.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"[\s_]+", "_", s)
    return s[:80] or "word"


def infer_gender(lemma: str, pos: str) -> str:
    if pos != "n":
        return "n/a"
    if lemma.endswith(("ión", "dad", "tad", "umbre", "ez", "ie", "is")):
        return "f"
    if lemma.endswith(("o", "or", "aje", "ma")):
        return "m"
    if lemma.endswith("a"):
        return "f"
    return "n/a"


def assign_level(rank_index: int) -> str:
    """rank_index: 0-based among selected 5000 words."""
    bounds = []
    acc = 0
    for lv in LEVEL_ORDER:
        acc += LEVEL_TARGETS[lv]
        bounds.append((lv, acc))
    for lv, bound in bounds:
        if rank_index < bound:
            return lv
    return "C2"


def exam_tags_for_level(level: str) -> str:
    if level in ("A2", "B1"):
        return "专四"
    if level in ("B2", "C1", "C2"):
        return "专八"
    return ""


def theme_tags(level: str, pos: str) -> str:
    parts = [level, pos]
    if pos in ("v",):
        parts.append("变位")
    if pos in ("prep", "conj"):
        parts.append("语法")
    if level in ("A1", "A2"):
        parts.append("日常")
    elif level in ("B1", "B2"):
        parts.append("进阶")
    else:
        parts.append("高级")
    return "|".join(parts)


def load_sample_overrides() -> tuple[dict[tuple[str, str], dict], dict[str, dict]]:
    if not SAMPLE_PATH.exists():
        return {}, {}
    by_key = {}
    by_lemma = {}
    with SAMPLE_PATH.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            lemma = row["lemma"].strip().lower()
            pos = row["pos"].strip()
            by_key[(lemma, pos)] = row
            by_lemma[lemma] = row
    return by_key, by_lemma


def find_override(by_key: dict, by_lemma: dict, lemma: str, pos: str) -> dict | None:
    return by_key.get((lemma, pos)) or by_lemma.get(lemma)


def load_frequency_rows() -> list[dict]:
    rows = []
    with FREQ_PATH.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            pos_raw = (row.get("pos") or "").strip().lower()
            if pos_raw in SKIP_POS:
                continue
            lemma = (row.get("spanish") or "").strip().lower()
            if not lemma or len(lemma) > 40:
                continue
            if re.search(r"\d", lemma):
                continue
            try:
                count = int(row.get("count") or 0)
            except ValueError:
                continue
            pos = POS_MAP.get(pos_raw, "n")
            rows.append({"lemma": lemma, "pos": pos, "count": count, "pos_raw": pos_raw})
    rows.sort(key=lambda x: x["count"], reverse=True)
    seen = set()
    unique = []
    for r in rows:
        key = (r["lemma"], r["pos"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(r)
        if len(unique) >= TOTAL:
            break
    return unique


def load_cache() -> dict[str, str]:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return {}


def save_cache(cache: dict[str, str]) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def translate_es_zh(texts: list[str], cache: dict[str, str], allow_api: bool) -> None:
    if not allow_api:
        return
    try:
        from deep_translator import GoogleTranslator
    except ImportError:
        print("[warn] 未安装 deep-translator，跳过在线翻译。pip install deep-translator")
        return

    translator = GoogleTranslator(source="es", target="zh-CN")
    pending = [t for t in texts if t not in cache]
    print(f"[translate] 待翻译 {len(pending)} 条…")
    for i, lemma in enumerate(pending):
        try:
            # 用单词本身翻译；多义词由内容组后续校对
            zh = translator.translate(lemma)
            cache[lemma] = (zh or lemma).strip()
        except Exception as e:
            print(f"  [skip] {lemma}: {e}")
            cache[lemma] = f"{lemma}（待校对）"
        if (i + 1) % 100 == 0:
            save_cache(cache)
            print(f"  …已翻译 {i + 1}/{len(pending)}")
            time.sleep(1.5)
        else:
            time.sleep(0.15)
    save_cache(cache)


def placeholder_zh(lemma: str, pos: str) -> str:
    hints = {
        "v": f"{lemma}（动词，待内容组校对）",
        "n": f"{lemma}（名词，待内容组校对）",
        "adj": f"{lemma}（形容词，待内容组校对）",
        "adv": f"{lemma}（副词，待内容组校对）",
        "prep": f"{lemma}（介词，待内容组校对）",
        "pron": f"{lemma}（代词，待内容组校对）",
    }
    return hints.get(pos, f"{lemma}（待内容组校对）")


def build_entries(freq_rows: list[dict], by_key: dict, by_lemma: dict, cache: dict, allow_api: bool) -> list[dict]:
    lemmas_for_translate = []
    for r in freq_rows:
        ov = find_override(by_key, by_lemma, r["lemma"], r["pos"])
        if not ov and r["lemma"] not in cache:
            lemmas_for_translate.append(r["lemma"])

    translate_es_zh(list(dict.fromkeys(lemmas_for_translate)), cache, allow_api)

    entries = []
    for i, r in enumerate(freq_rows):
        level = assign_level(i)
        ov = find_override(by_key, by_lemma, r["lemma"], r["pos"])

        if ov:
            meaning_zh = ov.get("meaning_zh", "").strip()
            meaning_en = ov.get("meaning_en", "").strip()
            example_es = ov.get("example_es", "").strip()
            example_zh = ov.get("example_zh", "").strip()
            ipa = ov.get("ipa", "").strip()
            gender = ov.get("gender", infer_gender(r["lemma"], r["pos"]))
            exam_tags = ov.get("exam_tags", "").strip() or exam_tags_for_level(level)
            tags = ov.get("tags", "").strip() or theme_tags(level, r["pos"])
            d1, d2, d3 = ov.get("distractor_1", ""), ov.get("distractor_2", ""), ov.get("distractor_3", "")
        else:
            meaning_zh = cache.get(r["lemma"]) or placeholder_zh(r["lemma"], r["pos"])
            meaning_en = r["lemma"]
            example_es = f"Contexto: {r['lemma']}."
            example_zh = f"例句待内容组补充（{r['lemma']}）。"
            ipa = ""
            gender = infer_gender(r["lemma"], r["pos"])
            exam_tags = exam_tags_for_level(level)
            tags = theme_tags(level, r["pos"])
            d1 = d2 = d3 = ""

        slug = slugify(r["lemma"])
        entries.append({
            "lemma": r["lemma"],
            "pos": r["pos"],
            "gender": gender,
            "level": level,
            "ipa": ipa,
            "meaning_zh": meaning_zh,
            "meaning_en": meaning_en,
            "example_es": example_es,
            "example_zh": example_zh,
            "image_file": f"{slug}.jpg",
            "tags": tags,
            "exam_tags": exam_tags,
            "distractor_1": d1,
            "distractor_2": d2,
            "distractor_3": d3,
            "copyright_note": "词库自动生成_中文待同学A校对_配图待同学B制作",
        })

    # 填充干扰项：同等级随机释义
    by_level: dict[str, list[str]] = {}
    for e in entries:
        by_level.setdefault(e["level"], []).append(e["meaning_zh"])

    rng = random.Random(42)
    for e in entries:
        if e["distractor_1"]:
            continue
        pool = [m for m in by_level.get(e["level"], []) if m != e["meaning_zh"]]
        rng.shuffle(pool)
        picks = pool[:3]
        while len(picks) < 3:
            picks.append("待填写")
        e["distractor_1"], e["distractor_2"], e["distractor_3"] = picks[:3]

    return entries


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-translate", action="store_true", help="不调用在线翻译")
    args = parser.parse_args()

    if not FREQ_PATH.exists():
        raise SystemExit(f"缺少词频文件: {FREQ_PATH}\n请先下载 doozan/spanish_data frequency.csv")

    overrides_key, overrides_lemma = load_sample_overrides()
    cache = load_cache()
    freq_rows = load_frequency_rows()
    print(f"[info] 选取高频词 {len(freq_rows)} 条（目标 {TOTAL}）")

    entries = build_entries(freq_rows, overrides_key, overrides_lemma, cache, allow_api=not args.no_translate)

    write_csv(MASTER_PATH, entries)
    print(f"[ok] 主表: {MASTER_PATH} ({len(entries)} 行)")

    for level in LEVEL_ORDER:
        level_rows = [e for e in entries if e["level"] == level]
        out = BATCHES_DIR / level / f"words_{level}.csv"
        write_csv(out, level_rows)
        print(f"[ok] {level}: {out} ({len(level_rows)} 行)")

    counts = {lv: sum(1 for e in entries if e["level"] == lv) for lv in LEVEL_ORDER}
    tem4 = sum(1 for e in entries if "专四" in e.get("exam_tags", ""))
    tem8 = sum(1 for e in entries if "专八" in e.get("exam_tags", ""))
    print(f"[summary] 分级: {counts}")
    print(f"[summary] 专四标签: {tem4} | 专八标签: {tem8}")


if __name__ == "__main__":
    main()
