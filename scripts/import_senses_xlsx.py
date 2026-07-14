#!/usr/bin/env python3
"""
将西语同学交付的义项表 Excel 导入为 App 词库 CSV，并抽出内嵌配图。

用法:
  python3 scripts/import_senses_xlsx.py
  python3 scripts/import_senses_xlsx.py data/content/senses_table.xlsx
"""

from __future__ import annotations

import csv
import random
import re
import shutil
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_XLSX = ROOT / "data" / "content" / "senses_table.xlsx"
OUT_CSV = ROOT / "data" / "batches" / "A1" / "words_senses_team.csv"
IMAGES_DIR = ROOT / "data" / "images" / "A1"

CSV_FIELDS = [
    "lemma", "pos", "gender", "level", "sense", "ipa",
    "meaning_zh", "meaning_en", "example_es", "example_zh",
    "image_file", "tags", "exam_tags",
    "distractor_1", "distractor_2", "distractor_3", "copyright_note",
]

CAT_MAP = {
    "f": ("n", "f"),
    "m": ("n", "m"),
    "v": ("v", "n/a"),
    "adj": ("adj", "n/a"),
    "adv": ("adv", "n/a"),
    "interj": ("int", "n/a"),
    "int": ("int", "n/a"),
    "pron": ("pron", "n/a"),
    "prep": ("prep", "n/a"),
    "conj": ("conj", "n/a"),
}


def slugify(text: str) -> str:
    s = unicodedata.normalize("NFD", text.strip().lower())
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"[\s_]+", "_", s)
    return s[:80] or "word"


def map_categoria(cat: str) -> tuple[str, str]:
    key = (cat or "").strip().lower()
    return CAT_MAP.get(key, ("n", "n/a"))


def extract_image_map(xlsx: Path) -> dict[int, str]:
    """Excel 1-based row index → relative media path in zip (media/imageN.png)."""
    ns = {
        "xdr": "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    }
    a_ns = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
    r_attr = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed"

    with zipfile.ZipFile(xlsx) as z:
        rel_root = ET.fromstring(z.read("xl/drawings/_rels/drawing1.xml.rels"))
        rid_map = {
            rel.attrib["Id"]: rel.attrib["Target"].replace("../media/", "xl/media/")
            for rel in rel_root
            if rel.attrib.get("Type", "").endswith("/image")
        }
        root = ET.fromstring(z.read("xl/drawings/drawing1.xml"))
        mapping: dict[int, str] = {}
        for anc in root:
            frm = anc.find("xdr:from", ns)
            if frm is None:
                continue
            excel_row = int(frm.findtext("xdr:row", namespaces=ns)) + 1
            blip = anc.find(f".//{a_ns}blip")
            if blip is None:
                continue
            embed = blip.attrib.get(r_attr)
            target = rid_map.get(embed)
            if target:
                mapping[excel_row] = target
    return mapping


def load_rows(xlsx: Path) -> list[dict]:
    try:
        import openpyxl
    except ImportError as e:
        raise SystemExit("请先安装: pip3 install openpyxl") from e

    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    ws = wb.active
    rows_raw = list(ws.iter_rows(values_only=True))
    wb.close()
    if not rows_raw:
        raise SystemExit("Excel 为空")

    header = [str(h or "").strip() for h in rows_raw[0]]
    expected = ["西语", "义项", "categoría", "级别", "中文释义", "例句*西语", "例句*中文", "图片"]
    if header[:8] != expected:
        print(f"[warn] 表头与预期不完全一致: {header[:8]}")

    image_map = extract_image_map(xlsx)
    entries = []
    with zipfile.ZipFile(xlsx) as z:
        for excel_row_idx, raw in enumerate(rows_raw[1:], start=2):
            if not raw or not raw[0]:
                continue
            lemma = str(raw[0]).strip()
            sense = int(raw[1] or 1)
            cat = str(raw[2] or "").strip()
            level = str(raw[3] or "A1").strip().upper()
            meaning_zh = str(raw[4] or "").strip()
            example_es = str(raw[5] or "").strip()
            example_zh = str(raw[6] or "").strip()
            image_hint = str(raw[7] or "").strip()

            pos, gender = map_categoria(cat)
            if not meaning_zh:
                continue

            # 目标文件名：casa_1.png（去重音）
            if image_hint:
                base = Path(image_hint).name
            else:
                base = f"{slugify(lemma)}_{sense}.png"
            stem = slugify(Path(base).stem)
            ext = Path(base).suffix.lower() or ".png"
            image_file = f"{stem}{ext}"

            media_zip_path = image_map.get(excel_row_idx)
            if media_zip_path and media_zip_path in z.namelist():
                IMAGES_DIR.mkdir(parents=True, exist_ok=True)
                dest = IMAGES_DIR / image_file
                with z.open(media_zip_path) as src, dest.open("wb") as dst:
                    shutil.copyfileobj(src, dst)
            else:
                print(f"[warn] 第 {excel_row_idx} 行无配图: {lemma}#{sense}")

            entries.append({
                "lemma": lemma,
                "pos": pos,
                "gender": gender,
                "level": level,
                "sense": str(sense),
                "ipa": "",
                "meaning_zh": meaning_zh,
                "meaning_en": "",
                "example_es": example_es,
                "example_zh": example_zh,
                "image_file": image_file,
                "tags": f"义项包|{level}|{pos}",
                "exam_tags": "",
                "distractor_1": "",
                "distractor_2": "",
                "distractor_3": "",
                "copyright_note": "大创内容组_senses_table",
            })

    # 同等级干扰项
    by_level: dict[str, list[str]] = {}
    for e in entries:
        by_level.setdefault(e["level"], []).append(e["meaning_zh"])
    rng = random.Random(42)
    for e in entries:
        pool = [m for m in by_level.get(e["level"], []) if m != e["meaning_zh"]]
        rng.shuffle(pool)
        picks = (pool + ["待填写", "待填写", "待填写"])[:3]
        e["distractor_1"], e["distractor_2"], e["distractor_3"] = picks

    return entries


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    xlsx = Path(sys.argv[1]).expanduser().resolve() if len(sys.argv) > 1 else DEFAULT_XLSX
    if not xlsx.exists():
        raise SystemExit(f"找不到 Excel: {xlsx}")

    print(f"[info] 读取 {xlsx}")
    entries = load_rows(xlsx)
    write_csv(OUT_CSV, entries)
    print(f"[ok] CSV: {OUT_CSV} ({len(entries)} 义项)")
    print(f"[ok] 配图目录: {IMAGES_DIR} ({len(list(IMAGES_DIR.glob('*.png')))} 张 png)")
    multi = sum(1 for e in entries if int(e["sense"]) > 1)
    print(f"[summary] 多义词义项: {multi} 条 | 等级: A1={sum(1 for e in entries if e['level']=='A1')}")
    print("\n下一步导入数据库:")
    print("  node backend/src/seed.js data/batches/A1/words_senses_team.csv")


if __name__ == "__main__":
    main()
