# 内容组交付 · 义项表（App 唯一词库）

App **严格只使用本表**，其它词库文件不作为线上数据源。

| 文件 | 说明 |
|------|------|
| `senses_table.xlsx` | 同学交付的原始表（含内嵌配图） |
| 导入脚本 | `scripts/import_senses_xlsx.py` |
| 生成 CSV | `data/batches/A1/words_senses_team.csv` |
| 配图输出 | `data/images/A1/*.jpg` |
| 重置库 | `node scripts/reset-to-senses.mjs`（清空多余词，只留本表） |

## 重新导入（覆盖）

```bash
python3 scripts/import_senses_xlsx.py
# 若生成 png，可再压成 jpg 后：
node scripts/reset-to-senses.mjs
```
