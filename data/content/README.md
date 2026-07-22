# 内容组交付 · 义项表（App 词库）

## 主词库 + 考试路径（完整合并）

当前线上规模以导入后 `GET /api/health` 的 `words` 为准（A1 义项包 ∪ 专四 ∪ 专八，去重）。

| 标签 | CSV | 配图 |
|------|-----|------|
| 义项包 A1 | `data/batches/A1/words_senses_team.csv` | `data/images/A1/` |
| 专四 | `data/batches/exam/words_tem4.csv` | `data/images/tem4/` |
| 专八 | `data/batches/exam/words_tem8.csv` | `data/images/tem8/` |

> 一词可同时带「义项包 + 专四」标签；数据库按 lemma+pos+sense 去重。

## 压缩包来源（微信）

| 压缩包 | 内含 Excel | 图片 |
|--------|------------|------|
| `images专业四级2.zip` | `senses_table_tem4 7.16.xlsx` | 143 |
| `images专业四级3.zip` | `senses_table_tem4 7.17.xlsx` | 143 |
| `images专业四级4.zip` | `senses_table_tem4 7.18.xlsx` | 163 |
| `images专业四级5.zip` | `senses_table_tem4 7.19.xlsx` | ~170 |
| `images专业四级6.zip` | `senses_table_tem4 7.20.xlsx` | ~148 |
| `images专业八级1.zip` | （词表用带图表） | 59 |

另：`senses_table_tem4_with_images.xlsx`、`senses_table_tem8_with_images.xlsx` 提供基线专四/专八内嵌图。

归档副本在本目录：`senses_table_tem4 7.16.xlsx` 等；合并总表：`senses_table_all_merged.xlsx`。

## 完整导入

```bash
python3 scripts/import_exam_packs_full.py
node scripts/reset-with-exams.mjs
```

## 仅 A1 义项包回滚

```bash
python3 scripts/import_senses_xlsx.py
node scripts/reset-to-senses.mjs
```
