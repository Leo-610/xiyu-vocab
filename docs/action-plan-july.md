# 7 月行动清单（立项后第 5–8 周）

> 更新：2026-07-12  
> 对照 [大创里程碑](feishu/大创里程碑.csv) 与 [team-roadmap-and-feishu.md](team-roadmap-and-feishu.md)

---

## 本周优先（技术同学）

| # | 任务 | 命令/文档 | 截止 |
|---|------|-----------|------|
| 1 | 跟进学校小程序主体审批 | [school-approval-checklist.md](school-approval-checklist.md) | 尽快 |
| 2 | 填写 `frontend/src/config/app.js` 院系信息 | 指导教师提供 | 上线前 |
| 3 | 生产环境部署体验版 | `./scripts/deploy-production.sh` · [deploy-production.md](deploy-production.md) | 07-15 |
| 4 | 生成体验版二维码发群内测 | [wechat-miniprogram-launch-guide.md](wechat-miniprogram-launch-guide.md) | 07-15 |

---

## 本周优先（西语同学 A）

| # | 任务 | 交付 |
|---|------|------|
| 1 | 校对 A1 前 100 词 `meaning_zh`、例句 | `data/batches/A1/words_A1.csv` |
| 2 | 补充 4 组易混词辨析文案 | 替换 `confusable_pairs` 中「待填写」 |
| 3 | 开始 20 个 A1 动词变位 JSON | [conjugation-schema.json](conjugation-schema.json) |
| 4 | 飞书词库表更新状态 | 每周日 |

---

## 本周优先（西语同学 B）

| # | 任务 | 交付 |
|---|------|------|
| 1 | 风格样张 2 张（hablar、casa）送教师评审 | `data/images/A1/` |
| 2 | 问卷录入飞书并发放 | [survey/questionnaire.md](survey/questionnaire.md) |
| 3 | 年级群/西语群推广试用 | 目标 30 人 |
| 4 | A1 配图先做 30 张 | + [COPYRIGHT.md](../data/images/COPYRIGHT.md) |

---

## 本周优先（指导教师）

| # | 任务 |
|---|------|
| 1 | 确认学校主体注册微信小程序 |
| 2 | 评审配图风格样张（定调后 B 同学批量） |
| 3 | 审阅隐私政策草案 [compliance.md](compliance.md) |

---

## 8 月前里程碑

| 日期 | 里程碑 | 负责人 |
|------|--------|--------|
| 07-22 | 问卷 30 份 + `analysis.md` | 西语 B |
| 07-29 | A1 校对 300 词 | 西语 A |
| 08-15 | 中期报告 + PPT + 数据截图 | 全员 |

中期材料模板：

- [midterm-report-outline.md](midterm-report-outline.md)
- [midterm-ppt-outline.md](midterm-ppt-outline.md)
- [soft-copyright-guide.md](soft-copyright-guide.md)

试用数据：

```bash
npm run dev          # 启动后
npm run export:pilot # 或打开 /admin 下载
```

---

## 已完成（技术端，无需重复开发）

- 5000 词骨架入库
- SM-2 复习 + 错题本 + 听写 + 专四路径
- 管理后台 + 试用数据导出 API
- 部署脚本 + CI 词库导入
- 问卷/中期/软著文档模板
