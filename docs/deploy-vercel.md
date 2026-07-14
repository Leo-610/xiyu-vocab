# Vercel 部署说明

## 架构

- **前端 H5**：`frontend/dist/build/h5` 静态托管
- **API**：`api/index.js` → `backend/src/index.js`（Node 22 serverless）
- **数据库**：`backend/data/xiyu.seed.db` 冷启动时拷到 `/tmp`（演示可用；多实例下进度不保证持久）
- **配图**：构建时复制到 H5 的 `/static/images/`

## 一键部署

```bash
# 需已登录 GitHub / Vercel
npx vercel login
npx vercel --prod
```

环境变量（可选）：

| 变量 | 说明 |
|------|------|
| `ALLOW_DEMO_LOGIN` | 默认 `true`（演示登录） |
| `WECHAT_APPID` / `WECHAT_APPSECRET` | 微信登录时再填 |

## GitHub 连接自动部署

1. 推送到 GitHub
2. [vercel.com](https://vercel.com) → Import Project → 选仓库
3. Framework Preset：Other；Build / Output 已由根目录 `vercel.json` 声明
