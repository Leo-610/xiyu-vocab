/**
 * 微信小程序官方隐私授权（与 App 内 consent 页互补）
 * https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/
 */

let pendingResolve = null

/** 注册官方隐私弹窗回调（在 App onLaunch 调用一次） */
export function setupWxPrivacyListener() {
  // #ifdef MP-WEIXIN
  if (typeof wx === 'undefined' || !wx.onNeedPrivacyAuthorization) return
  wx.onNeedPrivacyAuthorization((resolve) => {
    pendingResolve = resolve
    // 若用户已在同意页点过「同意」，直接放行；否则等同意页按钮
    try {
      if (uni.getStorageSync('wx_privacy_authorized') === true) {
        resolve({ event: 'agree', buttonId: 'agree-btn' })
        pendingResolve = null
      }
    } catch {
      // ignore
    }
  })
  // #endif
}

/** 用户点击「同意」时通知微信（配合 open-type=agreePrivacyAuthorization） */
export function markWxPrivacyAgreed() {
  try {
    uni.setStorageSync('wx_privacy_authorized', true)
  } catch {
    // ignore
  }
  if (pendingResolve) {
    try {
      pendingResolve({ event: 'agree', buttonId: 'agree-btn' })
    } catch {
      // ignore
    }
    pendingResolve = null
  }
}

/** 主动拉起隐私授权（选头像/昵称前调用） */
export function requireWxPrivacyAuthorize() {
  return new Promise((resolve) => {
    // #ifdef MP-WEIXIN
    if (typeof wx === 'undefined' || !wx.requirePrivacyAuthorize) {
      resolve(true)
      return
    }
    wx.requirePrivacyAuthorize({
      success: () => resolve(true),
      fail: () => resolve(false),
    })
    // #endif
    // #ifndef MP-WEIXIN
    resolve(true)
    // #endif
  })
}
