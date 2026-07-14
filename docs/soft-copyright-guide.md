# 软件著作权申请指南

> **建议时间**：第 9–12 周（与中期材料并行）  
> **申请人**：学校为主体（与小程序主体一致）或项目负责人（按院系规定）  
> **本项目代码量**：前端 + 后端 + 脚本 > 3000 行，满足一般软著要求

---

## 一、材料清单

| 材料 | 说明 | 本项目路径 |
|------|------|------------|
| 申请表 | 中国版权保护中心在线填写 | — |
| 源代码 | 前后各连续 30 页，每页 ≥50 行 | 见第二节 |
| 说明书 | 用户操作手册 10–20 页 | 见第三节 |
| 身份证明 | 学校事业单位法人证书 / 个人身份证 | 院系提供 |
| 代理委托书 | 若委托代理机构 | 可选 |

---

## 二、源代码摘录

### 2.1 建议提交文件（按顺序装订）

**前 30 页**（程序开头）：

1. `backend/src/index.js`
2. `backend/src/services/learning.js`
3. `backend/src/db.js`
4. `frontend/src/pages/learn/learn.vue`
5. `frontend/src/pages/index/index.vue`

**后 30 页**（程序结尾）：

1. `frontend/src/utils/api.js`
2. `frontend/src/pages/stats/stats.vue`
3. `backend/src/services/content.js`
4. `backend/src/services/analytics.js`
5. `scripts/import_words.py`（尾部）

### 2.2 生成脚本

```bash
# 合并并标注页眉（需安装 enscript 或手动 Word 排版）
node scripts/prepare-softcopyright-source.mjs
```

> 若脚本未安装，可用 Word：Courier New 9pt，每页 50 行，页眉「西语背单词 V1.0」。

### 2.3 注意事项

- 删除 `.env`、密钥、真实 AppSecret
- 可保留 `【待填写】` 占位
- 版本号统一：**V1.0**

---

## 三、软件说明书提纲

**封面**：西语背单词软件 V1.0 用户手册

**第 1 章 概述**

- 软件名称、版本、开发完成日期
- 运行环境：微信小程序 / H5；服务器 Node.js 22+
- 面向用户：西语学习者、DELE 考生

**第 2 章 安装与启动**

- 微信小程序搜索/扫码进入
- H5 浏览器访问
- 管理员部署见 `docs/deploy-production.md`

**第 3 章 功能说明**（配截图）

| 章节 | 功能 | 截图 |
|------|------|------|
| 3.1 | 注册/登录（微信） | login 页 |
| 3.2 | 选择 DELE 等级 | 首页 |
| 3.3 | 每日学习（四选一） | learn 页 |
| 3.4 | 错题本与复习 | review 页 |
| 3.5 | 学习统计 | stats 页 |
| 3.6 | 易混词辨析 | confusable 页 |
| 3.7 | 听写练习 | dictation 页 |
| 3.8 | 管理后台 | /admin |

**第 4 章 技术架构**

- 简图 + 数据库表说明（引用 `docs/er-diagram.md`）

**附录**

- 隐私政策摘要
- 联系邮箱

---

## 四、申请流程（摘要）

1. 登录 [中国版权保护中心](https://www.ccopyright.com.cn/)
2. 软件著作权登记 → 计算机软件著作权登记申请
3. 填写软件全称：**西语背单词软件**（或院系审定名称）
4. 上传源代码 + 说明书 PDF
5. 缴费（约 300 元，加急另计）
6. 等待审查（普通 30–60 工作日）

---

## 五、与大创材料的关系

- 中期报告「阶段性成果」栏勾选软著「申报中」
- 结题前拿到证书扫描件
- 证书编号写入结题报告与省级申报书

---

## 六、分工

| 角色 | 任务 |
|------|------|
| 技术同学 | 源代码排版、说明书截图、部署说明 |
| 西语同学 | 说明书「学习功能」章节文案校对 |
| 指导教师 | 确认著作权人、盖章、经费 |

---

**相关**：[midterm-report-outline.md](midterm-report-outline.md) · [compliance.md](compliance.md)
