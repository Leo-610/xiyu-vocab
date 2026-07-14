# 西语同学 A — 词库交付区

请将各等级词库 CSV 放入对应子目录：

| 目录 | 目标词量 | 交付文件 |
|------|----------|----------|
| [A1/](A1/) | 800 | `words_A1.csv` |
| [A2/](A2/) | 1000 | `words_A2.csv` |
| [B1/](B1/) | 1200 | `words_B1.csv` |
| [B2/](B2/) | 1200 | `words_B2.csv` |
| [C1/](C1/) | 400 | `words_C1.csv` |
| [C2/](C2/) | 400 | `words_C2.csv` |

**模板**：[`../word_template.csv`](../word_template.csv)  
**参考样例**：[`../sample_50.csv`](../sample_50.csv)  
**完整 5000 词主表**：[`../vocabulary_5000.csv`](../vocabulary_5000.csv)（已按 DELE 分级 + 专四/专八标签生成，**配图列仅文件名，图片由同学 B 制作**）

重新生成词库（技术同学）：

```bash
python3 scripts/build_vocabulary_5000.py --no-translate   # 仅结构/占位中文
python3 scripts/build_vocabulary_5000.py                  # 含在线翻译中文（需网络）
```

导入全部等级：

```bash
node scripts/seed-all-levels.mjs
```

导入命令（单等级）：

```bash
node backend/src/seed.js data/batches/A1/words_A1.csv
```

## 动词变位（可选列 / 后续 JSON）

动词需在数据库 `conjugation_json` 字段填入变位表，格式见 [`docs/conjugation-schema.json`](../docs/conjugation-schema.json)。

**此部分由西语同学 A 填写，技术端已留好字段与展示组件。**
