# 5000 词库说明

## 文件位置

| 文件 | 说明 |
|------|------|
| [`vocabulary_5000.csv`](vocabulary_5000.csv) | **主表**（5000 行，含表头 5001 行） |
| [`batches/A1/words_A1.csv`](batches/A1/words_A1.csv) | A1 · 800 词 |
| [`batches/A2/words_A2.csv`](batches/A2/words_A2.csv) | A2 · 1000 词（含专四标签） |
| [`batches/B1/words_B1.csv`](batches/B1/words_B1.csv) | B1 · 1200 词（含专四标签） |
| [`batches/B2/words_B2.csv`](batches/B2/words_B2.csv) | B2 · 1200 词（含专八标签） |
| [`batches/C1/words_C1.csv`](batches/C1/words_C1.csv) | C1 · 400 词（含专八标签） |
| [`batches/C2/words_C2.csv`](batches/C2/words_C2.csv) | C2 · 400 词（含专八标签） |

## 分级规则

- 按 [doozan/spanish_data](https://github.com/doozan/spanish_data) **词频**排序，取前 5000 个不同 `(lemma, pos)` 词条
- 按排名切分到 DELE 等级：A1(800) → A2(1000) → B1(1200) → B2(1200) → C1(400) → C2(400)
- **专四**：A2、B1 等级词条自动打 `exam_tags=专四`
- **专八**：B2、C1、C2 等级词条自动打 `exam_tags=专八`

## 列说明

| 列 | 谁填 | 说明 |
|----|------|------|
| lemma / pos / level | 技术（已生成） | 西语词条与 DELE 等级 |
| meaning_zh | **同学 A 校对** | 多数为机翻/占位，需人工校对 |
| example_es / example_zh | **同学 A** | 多数为占位句，需替换为真实例句 |
| ipa | **同学 A** | 待补充 |
| image_file | 技术（已生成文件名） | 如 `hablar.jpg`，**不含图片文件本身** |
| tags / exam_tags | 技术（已生成） | 主题 + 考试路径标签 |
| distractor_1~3 | 技术（已生成） | 同等级随机中文干扰项，A 可优化 |

## 配图（同学 B）

- CSV 中每行已有 `image_file`，**App 仅当文件存在时才显示图片**，否则用 emoji 占位
- 推荐路径（二选一，与文件实际位置一致即可）：
  - `data/images/{等级}/{image_file}`，例如 `data/images/A1/hola.jpg`
  - `data/images/{image_file}`，例如 `data/images/hola.jpg`
- 规格：800×800，统一插画风，登记 [`images/COPYRIGHT.md`](images/COPYRIGHT.md)
- 建议顺序：A1 前 100 张（答辩 demo）→ A1 全部 → A2…

## 导入数据库

```bash
node scripts/seed-all-levels.mjs
```

## 重新生成 CSV（技术）

```bash
python3 scripts/build_vocabulary_5000.py --no-translate   # 不调翻译 API
python3 scripts/build_vocabulary_5000.py                  # 含 Google 翻译中文（需网络）
```

生成后需再次执行 `seed-all-levels.mjs`。
