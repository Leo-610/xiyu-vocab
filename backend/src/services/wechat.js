import { getConfig } from '../config.js'

/**
 * 微信小程序 code 换 openid（服务端调用，AppSecret 不可下发到客户端）
 * @see https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2Session.html
 */
export async function code2Session(code) {
  const { wechatAppId, wechatAppSecret, wechatConfigured } = getConfig()
  if (!wechatConfigured) {
    const err = new Error('服务端未配置 WECHAT_APPID / WECHAT_APPSECRET')
    err.code = 'WECHAT_NOT_CONFIGURED'
    throw err
  }
  if (!code || typeof code !== 'string') {
    const err = new Error('缺少微信登录 code')
    err.code = 'INVALID_CODE'
    throw err
  }

  const params = new URLSearchParams({
    appid: wechatAppId,
    secret: wechatAppSecret,
    js_code: code,
    grant_type: 'authorization_code',
  })

  const res = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${params}`)
  const data = await res.json()

  if (data.errcode) {
    const err = new Error(data.errmsg || `微信登录失败 (${data.errcode})`)
    err.code = 'WECHAT_API_ERROR'
    err.wechatErrcode = data.errcode
    throw err
  }
  if (!data.openid) {
    const err = new Error('微信未返回 openid')
    err.code = 'WECHAT_NO_OPENID'
    throw err
  }

  return {
    openid: data.openid,
    unionid: data.unionid || null,
  }
}
