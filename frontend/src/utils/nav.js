/** 安全封装 uni 路由，避免 H5 未处理的 Promise 拒绝刷控制台 */

function asPromise(apiCall) {
  try {
    const ret = apiCall()
    if (ret && typeof ret.then === 'function') {
      return ret.catch(() => undefined)
    }
  } catch {
    // ignore sync throw
  }
  return Promise.resolve()
}

export function safeReLaunch(url) {
  return asPromise(() => uni.reLaunch({ url }))
}

export function safeSwitchTab(url) {
  return asPromise(() => uni.switchTab({ url }))
}

export function safeNavigateTo(url) {
  return asPromise(() => uni.navigateTo({ url }))
}

export function safeRedirectTo(url) {
  return asPromise(() => uni.redirectTo({ url }))
}
