#!/usr/bin/env node
/**
 * 导出院内试用数据报告（大创中期附件）
 * node scripts/export-pilot-report.mjs
 * node scripts/export-pilot-report.mjs --out docs/survey/results/pilot-report.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../backend/src/db.js'
import { getPilotReport } from '../backend/src/services/analytics.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const outArg = process.argv.find((a) => a.startsWith('--out='))
const outPath = outArg
  ? path.resolve(ROOT, outArg.slice('--out='.length))
  : path.join(ROOT, 'docs', 'survey', 'results', `pilot-report-${new Date().toISOString().slice(0, 10)}.json`)

const report = getPilotReport(db)
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')

console.log(`[pilot] 已导出 → ${outPath}`)
console.log(`[pilot] 用户 ${report.users.total} · 30日活跃 ${report.users.activeLast30Days} · 答题 ${report.learning.wordsAnswered}`)
