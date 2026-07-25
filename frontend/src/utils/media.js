import { APP_CONFIG } from '../config/app.js'
import { API_BASE } from './api.js'

/** 将后端相对路径转为可访问 URL（H5 代理 / 小程序 HTTPS） */
export function resolveMediaUrl(relativePath) {
  if (!relativePath) return ''
  if (/^https?:\/\//i.test(relativePath)) return relativePath
  if (relativePath.startsWith('//')) return `https:${relativePath}`

  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`
  const apiBase = API_BASE || import.meta.env.VITE_API_BASE || '/api'

  if (apiBase.startsWith('http')) {
    const origin = apiBase.replace(/\/api\/?$/, '')
    return `${origin}${path}`
  }

  // 小程序包内没有 /static/images；相对路径会变成「本地资源」并 500
  // #ifdef MP
  const origin = String(APP_CONFIG.apiDomain || '').replace(/\/+$/, '')
  if (origin) return `${origin}${path}`
  // #endif

  // H5 开发：Vite 代理 /static
  return path
}

export function userInitial(nickname) {
  const name = String(nickname || '').trim()
  if (!name || name === '微信用户') return '西'
  return name.slice(0, 1).toUpperCase()
}
