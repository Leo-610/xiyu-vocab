import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENV_PATH = path.join(__dirname, '..', '.env')

function loadEnvFile() {
  if (!fs.existsSync(ENV_PATH)) return
  const content = fs.readFileSync(ENV_PATH, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = val
    }
  }
}

loadEnvFile()

export function getConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development'
  const wechatAppId = process.env.WECHAT_APPID || ''
  const wechatAppSecret = process.env.WECHAT_APPSECRET || ''
  // Vercel 预览/演示默认开演示登录；生产服务器可设 ALLOW_DEMO_LOGIN=false
  const allowDemoLogin = process.env.ALLOW_DEMO_LOGIN === 'true'
    || (process.env.VERCEL && process.env.ALLOW_DEMO_LOGIN !== 'false')
    || (nodeEnv !== 'production' && process.env.ALLOW_DEMO_LOGIN !== 'false')
  const resendApiKey = process.env.AUTH_RESEND_KEY || process.env.RESEND_API_KEY || ''

  return {
    nodeEnv,
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || '0.0.0.0',
    wechatAppId,
    wechatAppSecret,
    wechatConfigured: Boolean(wechatAppId && wechatAppSecret),
    resendApiKey,
    emailAuthConfigured: Boolean(resendApiKey),
    allowDemoLogin,
    isProduction: nodeEnv === 'production',
  }
}
