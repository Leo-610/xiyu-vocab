/** 西语 TTS — H5 使用 Web Speech API；小程序二期接插件 */

export function speakSpanish(text) {
  if (!text?.trim()) return Promise.reject(new Error('无文本'))

  // #ifdef H5
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    return new Promise((resolve, reject) => {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'es-ES'
      u.rate = 0.85
      u.onend = resolve
      u.onerror = reject
      window.speechSynthesis.speak(u)
    })
  }
  // #endif

  uni.showToast({ title: '当前环境暂不支持发音', icon: 'none' })
  return Promise.resolve()
}

export function speakLemma(lemma) {
  return speakSpanish(lemma)
}
