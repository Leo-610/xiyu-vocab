import db from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { formatWord } from './learning.js';
import { corpusStats } from './rag.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BATCHES_DIR = path.join(__dirname, '..', '..', 'data', 'batches');
const IMAGES_DIR = path.join(__dirname, '..', '..', 'data', 'images');

/** 当前上线词库：A1 义项包 + 专四/专八完整合并 */
export const LEVEL_TARGETS = {
  A1: 101,
  A2: 338,
  B1: 307,
  B2: 85,
  C1: 25,
  C2: 0
};

export async function getContentStatus() {
  const total = (await db.prepare('SELECT COUNT(*) AS c FROM words').get()).c;
  const withImage = (await db.prepare(`
    SELECT COUNT(*) AS c FROM words
    WHERE image_url IS NOT NULL AND image_url != ''
  `).get()).c;
  const withConjugation = (await db.prepare(`
    SELECT COUNT(*) AS c FROM words
    WHERE conjugation_json IS NOT NULL AND conjugation_json != ''
  `).get()).c;
  const withAudio = (await db.prepare(`
    SELECT COUNT(*) AS c FROM words
    WHERE audio_url IS NOT NULL AND audio_url != ''
  `).get()).c;

  const byLevel = await db.prepare(`
    SELECT level, COUNT(*) AS count FROM words GROUP BY level
  `).all();

  const levelProgress = Object.entries(LEVEL_TARGETS).map(([level, target]) => {
    const row = byLevel.find((r) => r.level === level);
    const current = row?.count || 0;
    const batchDir = path.join(BATCHES_DIR, level);
    const csvExists = fs.existsSync(path.join(batchDir, `words_${level}.csv`));
    const imageDir = path.join(IMAGES_DIR, level);
    const imageDirExists = fs.existsSync(imageDir);
    let imageCount = 0;
    if (imageDirExists) {
      imageCount = fs.readdirSync(imageDir).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).length;
    }
    return {
      level,
      target,
      current,
      percent: Math.round(current / target * 100),
      csvSubmitted: csvExists,
      imagesDirReady: imageDirExists,
      imageCount,
      slot: `data/batches/${level}/words_${level}.csv`,
      imageSlot: `data/images/${level}/`
    };
  });

  const confusablePending = (await db.prepare(`
    SELECT COUNT(*) AS c FROM confusable_pairs WHERE content_status = 'pending'
  `).get()).c;

  const targetTotal = Object.values(LEVEL_TARGETS).reduce((a, b) => a + b, 0);
  const corpus = await corpusStats();
  const aiPending = (await db.prepare(`SELECT COUNT(*) AS c FROM ai_reviews WHERE status = 'pending'`).get()).c;

  return {
    targetTotal,
    wordsTotal: total,
    gaps: {
      words: targetTotal - total,
      images: total - withImage,
      conjugations: (await db.prepare(`SELECT COUNT(*) AS c FROM words WHERE pos='v'`).get()).c - withConjugation,
      audio: total - withAudio,
      confusableNotes: confusablePending,
      corpusChunks: Math.max(0, 200 - corpus.chunks),
      aiReviewsPending: aiPending
    },
    corpus,
    levelProgress,
    teamTasks: [
    { owner: '西语同学A', task: '词库 CSV', path: 'data/batches/{A1-C2}/words_*.csv', status: total >= 50 ? '进行中' : '待开始' },
    { owner: '西语同学B', task: '配图', path: 'data/images/{A1-C2}/', status: withImage > 0 ? '进行中' : '待开始' },
    { owner: '西语同学A', task: '动词变位 JSON', path: 'words.conjugation_json 字段', status: withConjugation > 0 ? '进行中' : '待开始' },
    { owner: '西语同学A', task: '易混词辨析文案', path: 'confusable_pairs.note_zh', status: confusablePending > 0 ? '待填写' : '已完成' },
    { owner: '西语同学A', task: 'RAG 语料 JSONL', path: 'data/corpus/{A1-C2}/', status: corpus.chunks > 0 ? '进行中' : '待开始' },
    { owner: '西语同学B', task: 'AI 解析审核', path: 'admin · ai_reviews', status: aiPending > 0 ? '待审核' : '空闲' },
    { owner: '西语同学B', task: '用户调研问卷', path: 'docs/survey/questionnaire.md', status: '模板已就绪' }]

  };
}

/** 易混词辨析文案（专四/DELE 高频） */
export const CONFUSABLE_NOTES = [
  {
    a: 'ser',
    b: 'estar',
    note_zh: `【用法】ser 表本质/身份/时间/材料；estar 表状态/位置/进行时。
【口诀】「是什么用 ser，怎么样/在哪里用 estar」。
【例句】Soy estudiante.（我是学生）/ Estoy cansado.（我累了）/ Madrid está en España.（马德里在西班牙）
【易错】别说 *Soy cansado* 表示「我累了」，应说 Estoy cansado。`,
  },
  {
    a: 'bueno',
    b: 'malo',
    note_zh: `【用法】bueno=好的/善良的；malo=坏的/糟糕的/不舒服。
【搭配】buena idea（好主意）；mal tiempo（坏天气）；estar malo（身体不舒服）。
【例句】Es un buen libro. / La película es mala. / Me siento malo hoy.
【注意】bueno/malo 在名词前常短化为 buen/mal：un buen amigo。`,
  },
  {
    a: 'saber',
    b: 'conocer',
    note_zh: `【用法】saber=知道信息/会技能；conocer=认识人/熟悉地方或事物。
【口诀】「会不会、知不知道」用 saber；「认不认识、熟不熟悉」用 conocer。
【例句】Sé nadar.（我会游泳）/ Sé la respuesta.（我知道答案）/ Conozco a Ana.（我认识安娜）/ Conozco Madrid.（我熟悉马德里）
【易错】认识某人用 conocer + a：Conozco a tu hermano。`,
  },
  {
    a: 'ir',
    b: 'venir',
    note_zh: `【用法】ir=去（离开说话人）；venir=来（朝向说话人）。
【口诀】「我去你那儿」用 ir；「你来我这儿」用 venir。
【例句】Voy a la biblioteca.（我去图书馆）/ ¿Vienes a mi casa?（你来我家吗？）
【搭配】ir a + 地点；venir de + 地点（从…来）。`,
  },
  {
    a: 'llevar',
    b: 'traer',
    note_zh: `【用法】llevar=带走/携带（从这边拿走）；traer=带来（拿到这边来）。
【口诀】「带走」llevar，「带来」traer（视角看向说话人）。
【例句】Llevo el libro a clase.（我把书带到教室去）/ Trae agua, por favor.（请把水拿来）
【延伸】llevar 还可表「穿戴、花费时间」：Lleva gafas. / Lleva dos horas.`,
  },
  {
    a: 'oír',
    b: 'escuchar',
    note_zh: `【用法】oír=听见（被动入耳）；escuchar=倾听（主动听）。
【口诀】「听见了」oír；「认真听」escuchar。
【例句】Oí un ruido.（我听见一声响）/ Escucho música todos los días.（我每天听音乐）
【课堂】老师常说：¡Escuchad!（注意听！）`,
  },
  {
    a: 'mirar',
    b: 'ver',
    note_zh: `【用法】mirar=看/注视（主动看向）；ver=看见/看到（视觉结果）。
【口诀】「盯着看」mirar；「看见了」ver。
【例句】Mira la pizarra.（看黑板）/ ¿Ves aquel edificio?（你看见那栋楼吗？）
【影视】「看电影」通常说 ver una película。`,
  },
  {
    a: 'hablar',
    b: 'decir',
    note_zh: `【用法】hablar=说话/讲某种语言（强调行为）；decir=说（出具体内容）。
【口诀】「在说话/说西语」hablar；「说了什么」decir。
【例句】Hablo español.（我说西语）/ Ella dice la verdad.（她说真话）/ ¿Qué dijiste?（你说了什么？）
【搭配】hablar con alguien；decir que…`,
  },
]

export async function seedConfusablePairs() {
  const findId = db.prepare('SELECT id FROM words WHERE lemma = ? LIMIT 1')
  const findPair = db.prepare(
    'SELECT id FROM confusable_pairs WHERE word_id_a = ? AND word_id_b = ?'
  )
  const insert = db.prepare(`
    INSERT INTO confusable_pairs (word_id_a, word_id_b, note_zh, content_status)
    VALUES (?, ?, ?, 'approved')
  `)
  const update = db.prepare(`
    UPDATE confusable_pairs
    SET note_zh = ?, content_status = 'approved'
    WHERE id = ?
  `)

  let n = 0
  for (const { a, b, note_zh } of CONFUSABLE_NOTES) {
    const wa = await findId.get(a)
    const wb = await findId.get(b)
    if (!wa || !wb) continue
    const existing = await findPair.get(wa.id, wb.id)
    if (existing) {
      await update.run(note_zh, existing.id)
    } else {
      await insert.run(wa.id, wb.id, note_zh)
    }
    n += 1
  }
  return n
}

export async function getConfusablePairs() {
  return await db.prepare(`
    SELECT cp.id, cp.note_zh, cp.note_es, cp.content_status,
           wa.lemma AS lemmaA, wa.meaning_zh AS meaningA, wa.level AS levelA,
           wb.lemma AS lemmaB, wb.meaning_zh AS meaningB, wb.level AS levelB
    FROM confusable_pairs cp
    JOIN words wa ON wa.id = cp.word_id_a
    JOIN words wb ON wb.id = cp.word_id_b
    ORDER BY cp.id
  `).all();
}

export function getWordDetail(dbConn, wordId) {
  const row = dbConn.prepare('SELECT * FROM words WHERE id = ?').get(wordId);
  if (!row) return null;
  const options = dbConn.prepare(
    'SELECT option_text, is_correct FROM word_options WHERE word_id = ?'
  ).all(wordId);
  const word = formatWord(row, options);

  let conjugation = null;
  let conjugationPending = true;
  if (row.conjugation_json) {
    try {
      conjugation = JSON.parse(row.conjugation_json);
      conjugationPending = false;
    } catch {
      conjugation = null;
    }
  }

  return {
    ...word,
    conjugation,
    conjugationPending,
    audio_url: row.audio_url,
    hasImage: Boolean(row.image_url)
  };
}