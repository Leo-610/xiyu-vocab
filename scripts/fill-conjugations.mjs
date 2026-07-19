#!/usr/bin/env node
/**
 * 为词库全部动词写入 presente de indicativo 变位（words.conjugation_json）
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

/** lemma → 6 人称形式（现在时） */
const PRESENT = {
  abrir: ['abro', 'abres', 'abre', 'abrimos', 'abrís', 'abren'],
  aburrir: ['aburro', 'aburres', 'aburre', 'aburrimos', 'aburrís', 'aburren'],
  aceptar: ['acepto', 'aceptas', 'acepta', 'aceptamos', 'aceptáis', 'aceptan'],
  aconsejar: ['aconsejo', 'aconsejas', 'aconseja', 'aconsejamos', 'aconsejáis', 'aconsejan'],
  ahorrar: ['ahorro', 'ahorras', 'ahorra', 'ahorramos', 'ahorráis', 'ahorran'],
  alegrarse: ['me alegro', 'te alegras', 'se alegra', 'nos alegramos', 'os alegráis', 'se alegran'],
  alquilar: ['alquilo', 'alquilas', 'alquila', 'alquilamos', 'alquiláis', 'alquilan'],
  amar: ['amo', 'amas', 'ama', 'amamos', 'amáis', 'aman'],
  analizar: ['analizo', 'analizas', 'analiza', 'analizamos', 'analizáis', 'analizan'],
  aprender: ['aprendo', 'aprendes', 'aprende', 'aprendemos', 'aprendéis', 'aprenden'],
  aprobar: ['apruebo', 'apruebas', 'aprueba', 'aprobamos', 'aprobáis', 'aprueban'],
  argumentar: ['argumento', 'argumentas', 'argumenta', 'argumentamos', 'argumentáis', 'argumentan'],
  arreglarse: ['me arreglo', 'te arreglas', 'se arregla', 'nos arreglamos', 'os arregláis', 'se arreglan'],
  asimilar: ['asimilo', 'asimilas', 'asimila', 'asimilamos', 'asimiláis', 'asimilan'],
  asistir: ['asisto', 'asistes', 'asiste', 'asistimos', 'asistís', 'asisten'],
  aumentar: ['aumento', 'aumentas', 'aumenta', 'aumentamos', 'aumentáis', 'aumentan'],
  avanzar: ['avanzo', 'avanzas', 'avanza', 'avanzamos', 'avanzáis', 'avanzan'],
  ayudar: ['ayudo', 'ayudas', 'ayuda', 'ayudamos', 'ayudáis', 'ayudan'],
  bañarse: ['me baño', 'te bañas', 'se baña', 'nos bañamos', 'os bañáis', 'se bañan'],
  beber: ['bebo', 'bebes', 'bebe', 'bebemos', 'bebéis', 'beben'],
  buscar: ['busco', 'buscas', 'busca', 'buscamos', 'buscáis', 'buscan'],
  calificar: ['califico', 'calificas', 'califica', 'calificamos', 'calificáis', 'califican'],
  cambiarse: ['me cambio', 'te cambias', 'se cambia', 'nos cambiamos', 'os cambiáis', 'se cambian'],
  cantar: ['canto', 'cantas', 'canta', 'cantamos', 'cantáis', 'cantan'],
  capacitar: ['capacito', 'capacitas', 'capacita', 'capacitamos', 'capacitáis', 'capacitan'],
  cerrar: ['cierro', 'cierras', 'cierra', 'cerramos', 'cerráis', 'cierran'],
  citar: ['cito', 'citas', 'cita', 'citamos', 'citáis', 'citan'],
  clasificar: ['clasifico', 'clasificas', 'clasifica', 'clasificamos', 'clasificáis', 'clasifican'],
  cocinar: ['cocino', 'cocinas', 'cocina', 'cocinamos', 'cocináis', 'cocinan'],
  colaborar: ['colaboro', 'colaboras', 'colabora', 'colaboramos', 'colaboráis', 'colaboran'],
  comer: ['como', 'comes', 'come', 'comemos', 'coméis', 'comen'],
  compilar: ['compilo', 'compilas', 'compila', 'compilamos', 'compiláis', 'compilan'],
  comprar: ['compro', 'compras', 'compra', 'compramos', 'compráis', 'compran'],
  concentrarse: ['me concentro', 'te concentras', 'se concentra', 'nos concentramos', 'os concentráis', 'se concentran'],
  conocer: ['conozco', 'conoces', 'conoce', 'conocemos', 'conocéis', 'conocen'],
  conocerse: ['me conozco', 'te conoces', 'se conoce', 'nos conocemos', 'os conocéis', 'se conocen'],
  construir: ['construyo', 'construyes', 'construye', 'construimos', 'construís', 'construyen'],
  consultar: ['consulto', 'consultas', 'consulta', 'consultamos', 'consultáis', 'consultan'],
  contrastar: ['contrasto', 'contrastas', 'contrasta', 'contrastamos', 'contrastáis', 'contrastan'],
  corregir: ['corrijo', 'corriges', 'corrige', 'corregimos', 'corregís', 'corrigen'],
  correr: ['corro', 'corres', 'corre', 'corremos', 'corréis', 'corren'],
  crear: ['creo', 'creas', 'crea', 'creamos', 'creáis', 'crean'],
  cuestionar: ['cuestiono', 'cuestionas', 'cuestiona', 'cuestionamos', 'cuestionáis', 'cuestionan'],
  debatir: ['debato', 'debates', 'debate', 'debatimos', 'debatís', 'debaten'],
  deber: ['debo', 'debes', 'debe', 'debemos', 'debéis', 'deben'],
  decir: ['digo', 'dices', 'dice', 'decimos', 'decís', 'dicen'],
  deducir: ['deduzco', 'deduces', 'deduce', 'deducimos', 'deducís', 'deducen'],
  descansar: ['descanso', 'descansas', 'descansa', 'descansamos', 'descansáis', 'descansan'],
  despertarse: ['me despierto', 'te despiertas', 'se despierta', 'nos despertamos', 'os despertáis', 'se despiertan'],
  dominar: ['domino', 'dominas', 'domina', 'dominamos', 'domináis', 'dominan'],
  dormir: ['duermo', 'duermes', 'duerme', 'dormimos', 'dormís', 'duermen'],
  empezar: ['empiezo', 'empiezas', 'empieza', 'empezamos', 'empezáis', 'empiezan'],
  encantar: ['encanto', 'encantas', 'encanta', 'encantamos', 'encantáis', 'encantan'],
  encontrar: ['encuentro', 'encuentras', 'encuentra', 'encontramos', 'encontráis', 'encuentran'],
  encontrarse: ['me encuentro', 'te encuentras', 'se encuentra', 'nos encontramos', 'os encontráis', 'se encuentran'],
  enseñar: ['enseño', 'enseñas', 'enseña', 'enseñamos', 'enseñáis', 'enseñan'],
  entender: ['entiendo', 'entiendes', 'entiende', 'entendemos', 'entendéis', 'entienden'],
  entenderse: ['me entiendo', 'te entiendes', 'se entiende', 'nos entendemos', 'os entendéis', 'se entienden'],
  entrar: ['entro', 'entras', 'entra', 'entramos', 'entráis', 'entran'],
  escribir: ['escribo', 'escribes', 'escribe', 'escribimos', 'escribís', 'escriben'],
  escuchar: ['escucho', 'escuchas', 'escucha', 'escuchamos', 'escucháis', 'escuchan'],
  esforzarse: ['me esfuerzo', 'te esfuerzas', 'se esfuerza', 'nos esforzamos', 'os esforzáis', 'se esfuerzan'],
  especializarse: ['me especializo', 'te especializas', 'se especializa', 'nos especializamos', 'os especializáis', 'se especializan'],
  esperar: ['espero', 'esperas', 'espera', 'esperamos', 'esperáis', 'esperan'],
  estar: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'],
  estructurar: ['estructuro', 'estructuras', 'estructura', 'estructuramos', 'estructuráis', 'estructuran'],
  estudiar: ['estudio', 'estudias', 'estudia', 'estudiamos', 'estudiáis', 'estudian'],
  evaluar: ['evalúo', 'evalúas', 'evalúa', 'evaluamos', 'evaluáis', 'evalúan'],
  explicar: ['explico', 'explicas', 'explica', 'explicamos', 'explicáis', 'explican'],
  exponer: ['expongo', 'expones', 'expone', 'exponemos', 'exponéis', 'exponen'],
  faltar: ['falto', 'faltas', 'falta', 'faltamos', 'faltáis', 'faltan'],
  formular: ['formulo', 'formulas', 'formula', 'formulamos', 'formuláis', 'formulan'],
  ganar: ['gano', 'ganas', 'gana', 'ganamos', 'ganáis', 'ganan'],
  gustar: ['gusto', 'gustas', 'gusta', 'gustamos', 'gustáis', 'gustan'],
  hablar: ['hablo', 'hablas', 'habla', 'hablamos', 'habláis', 'hablan'],
  hacer: ['hago', 'haces', 'hace', 'hacemos', 'hacéis', 'hacen'],
  importar: ['importo', 'importas', 'importa', 'importamos', 'importáis', 'importan'],
  indagar: ['indago', 'indagas', 'indaga', 'indagamos', 'indagáis', 'indagan'],
  inscribirse: ['me inscribo', 'te inscribes', 'se inscribe', 'nos inscribimos', 'os inscribís', 'se inscriben'],
  interactuar: ['interactúo', 'interactúas', 'interactúa', 'interactuamos', 'interactuáis', 'interactúan'],
  interpretar: ['interpreto', 'interpretas', 'interpreta', 'interpretamos', 'interpretáis', 'interpretan'],
  investigar: ['investigo', 'investigas', 'investiga', 'investigamos', 'investigáis', 'investigan'],
  ir: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'],
  lavar: ['lavo', 'lavas', 'lava', 'lavamos', 'laváis', 'lavan'],
  leer: ['leo', 'lees', 'lee', 'leemos', 'leéis', 'leen'],
  levantarse: ['me levanto', 'te levantas', 'se levanta', 'nos levantamos', 'os levantáis', 'se levantan'],
  limpiar: ['limpio', 'limpias', 'limpia', 'limpiamos', 'limpiáis', 'limpian'],
  llamar: ['llamo', 'llamas', 'llama', 'llamamos', 'llamáis', 'llaman'],
  llamarse: ['me llamo', 'te llamas', 'se llama', 'nos llamamos', 'os llamáis', 'se llaman'],
  llegar: ['llego', 'llegas', 'llega', 'llegamos', 'llegáis', 'llegan'],
  llevar: ['llevo', 'llevas', 'lleva', 'llevamos', 'lleváis', 'llevan'],
  matricular: ['matriculo', 'matriculas', 'matricula', 'matriculamos', 'matriculáis', 'matriculan'],
  memorizar: ['memorizo', 'memorizas', 'memoriza', 'memorizamos', 'memorizáis', 'memorizan'],
  mirar: ['miro', 'miras', 'mira', 'miramos', 'miráis', 'miran'],
  mostrar: ['muestro', 'muestras', 'muestra', 'mostramos', 'mostráis', 'muestran'],
  necesitar: ['necesito', 'necesitas', 'necesita', 'necesitamos', 'necesitáis', 'necesitan'],
  nivelar: ['nivelo', 'nivelas', 'nivela', 'nivelamos', 'niveláis', 'nivelan'],
  orientar: ['oriento', 'orientas', 'orienta', 'orientamos', 'orientáis', 'orientan'],
  oír: ['oigo', 'oyes', 'oye', 'oímos', 'oís', 'oyen'],
  parecer: ['parezco', 'pareces', 'parece', 'parecemos', 'parecéis', 'parecen'],
  parecerse: ['me parezco', 'te pareces', 'se parece', 'nos parecemos', 'os parecéis', 'se parecen'],
  pensar: ['pienso', 'piensas', 'piensa', 'pensamos', 'pensáis', 'piensan'],
  perder: ['pierdo', 'pierdes', 'pierde', 'perdemos', 'perdéis', 'pierden'],
  plagiar: ['plagio', 'plagias', 'plagia', 'plagiamos', 'plagiáis', 'plagian'],
  poder: ['puedo', 'puedes', 'puede', 'podemos', 'podéis', 'pueden'],
  poner: ['pongo', 'pones', 'pone', 'ponemos', 'ponéis', 'ponen'],
  ponerse: ['me pongo', 'te pones', 'se pone', 'nos ponemos', 'os ponéis', 'se ponen'],
  preguntar: ['pregunto', 'preguntas', 'pregunta', 'preguntamos', 'preguntáis', 'preguntan'],
  quedar: ['quedo', 'quedas', 'queda', 'quedamos', 'quedáis', 'quedan'],
  quedarse: ['me quedo', 'te quedas', 'se queda', 'nos quedamos', 'os quedáis', 'se quedan'],
  querer: ['quiero', 'quieres', 'quiere', 'queremos', 'queréis', 'quieren'],
  quitar: ['quito', 'quitas', 'quita', 'quitamos', 'quitáis', 'quitan'],
  quitarse: ['me quito', 'te quitas', 'se quita', 'nos quitamos', 'os quitáis', 'se quitan'],
  reflexionar: ['reflexiono', 'reflexionas', 'reflexiona', 'reflexionamos', 'reflexionáis', 'reflexionan'],
  registrar: ['registro', 'registras', 'registra', 'registramos', 'registráis', 'registran'],
  repasar: ['repaso', 'repasas', 'repasa', 'repasamos', 'repasáis', 'repasan'],
  responder: ['respondo', 'respondes', 'responde', 'respondemos', 'respondéis', 'responden'],
  saber: ['sé', 'sabes', 'sabe', 'sabemos', 'sabéis', 'saben'],
  salir: ['salgo', 'sales', 'sale', 'salimos', 'salís', 'salen'],
  seguir: ['sigo', 'sigues', 'sigue', 'seguimos', 'seguís', 'siguen'],
  sentarse: ['me siento', 'te sientas', 'se sienta', 'nos sentamos', 'os sentáis', 'se sientan'],
  ser: ['soy', 'eres', 'es', 'somos', 'sois', 'son'],
  sintetizar: ['sintetizo', 'sintetizas', 'sintetiza', 'sintetizamos', 'sintetizáis', 'sintetizan'],
  solicitar: ['solicito', 'solicitas', 'solicita', 'solicitamos', 'solicitáis', 'solicitan'],
  suspender: ['suspendo', 'suspendes', 'suspende', 'suspendemos', 'suspendéis', 'suspenden'],
  tener: ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'],
  terminar: ['termino', 'terminas', 'termina', 'terminamos', 'termináis', 'terminan'],
  tocar: ['toco', 'tocas', 'toca', 'tocamos', 'tocáis', 'tocan'],
  trabajar: ['trabajo', 'trabajas', 'trabaja', 'trabajamos', 'trabajáis', 'trabajan'],
  traer: ['traigo', 'traes', 'trae', 'traemos', 'traéis', 'traen'],
  venir: ['vengo', 'vienes', 'viene', 'venimos', 'venís', 'vienen'],
  ver: ['veo', 'ves', 've', 'vemos', 'veis', 'ven'],
  vestirse: ['me visto', 'te vistes', 'se viste', 'nos vestimos', 'os vestís', 'se visten'],
  vivir: ['vivo', 'vives', 'vive', 'vivimos', 'vivís', 'viven'],
}

runMigrations(db)

const update = db.prepare('UPDATE words SET conjugation_json = ? WHERE lemma = ? AND pos = ?')
let n = 0
const notInTable = []

for (const [lemma, forms] of Object.entries(PRESENT)) {
  if (forms.length !== 6) {
    console.error(`[error] ${lemma} 人称数不对: ${forms.length}`)
    continue
  }
  const json = JSON.stringify(pack(lemma, forms))
  const info = update.run(json, lemma, 'v')
  if (info.changes > 0) n += info.changes
  else notInTable.push(lemma)
}

const pending = db.prepare(`
  SELECT DISTINCT lemma FROM words WHERE pos = 'v'
    AND (conjugation_json IS NULL OR conjugation_json = '')
  ORDER BY lemma
`).all()

const covered = db.prepare(`
  SELECT COUNT(*) AS c FROM words WHERE pos = 'v'
    AND conjugation_json IS NOT NULL AND conjugation_json != ''
`).get().c

const querer = db.prepare(`
  SELECT lemma, conjugation_json FROM words WHERE lemma = 'querer' AND pos = 'v' LIMIT 1
`).get()

console.log(`[ok] 已写入变位 ${n} 行；库中有变位动词行 ${covered}`)
if (notInTable.length) console.log('[info] 字典有但库中无:', notInTable.join(', '))
if (pending.length) console.log('[warn] 仍缺变位:', pending.map((r) => r.lemma).join(', '))
else console.log('[ok] 全部动词变位已补齐')
if (querer?.conjugation_json) {
  const j = JSON.parse(querer.conjugation_json)
  console.log('[sample querer]', j.tenses[0].forms.map((f) => f.form).join(', '))
}

if (fs.existsSync(LIVE)) {
  fs.copyFileSync(LIVE, SEED)
  console.log(`[ok] 已同步 seed → ${SEED}`)
}
