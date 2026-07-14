import { createServer } from 'node:http'
import { parse as parseUrl } from 'node:url'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db, { getDbPath } from './db.js'
import { getConfig } from './config.js'
import { runMigrations } from './migrate.js'
import { seedWords, wordCount } from './seed.js'
import { authMiddleware, loginUser, registerUser, loginWechatUser, logoutUser, formatAuthMeta } from './middleware/auth.js'
import { code2Session } from './services/wechat.js'
import {
  buildUserState,
  getMixedDailyPack,
  getMistakeReviewPack,
  getDictationPack,
  checkDictationAnswer,
  recordAnswer,
  finishSession,
  getStats,
  resetUserProgress,
  resetTodaySession,
} from './services/learning.js'
import {
  needsProfile,
  updateUserProfile,
  saveUserAvatar,
} from './services/user.js'
import { parseMultipart } from './utils/multipart.js'
import {
  getContentStatus,
  seedConfusablePairs,
  getConfusablePairs,
  getWordDetail,
} from './services/content.js'
import { getPilotReport } from './services/analytics.js'
import { updateUserSettings } from './services/studyEvents.js'
import { getExamPack, getExamSummaries, EXAM_PACKS } from './services/exam.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', '..')
const ADMIN_DIR = path.join(ROOT, 'admin')
const appConfig = getConfig()
const PORT = appConfig.port
const HOST = appConfig.host

runMigrations(db)
seedConfusablePairs()

if (wordCount() === 0) {
  console.log('[db] 词库为空，正在从义项表 CSV 导入...')
  const n = seedWords()
  console.log(`[db] 已导入 ${n} 个义项`)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      if (!data) return resolve({})
      try {
        resolve(JSON.parse(data))
      } catch {
        resolve({})
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  })
  res.end(body)
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    return sendJson(res, 404, { error: 'Not Found' })
  }
  const ext = path.extname(filePath).toLowerCase()
  const types = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.html': 'text/html; charset=utf-8',
    '.css': 'text/css', '.js': 'application/javascript',
  }
  res.writeHead(200, {
    'Content-Type': types[ext] || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*',
  })
  fs.createReadStream(filePath).pipe(res)
}

async function handleApi(req, res, pathname, query) {
  const method = req.method

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    })
    return res.end()
  }

  if (pathname === '/api/health' && method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      words: wordCount(),
      db: getDbPath(),
      time: new Date().toISOString(),
      content: getContentStatus(),
      auth: {
        wechat: appConfig.wechatConfigured,
        demoLogin: appConfig.allowDemoLogin,
        env: appConfig.nodeEnv,
      },
    })
  }

  if (pathname === '/api/content/status' && method === 'GET') {
    return sendJson(res, 200, getContentStatus())
  }

  if (pathname === '/api/admin/pilot-report' && method === 'GET') {
    return sendJson(res, 200, getPilotReport(db))
  }

  if (pathname === '/api/login' && method === 'POST') {
    if (appConfig.isProduction && !appConfig.allowDemoLogin) {
      return sendJson(res, 403, {
        error: '演示登录已关闭，请使用微信登录',
        code: 'DEMO_LOGIN_DISABLED',
      })
    }
    const body = await readBody(req)
    try {
      const user = loginUser(body.nickname || '演示用户')
      return sendJson(res, 200, {
        token: user.session_token,
        user: buildUserState(db, user.id),
      })
    } catch (err) {
      const status = err.code === 'USER_NOT_FOUND' ? 404 : 400
      return sendJson(res, status, { error: err.message, code: err.code || 'LOGIN_FAILED' })
    }
  }

  if (pathname === '/api/register' && method === 'POST') {
    if (appConfig.isProduction && !appConfig.allowDemoLogin) {
      return sendJson(res, 403, {
        error: '演示注册已关闭，请使用微信登录',
        code: 'DEMO_LOGIN_DISABLED',
      })
    }
    const body = await readBody(req)
    try {
      const user = registerUser(body.nickname)
      return sendJson(res, 200, {
        token: user.session_token,
        user: buildUserState(db, user.id),
      })
    } catch (err) {
      const status = err.code === 'NICKNAME_TAKEN' ? 409 : 400
      return sendJson(res, status, { error: err.message, code: err.code || 'REGISTER_FAILED' })
    }
  }

  if (pathname === '/api/auth/wechat' && method === 'POST') {
    const body = await readBody(req)
    if (!body.code) {
      return sendJson(res, 400, { error: '缺少 code', code: 'MISSING_CODE' })
    }
    try {
      const { openid, unionid } = await code2Session(body.code)
      const user = loginWechatUser(openid, body.nickname || '微信用户', unionid)
      return sendJson(res, 200, {
        token: user.session_token,
        user: buildUserState(db, user.id),
        ...formatAuthMeta(user),
      })
    } catch (err) {
      const status = err.code === 'WECHAT_NOT_CONFIGURED' ? 503
        : err.code === 'WECHAT_API_ERROR' ? 502
          : 400
      return sendJson(res, status, {
        error: err.message,
        code: err.code || 'WECHAT_LOGIN_FAILED',
        wechatErrcode: err.wechatErrcode,
      })
    }
  }

  const authResult = authMiddleware(req)
  if (!authResult.ok && pathname.startsWith('/api/')
    && pathname !== '/api/login'
    && pathname !== '/api/register'
    && pathname !== '/api/auth/wechat') {
    return sendJson(res, authResult.status, { error: authResult.error, code: authResult.code })
  }
  const user = authResult.user

  if (pathname === '/api/auth/logout' && method === 'POST') {
    logoutUser(user.id)
    return sendJson(res, 200, { ok: true })
  }

  if (pathname === '/api/auth/session' && method === 'GET') {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)
    return sendJson(res, 200, {
      valid: true,
      user: buildUserState(db, user.id),
      ...formatAuthMeta(row),
    })
  }

  if (pathname === '/api/me' && method === 'GET') {
    return sendJson(res, 200, buildUserState(db, user.id))
  }

  if (pathname === '/api/settings' && method === 'PATCH') {
    const body = await readBody(req)
    const allowed = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    if (body.targetLevel && allowed.includes(body.targetLevel)) {
      db.prepare('UPDATE users SET target_level = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(body.targetLevel, user.id)
    }
    if (body.dailyNew && Number.isInteger(body.dailyNew) && body.dailyNew > 0 && body.dailyNew <= 50) {
      db.prepare('UPDATE users SET daily_new = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(body.dailyNew, user.id)
    }
    const settingsPatch = {}
    if (typeof body.soundEnabled === 'boolean') settingsPatch.soundEnabled = body.soundEnabled
    if (typeof body.vibrationEnabled === 'boolean') settingsPatch.vibrationEnabled = body.vibrationEnabled
    if (typeof body.showIpa === 'boolean') settingsPatch.showIpa = body.showIpa
    if (Object.keys(settingsPatch).length) {
      updateUserSettings(db, user.id, settingsPatch)
    }
    if (body.privacyAgreed === true) {
      db.prepare(`
        UPDATE users SET privacy_agreed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
      `).run(user.id)
    }
    return sendJson(res, 200, buildUserState(db, user.id))
  }

  if (pathname === '/api/me/profile' && method === 'PATCH') {
    const body = await readBody(req)
    try {
      if (body.nickname !== undefined) {
        updateUserProfile(db, user.id, { nickname: body.nickname })
      }
      return sendJson(res, 200, buildUserState(db, user.id))
    } catch (err) {
      return sendJson(res, 400, { error: err.message, code: err.code || 'PROFILE_UPDATE_FAILED' })
    }
  }

  if (pathname === '/api/user/avatar' && method === 'POST') {
    try {
      const { file, fields } = await parseMultipart(req)
      if (!file?.data?.length) {
        return sendJson(res, 400, { error: '请上传头像文件', code: 'MISSING_FILE' })
      }
      saveUserAvatar(db, user.id, file.data, file.mimeType)
      if (fields.nickname) {
        updateUserProfile(db, user.id, { nickname: fields.nickname })
      }
      return sendJson(res, 200, {
        avatarUrl: db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(user.id).avatar_url,
        user: buildUserState(db, user.id),
      })
    } catch (err) {
      const status = err.code === 'FILE_TOO_LARGE' ? 413 : 400
      return sendJson(res, status, { error: err.message, code: err.code || 'UPLOAD_FAILED' })
    }
  }

  if (pathname === '/api/words/daily' && method === 'GET') {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)
    const session = buildUserState(db, user.id).todaySession
    if (session.finished) {
      return sendJson(res, 200, { words: [], finished: true, message: '今日学习已完成' })
    }
    const remaining = Math.max(u.daily_new - session.total, 0)
    const count = Math.min(parseInt(query.count, 10) || remaining || u.daily_new, u.daily_new)
    const words = getMixedDailyPack(db, user.id, count > 0 ? count : u.daily_new)
    const newCount = words.filter((w) => w.studyMode === 'new').length
    const reviewCount = words.filter((w) => w.studyMode === 'review').length
    return sendJson(res, 200, {
      words, count: words.length, newCount, reviewCount, finished: false,
    })
  }

  if (pathname === '/api/exams' && method === 'GET') {
    return sendJson(res, 200, { packs: getExamSummaries(db, user.id) })
  }

  if (pathname === '/api/words/exam' && method === 'GET') {
    const packId = query.pack
    if (!packId || !EXAM_PACKS[packId]) {
      return sendJson(res, 400, { error: '参数错误: pack 需为 tem4 或 tem8' })
    }
    const count = Math.min(parseInt(query.count, 10) || 10, 20)
    const result = getExamPack(db, packId, user.id, count)
    if (!result.words.length) {
      return sendJson(res, 200, {
        ...result,
        empty: true,
        message: `暂无「${result.pack.tag}」标签单词，请内容组在 CSV tags/exam_tags 中补充`,
      })
    }
    return sendJson(res, 200, result)
  }

  if (pathname === '/api/words/dictation' && method === 'GET') {
    const count = Math.min(parseInt(query.count, 10) || 10, 20)
    const words = getDictationPack(db, user.id, count)
    return sendJson(res, 200, { words, count: words.length })
  }

  if (pathname === '/api/words/dictation/check' && method === 'POST') {
    const body = await readBody(req)
    if (!body.wordId || body.answer === undefined || body.answer === null) {
      return sendJson(res, 400, { error: '参数错误: 需要 wordId 与 answer' })
    }
    const result = checkDictationAnswer(db, user.id, body.wordId, String(body.answer))
    if (!result) return sendJson(res, 404, { error: '单词不存在' })
    return sendJson(res, 200, result)
  }

  if (pathname === '/api/words/review' && method === 'GET') {
    const mode = query.mode || 'mistakes'
    const count = Math.min(parseInt(query.count, 10) || 10, 20)
    const words = mode === 'due'
      ? getMixedDailyPack(db, user.id, count).filter((w) => w.studyMode === 'review')
      : getMistakeReviewPack(db, user.id, count)
    return sendJson(res, 200, { words, count: words.length, mode })
  }

  if (pathname === '/api/confusables' && method === 'GET') {
    return sendJson(res, 200, { pairs: getConfusablePairs() })
  }

  if (pathname === '/api/words/answer' && method === 'POST') {
    const body = await readBody(req)
    if (!body.wordId || typeof body.isCorrect !== 'boolean') {
      return sendJson(res, 400, { error: '参数错误: 需要 wordId 与 isCorrect' })
    }
    const word = db.prepare('SELECT id FROM words WHERE id = ?').get(body.wordId)
    if (!word) return sendJson(res, 404, { error: '单词不存在' })
    return sendJson(res, 200, recordAnswer(
      db, user.id, body.wordId, body.isCorrect, body.studyMode || 'new'
    ))
  }

  if (pathname === '/api/mistakes' && method === 'GET') {
    const rows = db.prepare(`
      SELECT mb.word_id AS wordId, mb.wrong_at AS wrongAt,
             w.lemma, w.meaning_zh, w.level, w.example_es, w.example_zh, w.ipa, w.pos, w.tags
      FROM mistake_book mb
      JOIN words w ON w.id = mb.word_id
      WHERE mb.user_id = ? AND mb.resolved = 0
      ORDER BY mb.wrong_at DESC
    `).all(user.id)

    const mistakes = rows.map((row) => {
      let tags = []
      try { tags = row.tags ? JSON.parse(row.tags) : [] } catch { /* ignore */ }
      return { ...row, tags }
    })
    return sendJson(res, 200, { mistakes, total: mistakes.length })
  }

  if (pathname === '/api/stats' && method === 'GET') {
    return sendJson(res, 200, getStats(db, user.id))
  }

  if (pathname === '/api/session/finish' && method === 'POST') {
    return sendJson(res, 200, finishSession(db, user.id))
  }

  if (pathname === '/api/words' && method === 'GET') {
    return sendJson(res, 200, { total: wordCount() })
  }

  const wordMatch = pathname.match(/^\/api\/words\/(\d+)$/)
  if (wordMatch && method === 'GET') {
    const detail = getWordDetail(db, wordMatch[1])
    if (!detail) return sendJson(res, 404, { error: '单词不存在' })
    return sendJson(res, 200, detail)
  }

  if (pathname === '/api/dev/reset' && method === 'POST') {
    if (appConfig.isProduction) {
      return sendJson(res, 403, { error: '生产环境不可用' })
    }
    return sendJson(res, 200, resetUserProgress(db, user.id))
  }

  if (pathname === '/api/dev/reset-today' && method === 'POST') {
    if (appConfig.isProduction) {
      return sendJson(res, 403, { error: '生产环境不可用' })
    }
    return sendJson(res, 200, resetTodaySession(db, user.id))
  }

  return sendJson(res, 404, { error: 'Not Found' })
}

export async function requestHandler(req, res) {
  try {
    const parsed = parseUrl(req.url, true)
    const pathname = parsed.pathname

    if (pathname.startsWith('/static/images/')) {
      const rel = pathname.slice('/static/images/'.length)
      const safe = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '')
      return sendFile(res, path.join(ROOT, 'data', 'images', safe))
    }

    if (pathname.startsWith('/static/avatars/')) {
      const filename = path.basename(pathname)
      return sendFile(res, path.join(ROOT, 'backend', 'data', 'avatars', filename))
    }

    if (pathname === '/admin' || pathname === '/admin/') {
      return sendFile(res, path.join(ADMIN_DIR, 'index.html'))
    }
    if (pathname.startsWith('/admin/')) {
      const rel = pathname.slice('/admin/'.length)
      const safe = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '')
      return sendFile(res, path.join(ADMIN_DIR, safe))
    }

    if (pathname.startsWith('/api/')) {
      return handleApi(req, res, pathname, parsed.query)
    }

    return sendJson(res, 404, { error: 'Not Found' })
  } catch (err) {
    console.error(err)
    sendJson(res, 500, { error: err.message || '服务器错误' })
  }
}

export default requestHandler

// 本地开发启动 HTTP；Vercel 用 serverless 默认导出
if (!process.env.VERCEL && process.env.XIYU_NO_LISTEN !== '1') {
  const server = createServer(requestHandler)
  server.listen(PORT, HOST, () => {
    console.log(`[server] 西语背单词 API → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`)
    console.log(`[server] 健康检查 → http://localhost:${PORT}/api/health`)
    console.log(`[server] 词库 ${wordCount()} 词 · 数据库 ${getDbPath()}`)
    console.log(`[server] 微信登录 ${appConfig.wechatConfigured ? '已配置' : '未配置（填 backend/.env）'}`)
    console.log(`[server] 演示登录 ${appConfig.allowDemoLogin ? '开启' : '关闭'} · NODE_ENV=${appConfig.nodeEnv}`)
  })
}
