#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
source scripts/env.sh

if [ -f backend/.env ]; then
  set -a
  # shellcheck disable=SC1091
  source backend/.env
  set +a
fi

echo "==> 启动后端 http://localhost:3000"
node backend/src/index.js &
BACKEND_PID=$!

cleanup() {
  kill $BACKEND_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 1
echo "==> 启动前端 http://localhost:5173"
cd frontend && npm run dev:h5
