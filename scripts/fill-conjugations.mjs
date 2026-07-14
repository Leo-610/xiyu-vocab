#!/usr/bin/env node
/**
 * 为义项包中的动词写入 presente 变位（words.conjugation_json）
 * node scripts/fill-conjugations.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../backend/src/db.js'
import { runMigrations } from '../backend/src/migrate.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const LIVE = path.join(ROOT, 'backend', 'data', 'xiyu.db')
const SEED = path.join(ROOT, 'backend', 'data', 'xiyu.seed.db')

const PERSONS = ['yo', 'tú', 'él/ella/usted', 'nosotros', 'vosotros', 'ellos/ustedes']

function pack(lemma, forms) {
  return {
    lemma,
    tenses: [
      {
        name: 'presente de indicativo',
        name_zh: '现在时',
        forms: PERSONS.map((person, i) => ({ person, form: forms[i] })),
      },
    ],
  }
}

/** lemma → 6 人称形式 */
const PRESENT = {
  abrir: ['abro', 'abres', 'abre', 'abrimos', 'abrís', 'abren'],
  beber: ['bebo', 'bebes', 'bebe', 'bebemos', 'bebéis', 'beben'],
  cerrar: ['cierro', 'cierras', 'cierra', 'cerramos', 'cerráis', 'cierran'],
  comer: ['como', 'comes', 'come', 'comemos', 'coméis', 'comen'],
  comprar: ['compro', 'compras', 'compra', 'compramos', 'compráis', 'compran'],
  decir: ['digo', 'dices', 'dice', 'decimos', 'decís', 'dicen'],
  escribir: ['escribo', 'escribes', 'escribe', 'escribimos', 'escribís', 'escriben'],
  escuchar: ['escucho', 'escuchas', 'escucha', 'escuchamos', 'escucháis', 'escuchan'],
  estar: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'],
  estudiar: ['estudio', 'estudias', 'estudia', 'estudiamos', 'estudiáis', 'estudian'],
  hablar: ['hablo', 'hablas', 'habla', 'hablamos', 'habláis', 'hablan'],
  hacer: ['hago', 'haces', 'hace', 'hacemos', 'hacéis', 'hacen'],
  ir: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'],
  leer: ['leo', 'lees', 'lee', 'leemos', 'leéis', 'leen'],
  llamarse: ['me llamo', 'te llamas', 'se llama', 'nos llamamos', 'os llamáis', 'se llaman'],
  necesitar: ['necesito', 'necesitas', 'necesita', 'necesitamos', 'necesitáis', 'necesitan'],
  poder: ['puedo', 'puedes', 'puede', 'podemos', 'podéis', 'pueden'],
  querer: ['quiero', 'quieres', 'quiere', 'queremos', 'queréis', 'quieren'],
  ser: ['soy', 'eres', 'es', 'somos', 'sois', 'son'],
  tener: ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'],
  trabajar: ['trabajo', 'trabajas', 'trabaja', 'trabajamos', 'trabajáis', 'trabajan'],
  venir: ['vengo', 'vienes', 'viene', 'venimos', 'venís', 'vienen'],
  ver: ['veo', 'ves', 've', 'vemos', 'veis', 'ven'],
  vivir: ['vivo', 'vives', 'vive', 'vivimos', 'vivís', 'viven'],
}

runMigrations(db)

const update = db.prepare('UPDATE words SET conjugation_json = ? WHERE lemma = ? AND pos = ?')
let n = 0
const missing = []

for (const [lemma, forms] of Object.entries(PRESENT)) {
  const json = JSON.stringify(pack(lemma, forms))
  const info = update.run(json, lemma, 'v')
  if (info.changes > 0) n += info.changes
  else missing.push(lemma)
}

const pending = db.prepare(`
  SELECT lemma FROM words WHERE pos = 'v'
    AND (conjugation_json IS NULL OR conjugation_json = '')
`).all()

console.log(`[ok] 已写入变位 ${n} 条`)
if (missing.length) console.log('[warn] 表中无此 lemma:', missing.join(', '))
if (pending.length) console.log('[warn] 仍缺变位:', pending.map((r) => r.lemma).join(', '))

if (fs.existsSync(LIVE)) {
  fs.copyFileSync(LIVE, SEED)
  console.log(`[ok] 已同步 seed → ${SEED}`)
}
