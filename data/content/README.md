# 内容组交付 · 义项表

| 文件 | 说明 |
|------|------|
| `senses_table.xlsx` | 同学交付的原始表（含内嵌配图） |
| 导入脚本 | `scripts/import_senses_xlsx.py` |
| 生成 CSV | `data/batches/A1/words_senses_team.csv` |
| 配图输出 | `data/images/A1/*.png` |

## 重新导入

```bash
python3 scripts/import_senses_xlsx.py
node backend/src/seed.js data/batches/A1/words_senses_team.csv
```

App 学习模式会**优先抽取**带「义项包」标签的词。
