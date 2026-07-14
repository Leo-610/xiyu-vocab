#!/usr/bin/env bash
# 在本机终端运行（需能打开浏览器登录）：
#   bash scripts/push-github-deploy-vercel.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="$HOME/.local/bin:$PATH"

if ! command -v gh >/dev/null 2>&1; then
  echo "请先安装 GitHub CLI: https://cli.github.com/"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo ">>> 登录 GitHub（浏览器）"
  gh auth login --hostname github.com --git-protocol https --web
fi

OWNER="$(gh api user -q .login)"
REPO_NAME="xiyu-vocab"
FULL="$OWNER/$REPO_NAME"

if gh repo view "$FULL" >/dev/null 2>&1; then
  echo ">>> 仓库已存在: https://github.com/$FULL"
  git remote remove origin 2>/dev/null || true
  git remote add origin "https://github.com/$FULL.git"
  git push -u origin main
else
  echo ">>> 创建并推送公开仓库 $FULL"
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push \
    --description "西语背单词 · DELE 词汇学习（H5 + API）"
fi

echo ">>> 部署到 Vercel 生产环境"
npx --yes vercel@39 login || true
npx --yes vercel@39 link --yes --project xiyu-vocab || true
npx --yes vercel@39 env add ALLOW_DEMO_LOGIN production <<< "true" || true
npx --yes vercel@39 --prod --yes

echo ""
echo "完成。GitHub: https://github.com/$FULL"
echo "Vercel 域名见上方 Production 输出。"
