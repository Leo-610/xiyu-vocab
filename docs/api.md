# REST API 文档

Base URL: `http://localhost:3000/api`

认证方式：除 `/login` 与 `/health` 外，请求头需携带：

```
Authorization: Bearer <token>
```

---

## 健康检查

`GET /api/health`

响应示例：

```json
{
  "ok": true,
  "words": 51,
  "db": "/path/to/xiyu.db",
  "time": "2026-06-03T12:00:00.000Z"
}
```

---

## 认证

### 登录（H5 演示用户）

`POST /api/login`

> 生产环境默认关闭（`NODE_ENV=production` 且 `ALLOW_DEMO_LOGIN≠true`）。

```json
{ "nickname": "演示用户" }
```

响应：

```json
{
  "token": "abc123...",
  "user": {
    "userId": 1,
    "nickname": "演示用户",
    "targetLevel": "A2",
    "dailyNew": 10,
    "streakDays": 0,
    "learnedIds": [],
    "mistakes": [],
    "todaySession": { "date": "2026-06-03", "total": 0, "correct": 0, "wrong": 0, "finished": false }
  }
}
```

### 微信登录（小程序）

`POST /api/auth/wechat`

服务端用 `code` 调微信 `jscode2session` 换 `openid`，返回本站 `token`。

环境变量（`backend/.env`）：`WECHAT_APPID`、`WECHAT_APPSECRET`

```json
{ "code": "081xxxxx", "nickname": "微信用户" }
```

`code` 来自小程序 `uni.login()`，5 分钟有效、仅用一次。响应格式同 `/api/login`。

| code | 说明 |
|------|------|
| `MISSING_CODE` | 未传 code |
| `WECHAT_NOT_CONFIGURED` | 未配置 AppID/Secret |
| `WECHAT_API_ERROR` | 微信接口 errcode |

### 演示注册（H5）

`POST /api/register`

```json
{ "nickname": "西语2024张三" }
```

昵称唯一，重复返回 `409` / `NICKNAME_TAKEN`。响应格式同登录。

演示登录 `POST /api/login` 仅允许**已注册**昵称；未注册返回 `404` / `USER_NOT_FOUND`。

### 校验会话

`GET /api/auth/session`

请求头携带 `Authorization: Bearer <token>`。用于启动时验证 token 是否仍有效。

响应：

```json
{
  "valid": true,
  "authType": "wechat",
  "sessionExpiresAt": "2026-08-11T12:00:00.000Z",
  "lastLoginAt": "2026-07-12T12:00:00.000Z",
  "user": { "userId": 1, "nickname": "Maria", "needsProfile": false }
}
```

过期返回 `401` / `TOKEN_EXPIRED`；无效 token 返回 `401` / `INVALID_TOKEN`。

### 登出

`POST /api/auth/logout`

服务端作废当前 token。前端应同时清除本地 `auth_token`。

### 更新资料

`PATCH /api/me/profile`

```json
{ "nickname": "Maria" }
```

### 上传头像（小程序）

`POST /api/user/avatar` — `multipart/form-data`，字段 `file`（图片），可选 `nickname`

响应含 `avatarUrl` 与完整 `user` 状态。头像访问路径：`GET /static/avatars/{userId}.jpg`

用户状态字段：`avatarUrl`、`isWechatUser`、`needsProfile`（微信用户且昵称为「微信用户」时为 true）

### 获取当前用户状态

`GET /api/me`

### 更新设置

`PATCH /api/settings`

```json
{ "targetLevel": "A1", "dailyNew": 10 }
```

---

## 学习

### 获取今日词包

`GET /api/words/daily?count=10`

响应：

```json
{
  "words": [
    {
      "id": 1,
      "lemma": "hola",
      "level": "A1",
      "meaning_zh": "你好",
      "options": [
        { "text": "你好", "correct": true },
        { "text": "再见", "correct": false }
      ],
      "example_es": "¡Hola!",
      "tags": ["日常", "问候"]
    }
  ],
  "count": 10,
  "finished": false
}
```

### 提交答案

`POST /api/words/answer`

```json
{ "wordId": 1, "isCorrect": true }
```

响应含更新后的 `state` 与 `word` 详情。

### 完成今日学习

`POST /api/session/finish`

更新打卡天数，标记今日会话完成。

---

## 错题本

`GET /api/mistakes`

```json
{
  "mistakes": [
    {
      "wordId": 15,
      "lemma": "ser",
      "meaning_zh": "是（本质）",
      "level": "A1",
      "wrongAt": "2026-06-03 10:30:00",
      "example_es": "Soy de China."
    }
  ],
  "total": 1
}
```

---

## 统计

`GET /api/stats`

返回用户状态 + `levelBars`（各 DELE 等级已学/总量）+ `accuracy`（今日正确率）。

---

## 管理 / 内容（无需登录）

`GET /api/content/status` — 词库与配图缺口、团队任务板数据

`GET /api/admin/pilot-report` — 院内试用汇总（用户数、答题量、正确率、打卡、分级进度），用于大创中期附件

```bash
npm run export:pilot
# → docs/survey/results/pilot-report-YYYY-MM-DD.json
```

管理后台可视化：http://localhost:3000/admin

---

## 开发接口（非生产）

`POST /api/dev/reset` — 清空进度与错题本

`POST /api/dev/reset-today` — 仅重置今日会话

---

## 词库

`GET /api/words` — 返回 `{ "total": 51 }`

`GET /api/words/:id` — 单词详情

---

## 静态资源

配图：`GET /static/images/<filename>`（映射至 `data/images/`）
