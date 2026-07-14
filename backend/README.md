# Backend API

Node.js 22+ 零依赖 HTTP 服务（`node:http` + `node:sqlite`）。详见 [docs/api.md](../docs/api.md)。

```bash
# 无需 npm install
node src/index.js          # http://localhost:3000
node src/seed.js           # 从 data/sample_50.csv 导入词库
node --watch src/index.js  # 开发热重载
```

数据库文件：`backend/data/xiyu.db`（首次启动自动建库并 seed）
