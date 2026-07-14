# 西语背单词

面向 DELE 体系的 Image-based 西语背单词工具（H5 原型 + 本地全栈开发环境）。

## 快速开始

已为你安装 Node.js v22.14.0 + npm（路径：`~/.local/node-v22.14.0-darwin-arm64/`）。

**一键启动（推荐）**：

```bash
cd "/Users/liuyiming/Documents/西语"
./scripts/dev.sh
```

浏览器打开 **http://localhost:5173**；后端 API 在 **http://localhost:3000**。

**或分两个终端**：

```bash
# 先加载 Node（新开终端都需要）
source scripts/env.sh

# 终端 1
node backend/src/index.js

# 终端 2
cd frontend && npm run dev:h5
```

> 若希望永久生效，可在 `~/.zshrc` 末尾加一行：  
> `export PATH="$HOME/.local/node-v22.14.0-darwin-arm64/bin:$PATH"`

详细说明见 [docs/local-dev.md](docs/local-dev.md)。

## 项目结构

```
西语/
├── backend/          # Node.js API（零 npm 依赖）
│   └── src/
│       ├── index.js       # HTTP 服务
│       ├── db.js          # SQLite
│       └── services/learning.js
├── frontend/         # uni-app Vue3 H5 / 小程序
├── data/             # CSV 词库 + 配图
├── scripts/          # Python 导入工具（MySQL 生产用）
└── docs/             # 可研、架构、API 文档
```

## 核心功能

- 每日词包（DELE 分级，默认 10 词）
- 四选一识记 + 例句反馈
- 错题本（服务端持久化）
- 学习统计 + 打卡
- SM-2 复习字段预留（`user_word_progress`）

## 文档索引

| 文档 | 说明 |
|------|------|
| [docs/local-dev.md](docs/local-dev.md) | **本地开发指南** |
| [docs/api.md](docs/api.md) | REST API 文档 |
| [docs/feasibility-study.md](docs/feasibility-study.md) | 可行性研究报告 |
| [docs/dachuang-master-plan.md](docs/dachuang-master-plan.md) | **大创主计划（同步版，含答辩排期表）** |
| [docs/action-plan-july.md](docs/action-plan-july.md) | **7 月行动清单（当前周）** |
| [docs/architecture.md](docs/architecture.md) | 系统架构 |
| [docs/schema.sql](docs/schema.sql) | MySQL 生产建表 |
| [docs/team-roadmap-and-feishu.md](docs/team-roadmap-and-feishu.md) | **后续规划 · 分工 · 飞书协作指南** |
| [docs/feishu/](docs/feishu/) | **飞书多维表格 CSV 导入模板** |
| [docs/team-handoff.md](docs/team-handoff.md) | **西语同学交付指南（内容槽位）** |
| [docs/roadmap-phase2-ui.md](docs/roadmap-phase2-ui.md) | 二期功能与 UI 计划 |
| [docs/deploy-production.md](docs/deploy-production.md) | **生产部署与 HTTPS 体验版** |
| [docs/midterm-report-outline.md](docs/midterm-report-outline.md) | **大创中期报告提纲** |
| [docs/midterm-ppt-outline.md](docs/midterm-ppt-outline.md) | 中期答辩 PPT 大纲 |
| [docs/soft-copyright-guide.md](docs/soft-copyright-guide.md) | 软著申请指南 |
| [docs/survey/questionnaire.md](docs/survey/questionnaire.md) | 用户调研问卷（同学 B） |
| [docs/wechat-miniprogram-launch-guide.md](docs/wechat-miniprogram-launch-guide.md) | **微信小程序申请上线指南** |
| [docs/wechat-registration-approval-flow.md](docs/wechat-registration-approval-flow.md) | **微信注册审批全流程（校内→上架）** |
| [docs/auth-system.md](docs/auth-system.md) | **用户登录体系说明** |
| [docs/database-design.md](docs/database-design.md) | **数据库设计（个人版）** |
| [docs/ui-design-system.md](docs/ui-design-system.md) | **UI 设计系统** |
| [docs/wechat-personal-developer-guide.md](docs/wechat-personal-developer-guide.md) | **个人主体微信注册全流程** |
| [docs/school-approval-checklist.md](docs/school-approval-checklist.md) | **校内审批材料清单（指导教师）** |
| [docs/school-approval-application.md](docs/school-approval-application.md) | **一页纸申请说明**（含 [Word](docs/school-approval-application.docx) / [PDF](docs/school-approval-application.pdf)） |
| [docs/spanish-content-guide.md](docs/spanish-content-guide.md) | 西语同学制作指南 |

## 词库维护

```bash
# 校验 CSV
python3 scripts/import_words.py --csv data/sample_50.csv --dry-run

# 导入 SQLite（通过 backend seed）
npm run seed

# 导入 MySQL（生产环境）
pip install -r scripts/requirements.txt
mysql < docs/schema.sql
python3 scripts/import_words.py --csv data/sample_50.csv --host 127.0.0.1 --user root --password xxx
```

## 已实现功能（技术端）

- SM-2 间隔复习（混入每日词包 + 错题专项复习）
- **双通道登录**：H5 演示注册/登录 + 微信 openid 登录（会话 30 天、服务端登出）
- 易混词页（辨析文案待西语同学填写）
- 动词变位卡片占位 + TTS 发音（H5）
- 打卡热力图、隐私/用户协议页
- 管理后台：http://localhost:3000/admin
- 内容进度 API：`/api/content/status`
- 试用数据导出：`/api/admin/pilot-report` · `npm run export:pilot`

## 答辩 Demo 流程

1. `npm run dev` 启动全栈
2. 首页选 DELE 等级 → 开始今日学习
3. 故意答错 1–2 词 → 错题本查看
4. 统计页展示进度与大创路线

## 团队

- 西语同学 ×2：词库、配图、质检
- 技术同学 ×1：架构、全栈开发
