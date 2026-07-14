# 内容组交付指南（西语两位同学）

技术端已生成 **5000 词分级表**（见 [`data/vocabulary_5000.csv`](../data/vocabulary_5000.csv) 与各等级 [`data/batches/`](../data/batches/)），并已导入 App 数据库。**配图由你们制作**，中文/例句需同学 A 校对。

| 等级 | 词量 | 专四 | 专八 |
|------|------|------|------|
| A1 | 800 | — | — |
| A2 | 1000 | ✓ | — |
| B1 | 1200 | ✓ | — |
| B2 | 1200 | — | ✓ |
| C1 | 400 | — | ✓ |
| C2 | 400 | — | ✓ |
| **合计** | **5000** | ~2200 | ~2000 |

详细说明：[`data/vocabulary_5000_README.md`](../data/vocabulary_5000_README.md)

## 线上词库 · 仅义项表（严格）

App **只使用** `senses_table.xlsx`（**79 义项 / 71 词条 / 79 配图**）。库中多余词已删除。

| 路径 | 说明 |
|------|------|
| 原始表 | [`data/content/senses_table.xlsx`](../data/content/senses_table.xlsx) |
| CSV | [`data/batches/A1/words_senses_team.csv`](../data/batches/A1/words_senses_team.csv) |
| 配图 | `data/images/A1/*.jpg` |

更新 Excel 后请执行：

```bash
python3 scripts/import_senses_xlsx.py
node scripts/reset-to-senses.mjs   # 清空多余词并重导
```

## 同学 A — 词库与语言内容

**当前状态**：5000 词骨架已写好（lemma、等级、标签、干扰项、配图文件名）。**你需要校对**，不是从零建表。

| 交付物 | 路径 | 说明 |
|--------|------|------|
| 校对主表 | `data/vocabulary_5000.csv` 或分等级 `data/batches/*/words_*.csv` | 重点列：`meaning_zh`、`example_es/zh`、`ipa` |
| 考试标签 | 列 **`exam_tags`** | 技术已按等级预填专四/专八，可按考纲增删 |
| 动词变位 | 数据库字段 `conjugation_json` | 格式 [`conjugation-schema.json`](conjugation-schema.json) |
| 易混词辨析 | 表 `confusable_pairs.note_zh` | 已建 ser/estar 等 4 组，**文案显示「待填写」** |
| 例句/干扰项 | CSV 列 | 见 [`spanish-content-guide.md`](spanish-content-guide.md) |

**建议顺序**：先校对 A1 前 100 词（答辩 demo）→ 再按等级推进。

## 同学 B — 视觉与调研

| 交付物 | 路径 | 说明 |
|--------|------|------|
| 配图 800×800 | `data/images/{A1-C2}/{image_file}` | 文件名必须与 CSV 中 `image_file` **完全一致**（如 `hablar.jpg`） |
| 版权台账 | `data/images/COPYRIGHT.md` | 逐图登记 |
| 用户调研 | `docs/survey/` | 问卷 + 30+ 样本 + 分析 |
| 风格样张 | 先 2 张评审 | hablar、casa 等 |

**配图说明**：5000 行 CSV 已写好 `image_file`，**你只需按名出图**；文件放进目录后 App 自动显示，未出图则显示 emoji 占位。**建议先 A1 前 100 张**。

## 进度查看

- **App 首页**：「内容组进度」横幅
- **管理后台**：http://localhost:3000/admin （需先启动后端）
- **API**：`GET /api/content/status`

## 导入（技术同学执行）

```bash
node scripts/seed-all-levels.mjs    # 导入全部 5000 词
node backend/src/seed.js data/batches/A1/words_A1.csv   # 单等级
```

同学 A 改完 CSV 后 @技术同学 重新导入即可。

## 听写练习（第一档 · 新增）

App 已支持「听音写词」。内容要求见 **[听写内容指南](dictation-content-guide.md)**。

| 同学 | 听写相关交付 |
|------|----------------|
| **A** | 试点词单（A1 20～100 词）、lemma/IPA 校对、听写 QC 清单 |
| **B** | 每词 mp3 或确认 TTS 可用、`data/audio/COPYRIGHT.md`、audio_ready 标记 |

## 考试路径（专四 / 专八词包）

- **主等级仍用 DELE**（A1–B2），考试路径只是同一批词的**标签筛选**
- CSV 增加列 **`exam_tags`**：`专四`、`专八`，多个用 `|` 分隔（导入时合并进 `tags`）
- App 首页「考试路径」→ 专四冲刺 / 专八高频 → 复用看图四选一学习页
- 示例：全库约 **专四 2200 词、专八 2000 词**（按等级自动打标，见 `vocabulary_5000.csv`）

| 同学 | 考试路径交付 |
|------|----------------|
| **A** | 按考纲微调 `exam_tags`；校对中文/例句（表已生成） |
| **B** | 无额外 UI；配图/发音与 DELE 词库共用 |

