#!/usr/bin/env node
/**
 * Vercel 构建后处理：把配图拷进 H5 静态目录，准备 seed 数据库
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const H5 = path.join(ROOT, 'frontend', 'dist', 'build', 'h5')
const IMAGES = path.join(ROOT, 'data', 'images')
const SEED = path.join(ROOT, 'backend', 'data', 'xiyu.seed.db')
const LIVE = path.join(ROOT, 'backend', 'data', 'xiyu.db')

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name)
    const d = path.join(dest, name)
    if (fs.statSync(s).isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

if (!fs.existsSync(H5)) {
  console.error('[prepare-vercel] H5 构建目录不存在:', H5)
  process.exit(1)
}

const staticImages = path.join(H5, 'static', 'images')
copyDir(IMAGES, staticImages)
console.log('[prepare-vercel] 已复制配图 →', staticImages)

// 若无 seed db，用当前库或重新导入义项包
if (!fs.existsSync(SEED)) {
  if (fs.existsSync(LIVE)) {
    fs.copyFileSync(LIVE, SEED)
    console.log('[prepare-vercel] 已从 xiyu.db 生成 seed')
  } else {
    console.log('[prepare-vercel] 正在导入义项包+考试路径生成 seed…')
    execSync('node scripts/reset-with-exams.mjs', {
      cwd: ROOT,
      stdio: 'inherit',
    })
    if (fs.existsSync(LIVE)) fs.copyFileSync(LIVE, SEED)
  }
}

console.log('[prepare-vercel] 完成')
