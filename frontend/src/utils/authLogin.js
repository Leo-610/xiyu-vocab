import * as api from './api.js'
import { wxLogin } from './wechatAuth.js'

export async function performWechatLogin() {
  const code = await wxLogin()
  return api.loginWechat(code)
}

/** H5 演示：昵称登录（须已注册） */
export async function performDemoLogin(nickname) {
  return api.login(nickname)
}

/** H5 演示：昵称注册 */
export async function performDemoRegister(nickname) {
  return api.register(nickname)
}
