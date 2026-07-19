import * as api from './api.js'
import { wxLogin } from './wechatAuth.js'

export async function performWechatLogin() {
  const code = await wxLogin()
  return api.loginWechat(code)
}

/** H5：邮箱/手机号 + 密码登录 */
export async function performPasswordLogin(account, password) {
  return api.login({ account, password })
}

/** H5：邮箱/手机号 + 密码注册（手机号须带 bindEmail） */
export async function performPasswordRegister({ account, password, email, nickname }) {
  return api.register({ account, password, email, nickname })
}

/** H5 演示：昵称登录（须已注册，无密码） */
export async function performDemoLogin(nickname) {
  return api.login(nickname)
}

/** H5 演示：昵称注册 */
export async function performDemoRegister(nickname) {
  return api.register(nickname)
}

/** 邮箱验证码：发送 */
export async function performEmailSendOtp(email) {
  return api.sendEmailOtp(email)
}

/** 邮箱验证码：验证登录 */
export async function performEmailVerifyOtp(email, code) {
  return api.verifyEmailOtp(email, code)
}
