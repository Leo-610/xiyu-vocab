/**
 * 应用配置 — 个人开发者主体
 * 注册个人小程序后同步更新微信公众平台「用户隐私保护指引」
 */
export const APP_CONFIG = {
  name: '西语背单词',

  /** 运营主体（隐私政策展示，可填姓名或昵称） */
  orgName: '个人开发者',

  /**
   * 联系邮箱 — 微信审核必填，请改成你的真实邮箱
   * 示例：163/QQ/Outlook 等常用邮箱均可
   */
  contactEmail: '请填写你的邮箱@example.com',

  /** 指导教师（个人主体可留空） */
  advisorName: '',

  /** 隐私协议版本：政策更新后递增，会触发用户重新确认 */
  privacyVersion: '1.0.0',

  /** 个人上线版：关闭内容组开发横幅 */
  showDevBanner: false,

  /** 主体类型：personal | school */
  subjectType: 'personal',

  /** 生产 API 域名（仅文档展示，实际以 .env.production 为准） */
  apiDomain: 'https://api.yourdomain.com',
}

/** 微信 AppID：注册后填入 manifest.json → mp-weixin.appid */
export const WECHAT_APPID_PLACEHOLDER = 'wx________________'
