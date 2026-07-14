/** 西语拼写比对（听写判题） */

const ACCENT_MAP = {
  á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n',
  Á: 'a', É: 'e', Í: 'i', Ó: 'o', Ú: 'u', Ü: 'u', Ñ: 'n',
}

export function normalizeSpanish(text, { stripAccents = true } = {}) {
  let s = String(text || '').trim().toLowerCase()
  s = s.replace(/\s+/g, ' ')
  if (stripAccents) {
    s = s.split('').map((ch) => ACCENT_MAP[ch] ?? ch).join('')
    s = s.normalize('NFD').replace(/\p{M}/gu, '')
  }
  return s
}

/**
 * @param {string} userInput
 * @param {string} expectedLemma
 * @param {{ strictAccents?: boolean }} options  默认 false：不要求重音/ñ 完全正确
 */
export function checkSpelling(userInput, expectedLemma, options = {}) {
  const strict = options.strictAccents === true
  const a = normalizeSpanish(userInput, { stripAccents: !strict })
  const b = normalizeSpanish(expectedLemma, { stripAccents: !strict })
  if (!a) return { ok: false, reason: 'empty' }
  return { ok: a === b, normalizedInput: a, normalizedExpected: b }
}
