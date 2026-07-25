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
  A2: 360,
  B1: 320,
  B2: 180,
  C1: 120,
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
【例句】Soy estudiante.（我是学生）/ Estoy cansado.（我累了）
【易错】别说 *Soy cansado* 表示「我累了」，应说 Estoy cansado。`,
  },
  {
    a: 'por',
    b: 'para',
    note_zh: `【用法】por：原因、途径、交换；para：目的、对象、截止、方向。
【口诀】「因为/通过用 por，为了/给谁用 para」。
【例句】Lo hago por ti. / Esto es para Ana. / Estudio para aprobar.
【易错】表目的别用 por。`,
  },
  {
    a: 'bueno',
    b: 'malo',
    note_zh: `【用法】bueno=好的；malo=坏的/糟糕的。
【例句】Es un buen libro. / La película es mala.
【注意】名词前常短化为 buen/mal。`,
  },
  {
    a: 'bien',
    b: 'bueno',
    note_zh: `【用法】bien 副词；bueno 形容词。
【口诀】「做得好」bien；「好东西」bueno。
【例句】Canta bien. / Es un buen cantante.`,
  },
  {
    a: 'mal',
    b: 'malo',
    note_zh: `【用法】mal 副词；malo 形容词。
【例句】Habla mal francés. / Es un mal día.`,
  },
  {
    a: 'saber',
    b: 'conocer',
    note_zh: `【用法】saber=知道信息/会技能；conocer=认识人/熟悉地方。
【例句】Sé nadar. / Conozco Madrid.
【易错】认识人用 conocer + a。`,
  },
  {
    a: 'pedir',
    b: 'preguntar',
    note_zh: `【用法】pedir=请求/点餐；preguntar=询问信息。
【例句】Pido un café. / Pregunto la hora.
【易错】别说 *pregunto un café。`,
  },
  {
    a: 'ir',
    b: 'venir',
    note_zh: `【用法】ir=去；venir=来（朝向说话人）。
【例句】Voy a la biblioteca. / ¿Vienes a mi casa?`,
  },
  {
    a: 'llevar',
    b: 'traer',
    note_zh: `【用法】llevar=带走；traer=带来。
【例句】Llevo el libro a clase. / Trae agua, por favor.`,
  },
  {
    a: 'oír',
    b: 'escuchar',
    note_zh: `【用法】oír=听见；escuchar=倾听。
【例句】Oí un ruido. / Escucho música.`,
  },
  {
    a: 'mirar',
    b: 'ver',
    note_zh: `【用法】mirar=看向；ver=看见。
【例句】Mira la pizarra. / ¿Ves aquel edificio?`,
  },
  {
    a: 'hablar',
    b: 'decir',
    note_zh: `【用法】hablar=说话/讲语言；decir=说出内容。
【例句】Hablo español. / Ella dice la verdad.`,
  },
  {
    a: 'recordar',
    b: 'acordarse',
    note_zh: `【用法】recordar 可直接接宾语；acordarse + de。
【例句】Recuerdo tu nombre. / Me acuerdo de tu nombre.`,
  },
  {
    a: 'quedar',
    b: 'quedarse',
    note_zh: `【用法】quedar：约定/剩余；quedarse：留下。
【例句】Quedamos a las seis. / Me quedo en casa.`,
  },
  {
    a: 'gustar',
    b: 'encantar',
    note_zh: `【用法】结构相同；encantar 语气更强。
【例句】Me gusta el café. / Me encanta el chocolate.`,
  },
  {
    a: 'buscar',
    b: 'encontrar',
    note_zh: `【用法】buscar=寻找；encontrar=找到。
【例句】Busco las llaves. / Por fin las encontré.`,
  },
  {
    a: 'empezar',
    b: 'comenzar',
    note_zh: `【用法】几乎同义；empezar 更口语，comenzar 稍正式。
【例句】La clase empieza/comienza a las nueve.`,
  },
  {
    a: 'acabar',
    b: 'terminar',
    note_zh: `【用法】都表结束；acabar de = 刚刚。
【例句】Acabo de llegar. / Terminé de leer.`,
  },
  {
    a: 'muy',
    b: 'mucho',
    note_zh: `【用法】muy 修饰形/副；mucho 修饰动词或名词。
【例句】Está muy cansado. / Estudio mucho. / Muchos libros.`,
  },
  {
    a: 'también',
    b: 'tampoco',
    note_zh: `【用法】también=也；tampoco=也不。
【例句】Yo también voy. / Yo tampoco voy.`,
  },
  {
    a: 'aún',
    b: 'todavía',
    note_zh: `【用法】常可互换，表仍然/还。
【例句】Aún/Todavía estoy aquí. / Todavía no he comido.`,
  },
  {
    a: 'pensar',
    b: 'creer',
    note_zh: `【用法】pensar：思考/打算；creer：相信/认为。
【例句】Pienso estudiar. / Creo que es verdad.`,
  },
  {
    a: 'parecer',
    b: 'aparecer',
    note_zh: `【用法】parecer=似乎；aparecer=出现。
【例句】Parece cansado. / Apareció en la fiesta.`,
  },
  {
    a: 'sentir',
    b: 'sentirse',
    note_zh: `【用法】sentir + 名/从句；sentirse + 形容词。
【例句】Siento frío. / Me siento feliz.`,
  },
  {
    a: 'volver',
    b: 'devolver',
    note_zh: `【用法】volver=返回；devolver=归还。
【例句】Vuelvo a casa. / Devuelvo el libro.`,
  },
  {
    a: 'tener',
    b: 'haber',
    note_zh: `【用法】tener=拥有；hay=存在有。
【例句】Tengo dos hermanos. / Hay mucha gente.`,
  },
  {
    a: 'ganar',
    b: 'vencer',
    note_zh: `【用法】ganar：赢/赚钱；vencer：战胜。
【例句】Ganamos el partido. / Venció al campeón.`,
  },
  {
    a: 'pasar',
    b: 'ocurrir',
    note_zh: `【用法】pasar 口语常用「发生」；ocurrir 稍正式。
【例句】¿Qué pasó? / Eso ocurre a menudo.`,
  },
  {
    a: 'trabajar',
    b: 'funcionar',
    note_zh: `【用法】trabajar=人工作；funcionar=机器运转。
【例句】Trabajo en una oficina. / El ascensor no funciona.`,
  },
  {
    a: 'tomar',
    b: 'llevar',
    note_zh: `【用法】tomar：喝/乘坐；llevar：携带/穿戴。
【例句】Tomo el autobús. / Llevo una maleta.`,
  },
  {
    a: 'pero',
    b: 'sino',
    note_zh: `【用法】pero=但是；sino=而是（否定后纠正）。
【例句】Quiero ir, pero estoy cansado. / No es rojo, sino azul.
【易错】否定后表「而是」用 sino，不用 pero。`,
  },
  {
    a: 'aunque',
    b: 'pero',
    note_zh: `【用法】aunque=虽然/即使（让步）；pero=但是（转折）。
【例句】Aunque llueve, salgo. / Quiero ir, pero no puedo.`,
  },
  {
    a: 'mientras',
    b: 'durante',
    note_zh: `【用法】mientras 连词「当…时」；durante 介词「在…期间」+名词。
【例句】Estudio mientras cocinas. / Durante la clase no hablamos.
【易错】别说 *durante estudio。`,
  },
  {
    a: 'antes',
    b: 'después',
    note_zh: `【用法】antes=以前；después=以后/然后。
【例句】Antes vivía allí. / Después comemos.`,
  },
  {
    a: 'desde',
    b: 'hasta',
    note_zh: `【用法】desde=从…起；hasta=直到。
【例句】Desde 2020 vivo aquí. / Trabajo hasta las seis.`,
  },
  {
    a: 'hacia',
    b: 'hasta',
    note_zh: `【用法】hacia=朝向；hasta=到达某点/直到。
【例句】Camino hacia el parque. / Llego hasta la puerta.`,
  },
  {
    a: 'con',
    b: 'sin',
    note_zh: `【用法】con=和/带有；sin=没有。
【例句】Café con leche. / Café sin azúcar.`,
  },
  {
    a: 'sobre',
    b: 'bajo',
    note_zh: `【用法】sobre=在…上/关于；bajo=在…下。
【例句】El libro está sobre la mesa. / Está bajo la mesa.`,
  },
  {
    a: 'ya',
    b: 'todavía',
    note_zh: `【用法】ya=已经；todavía/aún=还。
【例句】Ya terminé. / Todavía estudio.
【口诀】完成用 ya，未完成用 todavía。`,
  },
  {
    a: 'siempre',
    b: 'nunca',
    note_zh: `【用法】siempre=总是；nunca=从不。
【例句】Siempre llego temprano. / Nunca miento.`,
  },
  {
    a: 'nunca',
    b: 'jamás',
    note_zh: `【用法】二者都表否定「从不」；jamás 语气更强、更书面。
【例句】Nunca lo hago. / Jamás lo olvidaré.`,
  },
  {
    a: 'casi',
    b: 'apenas',
    note_zh: `【用法】casi=几乎；apenas=几乎不/刚刚。
【例句】Casi llego tarde. / Apenas tengo tiempo.`,
  },
  {
    a: 'alguien',
    b: 'nadie',
    note_zh: `【用法】alguien=有人；nadie=没人（否定词）。
【例句】Alguien llama. / Nadie lo sabe.`,
  },
  {
    a: 'algo',
    b: 'nada',
    note_zh: `【用法】algo=某物/一点；nada=什么也没有。
【例句】Quiero algo. / No quiero nada.`,
  },
  {
    a: 'alguno',
    b: 'ninguno',
    note_zh: `【用法】alguno=某个/一些；ninguno=一个也没有。
【例句】¿Hay alguno? / No tengo ninguno.`,
  },
  {
    a: 'este',
    b: 'ese',
    note_zh: `【用法】este=近指这个；ese=中距那个。
【例句】Este libro. / Ese libro.`,
  },
  {
    a: 'ese',
    b: 'aquel',
    note_zh: `【用法】ese=中距；aquel=较远/过去的那个。
【例句】Esa casa. / Aquella casa antigua.`,
  },
  {
    a: 'gustar',
    b: 'interesar',
    note_zh: `【用法】结构相同（间宾+动词+主语）；interesar=使感兴趣。
【例句】Me gusta el cine. / Me interesa la historia.`,
  },
  {
    a: 'gustar',
    b: 'importar',
    note_zh: `【用法】importar=在乎/重要，结构同 gustar。
【例句】Me gusta. / No me importa.`,
  },
  {
    a: 'doler',
    b: 'gustar',
    note_zh: `【用法】doler=疼痛，结构同 gustar（第三人称呼应主语）。
【例句】Me duele la cabeza. / Me gustan las manzanas.`,
  },
  {
    a: 'ponerse',
    b: 'volverse',
    note_zh: `【用法】ponerse：较短暂变化/穿衣；volverse：较持久性格或状态变化。
【例句】Se puso rojo. / Se volvió serio.`,
  },
  {
    a: 'hacerse',
    b: 'convertirse',
    note_zh: `【用法】hacerse：成为（职业等）；convertirse en：转变成。
【例句】Se hizo médico. / Se convirtió en experto.`,
  },
  {
    a: 'llegar',
    b: 'ir',
    note_zh: `【用法】ir=去（过程）；llegar=到达（结果）。
【例句】Voy a Madrid. / Llegamos a las tres.`,
  },
  {
    a: 'seguir',
    b: 'continuar',
    note_zh: `【用法】几乎同义「继续」；seguir + 副动词很常见。
【例句】Sigue estudiando. / Continuamos el viaje.`,
  },
  {
    a: 'andar',
    b: 'caminar',
    note_zh: `【用法】caminar 侧重步行；andar 也可表「处于某种状态」。
【例句】Caminamos por el parque. / Ando cansado.`,
  },
  {
    a: 'subir',
    b: 'bajar',
    note_zh: `【用法】subir=上去/提高；bajar=下来/下降。
【例句】Subo las escaleras. / Bajo del autobús.`,
  },
  {
    a: 'entrar',
    b: 'salir',
    note_zh: `【用法】entrar=进入；salir=出去/离开。
【例句】Entra en clase. / Sale de casa.`,
  },
  {
    a: 'abrir',
    b: 'cerrar',
    note_zh: `【用法】abrir=打开；cerrar=关闭。
【例句】Abre la ventana. / Cierra la puerta.`,
  },
  {
    a: 'encender',
    b: 'apagar',
    note_zh: `【用法】encender=打开电器/点燃；apagar=关掉/熄灭。
【例句】Enciende la luz. / Apaga el móvil.`,
  },
  {
    a: 'despertar',
    b: 'despertarse',
    note_zh: `【用法】despertar=叫醒别人；despertarse=自己醒来。
【例句】Despierto a los niños. / Me despierto a las siete.`,
  },
  {
    a: 'dormir',
    b: 'dormirse',
    note_zh: `【用法】dormir=睡觉；dormirse=睡着/入睡。
【例句】Duermo ocho horas. / Me dormí en el sofá.`,
  },
  {
    a: 'acostarse',
    b: 'levantarse',
    note_zh: `【用法】acostarse=上床躺下；levantarse=起床。
【例句】Me acuesto a las once. / Me levanto temprano.`,
  },
  {
    a: 'llamar',
    b: 'llamarse',
    note_zh: `【用法】llamar=打电话/呼叫；llamarse=名叫。
【例句】Te llamo luego. / Me llamo Ana.`,
  },
  {
    a: 'caer',
    b: 'caerse',
    note_zh: `【用法】caer=落下；caerse=摔倒（人）。
【例句】La lluvia cae. / Me caí en la calle.`,
  },
  {
    a: 'romper',
    b: 'romperse',
    note_zh: `【用法】romper=弄破某物；romperse=自己破裂/骨折。
【例句】Rompió el vaso. / Se rompió el brazo.`,
  },
  {
    a: 'mover',
    b: 'moverse',
    note_zh: `【用法】mover=移动某物；moverse=自己移动。
【例句】Mueve la silla. / No te muevas.`,
  },
  {
    a: 'prestar',
    b: 'alquilar',
    note_zh: `【用法】prestar=借出；alquilar=租。
【例句】Te presto el libro. / Alquilo un piso.`,
  },
  {
    a: 'comprar',
    b: 'vender',
    note_zh: `【用法】comprar=买；vender=卖。
【例句】Compro pan. / Vende frutas.`,
  },
  {
    a: 'pagar',
    b: 'cobrar',
    note_zh: `【用法】pagar=支付；cobrar=收取钱款。
【例句】Pago la cuenta. / Cobro el sueldo.`,
  },
  {
    a: 'costar',
    b: 'valer',
    note_zh: `【用法】costar=多少钱/花多少；valer=值/值得。
【例句】¿Cuánto cuesta? / Vale la pena.`,
  },
  {
    a: 'durar',
    b: 'tardar',
    note_zh: `【用法】durar=事物持续多久；tardar=人做某事花多久。
【例句】La película dura dos horas. / Tardo diez minutos.`,
  },
  {
    a: 'soler',
    b: 'acostumbrarse',
    note_zh: `【用法】soler + 不定式=通常；acostumbrarse a=习惯于。
【例句】Suelo leer. / Me acostumbro al clima.`,
  },
  {
    a: 'dejar',
    b: 'permitir',
    note_zh: `【用法】dejar 口语可表允许；permitir 更正式「允许」。
【例句】Déjame ayudarte. / No permiten fumar.`,
  },
  {
    a: 'poder',
    b: 'deber',
    note_zh: `【用法】poder=能够/可以；deber=应该。
【例句】Puedo nadar. / Debo estudiar.`,
  },
  {
    a: 'querer',
    b: 'preferir',
    note_zh: `【用法】querer=想要；preferir=更喜欢/宁可。
【例句】Quiero café. / Prefiero té.`,
  },
  {
    a: 'pasar',
    b: 'suceder',
    note_zh: `【用法】都可表发生；pasar 更口语，suceder 稍中性正式。
【例句】¿Qué pasó? / No sé qué sucedió.`,
  },
  {
    a: 'ahora',
    b: 'ya',
    note_zh: `【用法】ahora=现在；ya=已经/马上（完成或催促）。
【例句】Ahora estudio. / Ya terminé. / ¡Ya voy!
【口诀】说「此刻」用 ahora；说「已经」用 ya。`,
  },
  {
    a: 'aquí',
    b: 'allí',
    note_zh: `【用法】aquí=这里；allí=那里（较远）。
【例句】Ven aquí. / El libro está allí.`,
  },
  {
    a: 'ahí',
    b: 'allí',
    note_zh: `【用法】ahí=那边（中距）；allí=更远。
【例句】Ponte ahí. / Allí, lejos, hay un árbol.`,
  },
  {
    a: 'este',
    b: 'aquel',
    note_zh: `【用法】este=近指；aquel=远指/过去的。
【例句】Este año. / En aquel entonces.`,
  },
  {
    a: 'mucho',
    b: 'poco',
    note_zh: `【用法】mucho=很多；poco=很少。
【例句】Estudio mucho. / Duermo poco.`,
  },
  {
    a: 'más',
    b: 'menos',
    note_zh: `【用法】más=更多；menos=更少。
【例句】Quiero más. / Habla menos.`,
  },
  {
    a: 'mejor',
    b: 'peor',
    note_zh: `【用法】mejor=更好；peor=更差。
【例句】Es mejor. / Es peor.`,
  },
  {
    a: 'mayor',
    b: 'menor',
    note_zh: `【用法】mayor=更大/更年长；menor=更小/更年幼。
【例句】Mi hermano mayor. / El problema menor.`,
  },
  {
    a: 'primero',
    b: 'último',
    note_zh: `【用法】primero=第一/首先；último=最后。
【例句】El primer día. / El último tren.`,
  },
  {
    a: 'temprano',
    b: 'tarde',
    note_zh: `【用法】temprano=早；tarde=晚（也可作名词「下午」）。
【例句】Me levanto temprano. / Llegué tarde.`,
  },
  {
    a: 'cerca',
    b: 'lejos',
    note_zh: `【用法】cerca=近；lejos=远。常 + de。
【例句】Vivo cerca de la universidad. / Está lejos.`,
  },
  {
    a: 'dentro',
    b: 'fuera',
    note_zh: `【用法】dentro=里面；fuera=外面。常 + de。
【例句】Está dentro. / Espera fuera.`,
  },
  {
    a: 'arriba',
    b: 'abajo',
    note_zh: `【用法】arriba=上面；abajo=下面。
【例句】Mira arriba. / Firma abajo.`,
  },
  {
    a: 'delante',
    b: 'detrás',
    note_zh: `【用法】delante=前面；detrás=后面。常 + de。
【例句】Delante de la casa. / Detrás del árbol.`,
  },
  {
    a: 'izquierda',
    b: 'derecha',
    note_zh: `【用法】izquierda=左；derecha=右。
【例句】Gira a la izquierda. / A la derecha.`,
  },
  {
    a: 'entrar',
    b: 'meter',
    note_zh: `【用法】entrar=进入（人/物自己进）；meter=把…放进。
【例句】Entra en la habitación. / Mete el libro en la bolsa.`,
  },
  {
    a: 'sacar',
    b: 'quitar',
    note_zh: `【用法】sacar=取出/拿出；quitar=去掉/脱掉。
【例句】Saco la basura. / Quítate el abrigo.`,
  },
  {
    a: 'poner',
    b: 'meter',
    note_zh: `【用法】poner=放置/穿上；meter=塞进/放进容器。
【例句】Pon el plato en la mesa. / Mete la carta en el sobre.`,
  },
  {
    a: 'dar',
    b: 'regalar',
    note_zh: `【用法】dar=给（通用）；regalar=赠送礼物。
【例句】Dame el libro. / Me regalaron flores.`,
  },
  {
    a: 'recibir',
    b: 'aceptar',
    note_zh: `【用法】recibir=收到；aceptar=接受（同意）。
【例句】Recibí tu mensaje. / Acepto la invitación.`,
  },
  {
    a: 'ofrecer',
    b: 'invitar',
    note_zh: `【用法】ofrecer=提供/提出；invitar=邀请。
【例句】Te ofrezco ayuda. / Te invito a cenar.`,
  },
  {
    a: 'prometer',
    b: 'asegurar',
    note_zh: `【用法】prometer=许诺；asegurar=确保/保证（也可投保）。
【例句】Prometo llegar temprano. / Te aseguro que es verdad.`,
  },
  {
    a: 'intentar',
    b: 'tratar',
    note_zh: `【用法】intentar=试图；tratar de=设法/对待。
【例句】Intento ayudar. / Trato de entender.`,
  },
  {
    a: 'conseguir',
    b: 'lograr',
    note_zh: `【用法】几乎同义「成功做成」；lograr 稍正式。
【例句】Conseguí el trabajo. / Logró su objetivo.`,
  }
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