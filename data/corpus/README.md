# RAG 语料（可溯源例句）

自制短句池，供检索增强（RAG）。**禁止**整段抄录 DELE 真题或未授权教材。

## 格式

`data/corpus/{level}/*.jsonl`，每行一个 JSON：

```json
{"source":"team-a1-2026","level":"A1","text_es":"Quiero un café.","text_zh":"我想要一杯咖啡。","lemmas":["querer","café"]}
```

| 字段 | 说明 |
|------|------|
| source | 出处标签（展示给用户） |
| level | A1–C2 |
| text_es | 西语例句 |
| text_zh | 中文（可选） |
| lemmas | 关联词形（小写） |

## 导入

```bash
node scripts/import-corpus.mjs
# 同时从词库 example_es 回填：
node scripts/import-corpus.mjs --from-words
```
