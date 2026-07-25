/** 西语 TTS：H5 用 Web Speech；小程序走后端 /api/tts + InnerAudioContext */
import { getApiBase } from './api.js'
import { APP_CONFIG } from '../config/app.js'

let currentAudio = null

function stopCurrentAudio() {
  if (!currentAudio) return
  try {
    currentAudio.stop()
    currentAudio.destroy()
  } catch {
    // ignore
  }
  currentAudio = null
}

function buildTtsUrl(text, lang = 'es') {
  const q = encodeURIComponent(String(text || '').trim())
  if (!q) return ''
  const base = getApiBase()
  if (base.startsWith('http')) {
    return `${base}/tts?lang=${encodeURIComponent(lang)}&q=${q}`
  }
  // #ifdef H5
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${base}/tts?lang=${encodeURIComponent(lang)}&q=${q}`
  }
  // #endif
  const origin = String(APP_CONFIG.apiDomain || '').replace(/\/+$/, '')
  if (origin) return `${origin}/api/tts?lang=${encodeURIComponent(lang)}&q=${q}`
  return `${base}/tts?lang=${encodeURIComponent(lang)}&q=${q}`
}

function playWithInnerAudio(src) {
  return new Promise((resolve, reject) => {
    stopCurrentAudio()
    const audio = uni.createInnerAudioContext()
    currentAudio = audio
    audio.obeyMuteSwitch = false
    // #ifdef MP-WEIXIN
    audio.autoplay = true
    // #endif
    audio.src = src

    const done = (err) => {
      if (currentAudio === audio) currentAudio = null
      try {
        audio.destroy()
      } catch {
        // ignore
      }
      if (err) reject(err)
      else resolve()
    }

    audio.onEnded(() => done())
    audio.onStop(() => done())
    audio.onError((e) => {
      done(new Error(e?.errMsg || '发音播放失败'))
    })
    try {
      audio.play()
    } catch (e) {
      done(e instanceof Error ? e : new Error('发音播放失败'))
    }
  })
}

function downloadThenPlay(url) {
  return new Promise((resolve, reject) => {
    uni.downloadFile({
      url,
      timeout: 20000,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.tempFilePath) {
          playWithInnerAudio(res.tempFilePath).then(resolve).catch(reject)
          return
        }
        reject(new Error(`下载发音失败(${res.statusCode || '?'})`))
      },
      fail: (err) => {
        reject(new Error(err?.errMsg || '下载发音失败'))
      },
    })
  })
}

function playRemoteTts(text, lang = 'es') {
  const url = buildTtsUrl(text, lang)
  if (!url) return Promise.reject(new Error('无文本'))

  // 小程序：先 downloadFile 再播本地临时文件，比直接挂远程 URL 更稳
  // #ifdef MP-WEIXIN
  return downloadThenPlay(url).catch(() => playWithInnerAudio(url))
  // #endif

  // #ifndef MP-WEIXIN
  return playWithInnerAudio(url)
  // #endif
}

export function speakSpanish(text) {
  const value = String(text || '').trim()
  if (!value) return Promise.reject(new Error('无文本'))

  // #ifdef H5
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    return new Promise((resolve, reject) => {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(value)
      u.lang = 'es-ES'
      u.rate = 0.85
      u.onend = () => resolve()
      u.onerror = () => {
        // H5 语音引擎失败时回退到远端 TTS
        playRemoteTts(value).then(resolve).catch(reject)
      }
      window.speechSynthesis.speak(u)
    })
  }
  // #endif

  return playRemoteTts(value)
}

export function speakLemma(lemma) {
  return speakSpanish(lemma)
}

export function stopSpeaking() {
  // #ifdef H5
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
  // #endif
  stopCurrentAudio()
}
