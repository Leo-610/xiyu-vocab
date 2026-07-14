import { APP_CONFIG } from '../config/app.js'

const STORAGE_KEY = 'privacy_agreed'

export function getPrivacyStorageKey() {
  return `${STORAGE_KEY}_${APP_CONFIG.privacyVersion}`
}

export function hasPrivacyAgreed() {
  try {
    return uni.getStorageSync(getPrivacyStorageKey()) === true
  } catch {
    return false
  }
}

export function setPrivacyAgreed() {
  uni.setStorageSync(getPrivacyStorageKey(), true)
}

export function clearPrivacyAgreed() {
  try {
    uni.removeStorageSync(getPrivacyStorageKey())
  } catch {
    // ignore
  }
}

/** 用户拒绝时退出（小程序）或提示（H5） */
export function declinePrivacy() {
  // #ifdef MP-WEIXIN
  if (typeof wx !== 'undefined' && wx.exitMiniProgram) {
    wx.exitMiniProgram()
    return
  }
  // #endif
  uni.showToast({ title: '需同意协议后方可使用', icon: 'none' })
}
