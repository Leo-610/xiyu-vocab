/** 微信小程序 uni.login 获取临时 code */
export function wxLogin() {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('微信登录超时，请检查网络后重试'))
    }, 12000)

    uni.login({
      provider: 'weixin',
      timeout: 10000,
      success(res) {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (res.code) {
          resolve(res.code)
          return
        }
        reject(new Error('未获取到微信 code'))
      },
      fail(err) {
        if (settled) return
        settled = true
        clearTimeout(timer)
        const msg = err?.errMsg || '微信登录失败'
        reject(new Error(/timeout/i.test(msg) ? '微信登录超时，请再试一次' : msg))
      },
    })
  })
}
