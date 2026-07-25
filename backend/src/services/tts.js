/**
 * 西语 TTS 代理：服务端拉取公开 TTS 音频，供小程序 InnerAudioContext 播放。
 * （词库暂无 audio_url 时的兜底方案）
 */

const MAX_CHARS = 80

function sanitizeText(raw) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_CHARS)
}

function buildCandidates(text, lang) {
  const q = encodeURIComponent(text)
  const tl = encodeURIComponent(lang || 'es')
  const audio = encodeURIComponent(text)
  return [
    // Google Translate TTS（西语质量较好；国内可能不可达，Vercel 东京一般可用）
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${tl}&q=${q}`,
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}&q=${q}`,
    // 有道词典发音（国内可达；le=es 为西语）
    `https://dict.youdao.com/dictvoice?audio=${audio}&le=es`,
  ]
}

function looksLikeAudio(buf, contentType) {
  if (!buf?.length || buf.length < 64) return false
  if (/audio|mpeg|octet-stream/i.test(contentType || '')) return true
  // MP3 frame sync / ID3
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true
  return false
}

export async function fetchTtsAudio(text, lang = 'es') {
  const clean = sanitizeText(text)
  if (!clean) {
    const err = new Error('缺少朗读文本')
    err.code = 'MISSING_TEXT'
    throw err
  }

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    Referer: 'https://translate.google.com/',
  }

  let lastError = null
  for (const url of buildCandidates(clean, lang)) {
    try {
      const res = await fetch(url, { headers, redirect: 'follow' })
      if (!res.ok) {
        lastError = new Error(`TTS upstream ${res.status}`)
        continue
      }
      const buf = Buffer.from(await res.arrayBuffer())
      const contentType = res.headers.get('content-type') || 'audio/mpeg'
      if (!looksLikeAudio(buf, contentType)) {
        lastError = new Error('TTS 返回非音频内容')
        continue
      }
      return {
        buffer: buf,
        contentType: contentType.includes('audio') ? contentType : 'audio/mpeg',
      }
    } catch (e) {
      lastError = e
    }
  }

  const err = new Error(lastError?.message || 'TTS 获取失败')
  err.code = 'TTS_UPSTREAM_FAILED'
  throw err
}
