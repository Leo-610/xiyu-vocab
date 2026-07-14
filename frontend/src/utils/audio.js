/** 播放单词发音：优先 audio_url，否则 TTS */
import { resolveMediaUrl } from './media.js'
import { speakLemma } from './tts.js'
import { getApiBase } from './api.js'

function resolveAudioUrl(relativePath) {
  const url = resolveMediaUrl(relativePath)
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/')) {
    const base = getApiBase()
    if (base.startsWith('http')) {
      return `${base.replace(/\/api\/?$/, '')}${url}`
    }
    // #ifdef H5
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}${url}`
    }
    // #endif
    return `http://localhost:3000${url}`
  }
  return url
}

export function playWordAudio(word) {
  if (!word?.lemma) return Promise.resolve()
  const url = resolveAudioUrl(word.audio_url)
  if (url) {
    return playRemoteAudio(url, word.lemma)
  }
  return speakLemma(word.lemma)
}

function playRemoteAudio(url, fallbackLemma) {
  return new Promise((resolve) => {
    const audio = uni.createInnerAudioContext()
    audio.src = url
    audio.onEnded(() => {
      audio.destroy()
      resolve()
    })
    audio.onError(() => {
      audio.destroy()
      speakLemma(fallbackLemma).then(resolve).catch(() => resolve())
    })
    audio.play()
  })
}
