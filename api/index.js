/**
 * Vercel Serverless 入口 — 转发到后端 requestHandler
 * 路由：/api/* （见 vercel.json rewrites）
 */
import handler from '../backend/src/index.js'

export default handler
