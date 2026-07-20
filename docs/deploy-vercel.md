# Vercel 部署说明

## 架构

- **前端 H5**：`frontend/dist/build/h5` 静态托管
- **API**：`api/index.js` → `backend/src/index.js`（Node 22 serverless）
- **数据库（生产推荐）**：**Turso**（托管 libSQL / SQLite 兼容）— 账号与学习进度正式留存
- **数据库（回退）**：未配置 Turso 时仍用 `xiyu.seed.db` 拷到 `/tmp`（演示可用，冷启动可能丢用户）
- **配图**：构建时复制到 H5 的 `/static/images/`

## 一键部署

```bash
# 需已登录 GitHub / Vercel
npx vercel login
npx vercel --prod
```

## Turso 持久化（正式账号）

### 1. 创建库

```bash
# https://turso.tech → 安装 CLI 后
turso auth login
turso db create xiyu-vocab
turso db show xiyu-vocab          # 复制 URL
turso db tokens create xiyu-vocab # 复制 Token
```

### 2. 灌入词库与语料

```bash
export TURSO_DATABASE_URL='libsql://xxxx.turso.io'
export TURSO_AUTH_TOKEN='eyJ...'
npm run db:push-turso
# 已有线上用户、只更新词库时：
# node scripts/push-db-to-turso.mjs --keep-users
```

### 3. Vercel 环境变量（Production）

| 变量 | 说明 |
|------|------|
| `TURSO_DATABASE_URL` | `libsql://...` |
| `TURSO_AUTH_TOKEN` | Turso token |
| `ALLOW_DEMO_LOGIN` | 默认 `true`（演示登录） |
| `WECHAT_APPID` / `WECHAT_APPSECRET` | 微信登录时再填 |
| `AUTH_RESEND_KEY` | 邮箱验证码（可选） |
| `AI_GATEWAY_API_KEY` / `OPENAI_API_KEY` | LLM 错题解析（可选） |

配置后重新部署。健康检查应出现：

```json
{ "dbBackend": "turso" }
```

本地开发不设上述变量时仍用 `backend/data/xiyu.db`（`dbBackend: "sqlite-local"`）。

## GitHub 连接自动部署

1. 推送到 GitHub
2. [vercel.com](https://vercel.com) → Import Project → 选仓库
3. Framework Preset：Other；Build / Output 已由根目录 `vercel.json` 声明
