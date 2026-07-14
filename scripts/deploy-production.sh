#!/usr/bin/env bash
# 生产环境一键部署（需已配置服务器 Node 22+、Nginx、HTTPS 证书）
# 用法：./scripts/deploy-production.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f backend/.env ]]; then
  echo "请先复制 backend/.env.example → backend/.env 并填写生产配置"
  exit 1
fi

echo "[deploy] 安装前端依赖"
npm run setup

echo "[deploy] 构建 H5"
npm run build:frontend

echo "[deploy] 构建微信小程序（需填写 AppID）"
npm run build:mp-weixin || echo "[warn] 小程序构建失败，请检查 manifest.json appid"

echo "[deploy] 导入词库"
node scripts/seed-all-levels.mjs

echo "[deploy] 启动后端（PM2 示例）"
if command -v pm2 >/dev/null 2>&1; then
  pm2 start ecosystem.config.cjs --env production || pm2 restart xiyu-api
  pm2 save
  echo "[deploy] PM2 已启动，查看: pm2 logs xiyu-api"
else
  echo "[deploy] 未安装 PM2，请手动运行: NODE_ENV=production node backend/src/index.js"
fi

echo ""
echo "下一步："
echo "  1. Nginx 反代 API → localhost:3000（见 docs/deploy-production.md）"
echo "  2. 前端 dist 部署到静态托管或 CDN"
echo "  3. 微信公众平台配置 request 合法域名"
echo "  4. 上传体验版二维码供院内试用"
