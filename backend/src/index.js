import { createServer } from 'node:http';
import { parse as parseUrl } from 'node:url';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { getDbPath, getDbBackend, ensureSchema } from './db.js';
import { getConfig } from './config.js';
import { runMigrations } from './migrate.js';
import { seedWords, wordCount } from './seed.js';
import { authMiddleware, loginUser, registerUser, loginPasswordUser, registerPasswordUser, loginWechatUser, loginEmailUser, logoutUser, formatAuthMeta } from './middleware/auth.js';
import { code2Session } from './services/wechat.js';
import { sendEmailLoginOtp, verifyEmailLoginOtp, isValidEmail, normalizeEmail } from './services/emailOtp.js';
import { checkRateLimit, getClientIp } from './services/rateLimit.js';
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
  resetTodaySession } from
'./services/learning.js';
import {
  needsProfile,
  updateUserProfile,
  saveUserAvatar } from
'./services/user.js';
import { parseMultipart } from './utils/multipart.js';
import {
  getContentStatus,
  seedConfusablePairs,
  getConfusablePairs,
  getWordDetail } from
'./services/content.js';
import { getPilotReport } from './services/analytics.js';
import { updateUserSettings } from './services/studyEvents.js';
import { getExamPack, getExamSummaries, EXAM_PACKS } from './services/exam.js';
import { retrieveExamplesForWord, corpusStats } from './services/rag.js';
import { explainMistake, listAiReviews, reviewAiItem, llmStatus } from './services/llm.js';
import { ensureAllUsersHaveArm, ragFeaturesEnabled } from './services/experiment.js';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const ADMIN_DIR = path.join(ROOT, 'admin');
const appConfig = getConfig();
const PORT = appConfig.port;
const HOST = appConfig.host;

await ensureSchema();
await runMigrations(db);
await seedConfusablePairs();
await ensureAllUsersHaveArm();
if ((await corpusStats()).chunks === 0) {
  try {
    spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'import-corpus.mjs'), '--from-words'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env
    });
  } catch (e) {
    console.warn('[corpus] auto-import skipped:', e.message);
  }
}

if ((await wordCount()) === 0) {
  console.log('[db] 词库为空，正在从义项表 CSV 导入...');
  const n = await seedWords();
  console.log(`[db] 已导入 ${n} 个义项`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {data += chunk;});
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS'
  });
  res.end(body);
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    return sendJson(res, 404, { error: 'Not Found' });
  }
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.html': 'text/html; charset=utf-8',
    '.css': 'text/css', '.js': 'application/javascript'
  };
  res.writeHead(200, {
    'Content-Type': types[ext] || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*'
  });
  fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res, pathname, query) {
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS'
    });
    return res.end();
  }

  if (pathname === '/api/health' && method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      words: await wordCount(),
      db: getDbPath(),
      dbBackend: getDbBackend(),
      time: new Date().toISOString(),
      content: await getContentStatus(),
      auth: {
        wechat: appConfig.wechatConfigured,
        email: appConfig.emailAuthConfigured,
        password: true,
        demoLogin: appConfig.allowDemoLogin,
        env: appConfig.nodeEnv
      },
      rag: await corpusStats(),
      llm: await llmStatus()
    });
  }

  if (pathname === '/api/content/status' && method === 'GET') {
    return sendJson(res, 200, await getContentStatus());
  }

  if (pathname === '/api/admin/pilot-report' && method === 'GET') {
    return sendJson(res, 200, await getPilotReport(db));
  }

  if (pathname === '/api/admin/ai-reviews' && method === 'GET') {
    const status = query.status || 'pending';
    return sendJson(res, 200, { reviews: await listAiReviews({ status, limit: parseInt(query.limit, 10) || 50 }), llm: await llmStatus() });
  }

  if (pathname.match(/^\/api\/admin\/ai-reviews\/\d+$/) && method === 'POST') {
    const id = parseInt(pathname.split('/').pop(), 10);
    const body = await readBody(req);
    try {
      const item = await reviewAiItem(id, { status: body.status, reviewer: body.reviewer });
      return sendJson(res, 200, { ok: true, review: item });
    } catch (err) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return sendJson(res, status, { error: err.message, code: err.code || 'REVIEW_FAILED' });
    }
  }

  if (pathname.startsWith('/api/admin/')) {
    return sendJson(res, 404, { error: 'Not Found' });
  }

  if (pathname === '/api/login' && method === 'POST') {
    const body = await readBody(req);
    const password = body.password;
    // 正式：邮箱/手机号（或旧昵称）+ 密码
    if (password !== undefined && password !== null && String(password).length > 0) {
      try {
        const user = await loginPasswordUser({
          account: body.account || null,
          nickname: body.nickname || null,
          password
        });
        return sendJson(res, 200, {
          token: user.session_token,
          user: await buildUserState(db, user.id)
        });
      } catch (err) {
        const status = err.code === 'USER_NOT_FOUND' || err.code === 'INVALID_CREDENTIALS' ? 401 :
        err.code === 'INVALID_PASSWORD' || err.code === 'WEAK_PASSWORD' ||
        err.code === 'INVALID_ACCOUNT' || err.code === 'INVALID_EMAIL' ||
        err.code === 'INVALID_PHONE' || err.code === 'INVALID_NICKNAME' ? 400 :
        400;
        return sendJson(res, status, { error: err.message, code: err.code || 'LOGIN_FAILED' });
      }
    }
    // 兼容：无密码的演示登录
    if (appConfig.isProduction && !appConfig.allowDemoLogin) {
      return sendJson(res, 403, {
        error: '请使用账号密码登录',
        code: 'PASSWORD_REQUIRED'
      });
    }
    try {
      const user = await loginUser(body.nickname || '演示用户');
      return sendJson(res, 200, {
        token: user.session_token,
        user: await buildUserState(db, user.id)
      });
    } catch (err) {
      const status = err.code === 'USER_NOT_FOUND' || err.code === 'PASSWORD_REQUIRED' ? 404 : 400;
      return sendJson(res, status, { error: err.message, code: err.code || 'LOGIN_FAILED' });
    }
  }

  if (pathname === '/api/register' && method === 'POST') {
    const body = await readBody(req);
    const password = body.password;
    if (password !== undefined && password !== null && String(password).length > 0) {
      try {
        const account = body.account || body.email || body.phone || body.nickname;
        const user = await registerPasswordUser({
          account,
          password,
          email: body.email || (String(account || '').includes('@') ? account : null),
          nickname: body.nickname || null
        });
        return sendJson(res, 200, {
          token: user.session_token,
          user: await buildUserState(db, user.id)
        });
      } catch (err) {
        const status = ['NICKNAME_TAKEN', 'EMAIL_TAKEN', 'PHONE_TAKEN', 'ACCOUNT_TAKEN'].includes(err.code) ?
        409 :
        400;
        return sendJson(res, status, { error: err.message, code: err.code || 'REGISTER_FAILED' });
      }
    }
    if (appConfig.isProduction && !appConfig.allowDemoLogin) {
      return sendJson(res, 403, {
        error: '请使用账号密码注册',
        code: 'PASSWORD_REQUIRED'
      });
    }
    try {
      const user = await registerUser(body.nickname);
      return sendJson(res, 200, {
        token: user.session_token,
        user: await buildUserState(db, user.id)
      });
    } catch (err) {
      const status = err.code === 'NICKNAME_TAKEN' ? 409 : 400;
      return sendJson(res, status, { error: err.message, code: err.code || 'REGISTER_FAILED' });
    }
  }

  if (pathname === '/api/auth/email/send' && method === 'POST') {
    if (!appConfig.emailAuthConfigured) {
      return sendJson(res, 503, {
        error: '邮箱登录尚未配置',
        code: 'EMAIL_AUTH_NOT_CONFIGURED'
      });
    }
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) {
      return sendJson(res, 400, { error: '请输入有效的邮箱地址', code: 'INVALID_EMAIL' });
    }
    const rate = checkRateLimit('email_signin', getClientIp(req));
    if (!rate.allowed) {
      return sendJson(res, 429, { error: rate.error, code: 'RATE_LIMITED' });
    }
    const result = await sendEmailLoginOtp(email);
    if (result.error) {
      return sendJson(res, 502, { error: result.error, code: 'EMAIL_SEND_FAILED' });
    }
    return sendJson(res, 200, { success: true, email: result.email });
  }

  if (pathname === '/api/auth/email/verify' && method === 'POST') {
    if (!appConfig.emailAuthConfigured) {
      return sendJson(res, 503, {
        error: '邮箱登录尚未配置',
        code: 'EMAIL_AUTH_NOT_CONFIGURED'
      });
    }
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    const code = String(body.code || '').trim();
    if (!email || !code) {
      return sendJson(res, 400, { error: '请输入验证码', code: 'MISSING_CODE' });
    }
    const rate = checkRateLimit('email_otp_verify', email);
    if (!rate.allowed) {
      return sendJson(res, 429, { error: rate.error, code: 'RATE_LIMITED' });
    }
    if (!(await verifyEmailLoginOtp(email, code))) {
      return sendJson(res, 401, { error: '验证码错误或已过期', code: 'INVALID_OTP' });
    }
    try {
      const user = await loginEmailUser(email);
      return sendJson(res, 200, {
        token: user.session_token,
        user: await buildUserState(db, user.id),
        ...formatAuthMeta(user)
      });
    } catch (err) {
      return sendJson(res, 400, { error: err.message, code: err.code || 'EMAIL_LOGIN_FAILED' });
    }
  }

  if (pathname === '/api/auth/wechat' && method === 'POST') {
    const body = await readBody(req);
    if (!body.code) {
      return sendJson(res, 400, { error: '缺少 code', code: 'MISSING_CODE' });
    }
    try {
      const { openid, unionid } = await code2Session(body.code);
      const user = await loginWechatUser(openid, body.nickname || '微信用户', unionid);
      return sendJson(res, 200, {
        token: user.session_token,
        user: await buildUserState(db, user.id),
        ...formatAuthMeta(user)
      });
    } catch (err) {
      const status = err.code === 'WECHAT_NOT_CONFIGURED' ? 503 :
      err.code === 'WECHAT_API_ERROR' ? 502 :
      400;
      return sendJson(res, status, {
        error: err.message,
        code: err.code || 'WECHAT_LOGIN_FAILED',
        wechatErrcode: err.wechatErrcode
      });
    }
  }

  const authResult = await authMiddleware(req);
  if (!authResult.ok && pathname.startsWith('/api/') &&
  pathname !== '/api/login' &&
  pathname !== '/api/register' &&
  pathname !== '/api/auth/wechat' &&
  pathname !== '/api/auth/email/send' &&
  pathname !== '/api/auth/email/verify' &&
  !pathname.startsWith('/api/admin/')) {
    return sendJson(res, authResult.status, { error: authResult.error, code: authResult.code });
  }
  const user = authResult.user;

  if (pathname === '/api/auth/logout' && method === 'POST') {
    await logoutUser(user.id);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/auth/session' && method === 'GET') {
    const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    return sendJson(res, 200, {
      valid: true,
      user: await buildUserState(db, user.id),
      ...formatAuthMeta(row)
    });
  }

  if (pathname === '/api/me' && method === 'GET') {
    return sendJson(res, 200, await buildUserState(db, user.id));
  }

  if (pathname === '/api/settings' && method === 'PATCH') {
    const body = await readBody(req);
    const allowed = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    if (body.targetLevel && allowed.includes(body.targetLevel)) {
      await db.prepare('UPDATE users SET target_level = ?, updated_at = datetime(\'now\') WHERE id = ?').
      run(body.targetLevel, user.id);
    }
    if (body.dailyNew && Number.isInteger(body.dailyNew) && body.dailyNew > 0 && body.dailyNew <= 50) {
      await db.prepare('UPDATE users SET daily_new = ?, updated_at = datetime(\'now\') WHERE id = ?').
      run(body.dailyNew, user.id);
    }
    const settingsPatch = {};
    if (typeof body.soundEnabled === 'boolean') settingsPatch.soundEnabled = body.soundEnabled;
    if (typeof body.vibrationEnabled === 'boolean') settingsPatch.vibrationEnabled = body.vibrationEnabled;
    if (typeof body.showIpa === 'boolean') settingsPatch.showIpa = body.showIpa;
    if (Object.keys(settingsPatch).length) {
      await updateUserSettings(db, user.id, settingsPatch);
    }
    if (body.privacyAgreed === true) {
      await db.prepare(`
        UPDATE users SET privacy_agreed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
      `).run(user.id);
    }
    return sendJson(res, 200, await buildUserState(db, user.id));
  }

  if (pathname === '/api/me/profile' && method === 'PATCH') {
    const body = await readBody(req);
    try {
      if (body.nickname !== undefined) {
        await updateUserProfile(db, user.id, { nickname: body.nickname });
      }
      return sendJson(res, 200, await buildUserState(db, user.id));
    } catch (err) {
      return sendJson(res, 400, { error: err.message, code: err.code || 'PROFILE_UPDATE_FAILED' });
    }
  }

  if (pathname === '/api/user/avatar' && method === 'POST') {
    try {
      const { file, fields } = await parseMultipart(req);
      if (!file?.data?.length) {
        return sendJson(res, 400, { error: '请上传头像文件', code: 'MISSING_FILE' });
      }
      await saveUserAvatar(db, user.id, file.data, file.mimeType);
      if (fields.nickname) {
        await updateUserProfile(db, user.id, { nickname: fields.nickname });
      }
      return sendJson(res, 200, {
        avatarUrl: (await db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(user.id)).avatar_url,
        user: await buildUserState(db, user.id)
      });
    } catch (err) {
      const status = err.code === 'FILE_TOO_LARGE' ? 413 : 400;
      return sendJson(res, status, { error: err.message, code: err.code || 'UPLOAD_FAILED' });
    }
  }

  if (pathname === '/api/words/daily' && method === 'GET') {
    const u = await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    const session = (await buildUserState(db, user.id)).todaySession;
    if (session.finished) {
      return sendJson(res, 200, { words: [], finished: true, message: '今日学习已完成' });
    }
    const remaining = Math.max(u.daily_new - session.total, 0);
    const count = Math.min(parseInt(query.count, 10) || remaining || u.daily_new, u.daily_new);
    const words = await getMixedDailyPack(db, user.id, count > 0 ? count : u.daily_new);
    const newCount = words.filter((w) => w.studyMode === 'new').length;
    const reviewCount = words.filter((w) => w.studyMode === 'review').length;
    return sendJson(res, 200, {
      words, count: words.length, newCount, reviewCount, finished: false
    });
  }

  if (pathname === '/api/exams' && method === 'GET') {
    return sendJson(res, 200, { packs: await getExamSummaries(db, user.id) });
  }

  if (pathname === '/api/words/exam' && method === 'GET') {
    const packId = query.pack;
    if (!packId || !EXAM_PACKS[packId]) {
      return sendJson(res, 400, { error: '参数错误: pack 需为 tem4 或 tem8' });
    }
    const count = Math.min(parseInt(query.count, 10) || 10, 20);
    const result = await getExamPack(db, packId, user.id, count);
    if (!result.words.length) {
      return sendJson(res, 200, {
        ...result,
        empty: true,
        message: `暂无「${result.pack.tag}」标签单词，请内容组在 CSV tags/exam_tags 中补充`
      });
    }
    return sendJson(res, 200, result);
  }

  if (pathname === '/api/words/dictation' && method === 'GET') {
    const count = Math.min(parseInt(query.count, 10) || 10, 20);
    const words = await getDictationPack(db, user.id, count);
    return sendJson(res, 200, { words, count: words.length });
  }

  if (pathname === '/api/words/dictation/check' && method === 'POST') {
    const body = await readBody(req);
    if (!body.wordId || body.answer === undefined || body.answer === null) {
      return sendJson(res, 400, { error: '参数错误: 需要 wordId 与 answer' });
    }
    const result = await checkDictationAnswer(db, user.id, body.wordId, String(body.answer));
    if (!result) return sendJson(res, 404, { error: '单词不存在' });
    return sendJson(res, 200, result);
  }

  if (pathname === '/api/words/review' && method === 'GET') {
    const mode = query.mode || 'mistakes';
    const count = Math.min(parseInt(query.count, 10) || 10, 20);
    const words = mode === 'due' ?
    (await getMixedDailyPack(db, user.id, count)).filter((w) => w.studyMode === 'review') : await
    getMistakeReviewPack(db, user.id, count);
    return sendJson(res, 200, { words, count: words.length, mode });
  }

  if (pathname === '/api/confusables' && method === 'GET') {
    return sendJson(res, 200, { pairs: await getConfusablePairs() });
  }

  if (pathname === '/api/words/answer' && method === 'POST') {
    const body = await readBody(req);
    if (!body.wordId || typeof body.isCorrect !== 'boolean') {
      return sendJson(res, 400, { error: '参数错误: 需要 wordId 与 isCorrect' });
    }
    const word = await db.prepare('SELECT id FROM words WHERE id = ?').get(body.wordId);
    if (!word) return sendJson(res, 404, { error: '单词不存在' });
    return sendJson(res, 200, await recordAnswer(
      db, user.id, body.wordId, body.isCorrect, body.studyMode || 'new'
    ));
  }

  if (pathname === '/api/mistakes' && method === 'GET') {
    const rows = await db.prepare(`
      SELECT mb.word_id AS wordId, mb.wrong_at AS wrongAt,
             w.lemma, w.meaning_zh, w.level, w.example_es, w.example_zh, w.ipa, w.pos, w.tags
      FROM mistake_book mb
      JOIN words w ON w.id = mb.word_id
      WHERE mb.user_id = ? AND mb.resolved = 0
      ORDER BY mb.wrong_at DESC
    `).all(user.id);

    const mistakes = rows.map((row) => {
      let tags = [];
      try {tags = row.tags ? JSON.parse(row.tags) : [];} catch {/* ignore */}
      return { ...row, tags };
    });
    return sendJson(res, 200, { mistakes, total: mistakes.length });
  }

  if (pathname === '/api/stats' && method === 'GET') {
    return sendJson(res, 200, await getStats(db, user.id));
  }

  if (pathname === '/api/session/finish' && method === 'POST') {
    return sendJson(res, 200, await finishSession(db, user.id));
  }

  if (pathname === '/api/words' && method === 'GET') {
    return sendJson(res, 200, { total: await wordCount() });
  }

  const examplesMatch = pathname.match(/^\/api\/words\/(\d+)\/examples$/);
  if (examplesMatch && method === 'GET') {
    if (!(await ragFeaturesEnabled(user.id))) {
      return sendJson(res, 200, {
        examples: [],
        disabled: true,
        reason: 'control_arm',
        message: '对照组不展示 RAG 例句'
      });
    }
    const k = query.k || 3;
    const result = await retrieveExamplesForWord(parseInt(examplesMatch[1], 10), k);
    if (!result.word) return sendJson(res, 404, { error: '单词不存在' });
    return sendJson(res, 200, result);
  }

  if (pathname === '/api/words/explain' && method === 'POST') {
    if (!(await ragFeaturesEnabled(user.id))) {
      return sendJson(res, 200, {
        disabled: true,
        reason: 'control_arm',
        message: '对照组不生成 LLM 解析'
      });
    }
    const body = await readBody(req);
    if (!body.wordId) {
      return sendJson(res, 400, { error: '需要 wordId', code: 'INVALID_BODY' });
    }
    try {
      const result = await explainMistake({
        wordId: body.wordId,
        wrongChoice: body.wrongChoice || body.selectedText,
        selectedText: body.selectedText
      });
      return sendJson(res, 200, result);
    } catch (err) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return sendJson(res, status, { error: err.message, code: err.code || 'EXPLAIN_FAILED' });
    }
  }

  const wordMatch = pathname.match(/^\/api\/words\/(\d+)$/);
  if (wordMatch && method === 'GET') {
    const detail = getWordDetail(db, wordMatch[1]);
    if (!detail) return sendJson(res, 404, { error: '单词不存在' });
    return sendJson(res, 200, detail);
  }

  if (pathname === '/api/dev/reset' && method === 'POST') {
    if (appConfig.isProduction) {
      return sendJson(res, 403, { error: '生产环境不可用' });
    }
    return sendJson(res, 200, await resetUserProgress(db, user.id));
  }

  if (pathname === '/api/dev/reset-today' && method === 'POST') {
    if (appConfig.isProduction) {
      return sendJson(res, 403, { error: '生产环境不可用' });
    }
    return sendJson(res, 200, await resetTodaySession(db, user.id));
  }

  return sendJson(res, 404, { error: 'Not Found' });
}

export async function requestHandler(req, res) {
  try {
    const parsed = parseUrl(req.url, true);
    const pathname = parsed.pathname;

    if (pathname.startsWith('/static/images/')) {
      const rel = pathname.slice('/static/images/'.length);
      const safe = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
      return sendFile(res, path.join(ROOT, 'data', 'images', safe));
    }

    if (pathname.startsWith('/static/avatars/')) {
      const filename = path.basename(pathname);
      return sendFile(res, path.join(ROOT, 'backend', 'data', 'avatars', filename));
    }

    if (pathname === '/admin' || pathname === '/admin/') {
      return sendFile(res, path.join(ADMIN_DIR, 'index.html'));
    }
    if (pathname.startsWith('/admin/')) {
      const rel = pathname.slice('/admin/'.length);
      const safe = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
      return sendFile(res, path.join(ADMIN_DIR, safe));
    }

    if (pathname.startsWith('/api/')) {
      return await handleApi(req, res, pathname, parsed.query);
    }

    return sendJson(res, 404, { error: 'Not Found' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: err.message || '服务器错误' });
  }
}

export default requestHandler;

// 本地开发启动 HTTP；Vercel 用 serverless 默认导出
if (!process.env.VERCEL && process.env.XIYU_NO_LISTEN !== '1') {
  const server = createServer(requestHandler);
  server.listen(PORT, HOST, async () => {
    console.log(`[server] 西语背单词 API → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`[server] 健康检查 → http://localhost:${PORT}/api/health`);
    console.log(`[server] 词库 ${await wordCount()} 词 · 数据库 ${getDbPath()} · backend=${getDbBackend()}`);
    console.log(`[server] 微信登录 ${appConfig.wechatConfigured ? '已配置' : '未配置（填 backend/.env）'}`);
    console.log(`[server] 演示登录 ${appConfig.allowDemoLogin ? '开启' : '关闭'} · NODE_ENV=${appConfig.nodeEnv}`);
  });
}