/** 将后端相对路径转为可访问 URL（H5 代理 / 小程序 HTTPS） */
export function resolveMediaUrl(relativePath) {
  if (!relativePath) return ''
  if (/^https?:\/\//i.test(relativePath)) return relativePath

  const apiBase = import.meta.env.VITE_API_BASE || '/api'
  if (apiBase.startsWith('http')) {
    const origin = apiBase.replace(/\/api\/?$/, '')
    return `${origin}${relativePath}`
  }

  // H5 开发：Vite 代理 /static
  return relativePath
}

export function userInitial(nickname) {
  const name = String(nickname || '').trim()
  if (!name || name === '微信用户') return '西'
  return name.slice(0, 1).toUpperCase()
}
