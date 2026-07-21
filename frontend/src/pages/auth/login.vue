<template>
  <view class="auth-page">
    <view class="hero">
      <view class="hero-pattern" />
      <view class="hero-glow" />
      <view class="hero-content animate-fade">
        <text class="hero-es">¡Bienvenido!</text>
        <text class="brand">西语背单词</text>
        <text class="tagline">看图识词 · 听写拼写 · DELE 分级</text>
        <view class="status-row">
          <view class="status-dot" :class="apiOnline ? 'on' : 'off'" />
          <text class="status-text">
            {{ checkedOnline ? (apiOnline ? '服务已连接' : '服务未连接') : '检测中…' }}
          </text>
        </view>
      </view>
    </view>

    <view class="panel animate-slide">
      <!-- #ifdef MP-WEIXIN -->
      <WechatProfileForm
        v-if="wechatStep === 'profile'"
        :initial-nickname="profileUser.nickname"
        :initial-avatar-url="profileUser.avatarUrl"
        title="完善微信资料"
        subtitle="选择微信头像与昵称，用于个人展示与学习统计"
        submit-text="保存并进入"
        @saved="onProfileSaved"
      />

      <template v-else>
        <text class="panel-title">微信登录</text>
        <text class="panel-desc">使用微信身份同步学习进度，数据保存在云端。</text>
        <view v-if="error" class="error-msg">{{ error }}</view>
        <AppButton block :loading="loading" :disabled="!apiOnline" @click="handleWechatLogin">
          微信一键登录
        </AppButton>
      </template>
      <!-- #endif -->

      <!-- #ifndef MP-WEIXIN -->
      <template v-if="passwordAuthEnabled && h5Method === 'password'">
        <view class="mode-tabs">
          <view
            class="mode-tab"
            :class="{ active: authMode === 'login' }"
            @click="switchAuthMode('login')"
          >
            登录
          </view>
          <view
            class="mode-tab"
            :class="{ active: authMode === 'register' }"
            @click="switchAuthMode('register')"
          >
            注册
          </view>
        </view>

        <text class="panel-title">{{ authMode === 'login' ? '欢迎回来' : '创建账号' }}</text>
        <text class="panel-desc">
          {{ authMode === 'login'
            ? '使用邮箱或手机号 + 密码登录，学习进度保存在云端。'
            : '账号为邮箱，或手机号并绑定邮箱；密码须含大小写字母与数字。' }}
        </text>

        <view class="field" :class="{ focused: accountFocused, error: Boolean(error) }">
          <text class="label">账号</text>
          <input
            v-model="account"
            class="input"
            type="text"
            maxlength="64"
            :placeholder="authMode === 'login' ? '邮箱或手机号' : '邮箱，或 11 位手机号'"
            confirm-type="next"
            @focus="accountFocused = true"
            @blur="accountFocused = false"
          />
        </view>

        <view
          v-if="authMode === 'register' && accountLooksLikePhone"
          class="field"
          :class="{ focused: bindEmailFocused, error: Boolean(error) }"
        >
          <text class="label">绑定邮箱</text>
          <input
            v-model="bindEmail"
            class="input"
            type="text"
            inputmode="email"
            maxlength="64"
            placeholder="用于找回与通知"
            confirm-type="next"
            @focus="bindEmailFocused = true"
            @blur="bindEmailFocused = false"
          />
        </view>

        <view class="field" :class="{ focused: passFocused, error: Boolean(error) }">
          <text class="label">密码</text>
          <input
            v-model="password"
            class="input"
            password
            maxlength="64"
            :placeholder="authMode === 'login' ? '输入密码' : '至少 8 位，含大小写与数字'"
            confirm-type="done"
            @focus="passFocused = true"
            @blur="passFocused = false"
            @confirm="handlePasswordSubmit"
          />
        </view>

        <view v-if="authMode === 'register'" class="field" :class="{ focused: pass2Focused, error: Boolean(error) }">
          <text class="label">确认密码</text>
          <input
            v-model="passwordConfirm"
            class="input"
            password
            maxlength="64"
            placeholder="再次输入密码"
            confirm-type="done"
            @focus="pass2Focused = true"
            @blur="pass2Focused = false"
            @confirm="handlePasswordSubmit"
          />
        </view>

        <text v-if="authMode === 'register'" class="hint-line">密码要求：≥8 位，同时包含大写、小写英文字母和数字</text>

        <view v-if="recentAccount && authMode === 'login'" class="quick-row" @click="useRecentAccount">
          <text class="quick-label">最近使用</text>
          <text class="quick-name">{{ recentAccount }}</text>
        </view>

        <view v-if="error" class="error-msg">{{ error }}</view>

        <AppButton
          block
          :loading="loading"
          :disabled="!apiOnline || !account.trim() || !password"
          @click="handlePasswordSubmit"
        >
          {{ authMode === 'login' ? '登录并进入 →' : '注册并开始 →' }}
        </AppButton>

        <view class="switch-hint" @click="switchAuthMode(authMode === 'login' ? 'register' : 'login')">
          <text v-if="authMode === 'login'">还没有账号？</text>
          <text v-else>已有账号？</text>
          <text class="switch-link">{{ authMode === 'login' ? '去注册' : '去登录' }}</text>
        </view>

        <view v-if="emailAuthEnabled" class="switch-hint" @click="h5Method = 'otp'">
          <text class="switch-link">改用邮箱验证码登录</text>
        </view>
      </template>

      <template v-else-if="emailAuthEnabled && h5Method === 'otp'">
        <template v-if="step === 'email'">
          <text class="panel-title">邮箱验证码登录</text>
          <text class="panel-desc">输入邮箱获取验证码，首次登录将自动创建账号。</text>

          <view class="field" :class="{ focused: emailFocused, error: Boolean(error) }">
            <text class="label">邮箱</text>
            <input
              v-model="email"
              class="input"
              type="text"
              inputmode="email"
              maxlength="64"
              placeholder="reader@example.com"
              confirm-type="next"
              @focus="emailFocused = true"
              @blur="emailFocused = false"
              @confirm="handleSendCode"
            />
          </view>

          <view v-if="recentEmail" class="quick-row" @click="useRecentEmail">
            <text class="quick-label">最近使用</text>
            <text class="quick-name">{{ recentEmail }}</text>
          </view>

          <view v-if="error" class="error-msg">{{ error }}</view>

          <AppButton
            block
            :loading="loading"
            :disabled="!apiOnline || !email.trim()"
            @click="handleSendCode"
          >
            发送验证码
          </AppButton>

          <view v-if="passwordAuthEnabled" class="switch-hint" @click="h5Method = 'password'">
            <text class="switch-link">改用账号密码登录</text>
          </view>
        </template>

        <template v-else>
          <text class="panel-title">输入验证码</text>
          <text class="panel-desc">验证码已发送至 {{ email }}</text>

          <view class="wechat-tip">
            <text class="wechat-tip-title">⚠️ 微信内打开？</text>
            <text class="wechat-tip-body">请勿点击邮件里的可疑链接。请复制邮件中的 6 位验证码，回到本页手动输入。</text>
          </view>

          <view class="field" :class="{ focused: codeFocused, error: Boolean(error) }">
            <text class="label">验证码</text>
            <input
              v-model="otpCode"
              class="input code-input"
              type="number"
              maxlength="6"
              placeholder="000000"
              confirm-type="done"
              @focus="codeFocused = true"
              @blur="codeFocused = false"
              @confirm="handleVerifyCode"
            />
          </view>

          <view v-if="error" class="error-msg">{{ error }}</view>

          <AppButton
            block
            :loading="loading"
            :disabled="!apiOnline || otpCode.trim().length < 6"
            @click="handleVerifyCode"
          >
            确认登录
          </AppButton>

          <view class="switch-hint" @click="backToEmail">
            <text class="switch-link">← 更换邮箱</text>
          </view>
        </template>
      </template>

      <template v-else>
        <text class="panel-title">登录暂不可用</text>
        <text class="panel-desc">服务未就绪，请稍后重试或联系管理员。</text>
        <view v-if="error" class="error-msg">{{ error }}</view>
      </template>
      <!-- #endif -->

      <view v-if="wechatStep !== 'profile'" class="legal">
        <text class="legal-text">继续即表示同意</text>
        <text class="legal-link" @click="goTerms">用户协议</text>
        <text class="legal-dot">与</text>
        <text class="legal-link" @click="goPrivacy">隐私政策</text>
      </view>
    </view>

    <view v-if="!apiOnline && checkedOnline && wechatStep !== 'profile'" class="offline-banner">
      <text>暂时连不上服务器，请稍后重试或检查网络</text>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  checkApiOnline,
  getAuthConfig,
  getLastAccount,
  getLastEmail,
  getUserState,
  isLoggedIn,
  loginWithAccount,
  loginWithEmailOtp,
  loginWithWechat,
  registerWithAccount,
  sendEmailLoginCode,
  setCachedState,
} from '../../utils/userService.js'

const email = ref('')
const otpCode = ref('')
const step = ref('email')
const authMode = ref('login')
const h5Method = ref('password')
const account = ref('')
const bindEmail = ref('')
const password = ref('')
const passwordConfirm = ref('')
const recentEmail = ref(getLastEmail())
const recentAccount = ref(getLastAccount())
const loading = ref(false)
const error = ref('')
const apiOnline = ref(false)
const checkedOnline = ref(false)
const emailFocused = ref(false)
const codeFocused = ref(false)
const accountFocused = ref(false)
const bindEmailFocused = ref(false)
const passFocused = ref(false)
const pass2Focused = ref(false)
const wechatStep = ref('login')
const profileUser = ref({ nickname: '', avatarUrl: '' })

const emailAuthEnabled = computed(() => getAuthConfig().email)
const passwordAuthEnabled = computed(() => getAuthConfig().password !== false)

const accountLooksLikePhone = computed(() => {
  const raw = account.value.trim().replace(/[\s\-()]/g, '')
  const digits = raw.startsWith('+86') ? raw.slice(3) : raw.startsWith('0086') ? raw.slice(4) : raw
  return /^1[3-9]\d{0,9}$/.test(digits) && !raw.includes('@')
})

function isStrongPassword(pw) {
  return pw.length >= 8 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[0-9]/.test(pw)
}

function switchAuthMode(mode) {
  authMode.value = mode
  error.value = ''
  password.value = ''
  passwordConfirm.value = ''
}

onShow(async () => {
  recentEmail.value = getLastEmail()
  recentAccount.value = getLastAccount()
  if (!email.value && recentEmail.value) {
    email.value = recentEmail.value
  }
  if (!account.value && recentAccount.value) {
    account.value = recentAccount.value
  }

  apiOnline.value = await checkApiOnline()
  checkedOnline.value = true
  if (passwordAuthEnabled.value) {
    h5Method.value = 'password'
  } else if (emailAuthEnabled.value) {
    h5Method.value = 'otp'
  }

  if (!isLoggedIn()) return

  try {
    const state = await getUserState(true)
    // #ifdef MP-WEIXIN
    if (state.needsProfile) {
      profileUser.value = state
      wechatStep.value = 'profile'
      return
    }
    // #endif
    goHome()
  } catch {
    // stay on login
  }
})

function useRecentEmail() {
  email.value = recentEmail.value
  error.value = ''
}

function useRecentAccount() {
  account.value = recentAccount.value
  error.value = ''
}

function backToEmail() {
  step.value = 'email'
  otpCode.value = ''
  error.value = ''
}

function goPrivacy() {
  uni.navigateTo({ url: '/pages/legal/privacy' })
}

function goTerms() {
  uni.navigateTo({ url: '/pages/legal/terms' })
}

function goHome() {
  uni.switchTab({ url: '/pages/index/index' })
}

function onProfileSaved(user) {
  setCachedState(user)
  goHome()
}

async function handleWechatLogin() {
  if (!apiOnline.value) {
    error.value = '请先连接后端服务'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const state = await loginWithWechat()
    // #ifdef MP-WEIXIN
    if (state.needsProfile) {
      profileUser.value = state
      wechatStep.value = 'profile'
      return
    }
    // #endif
    goHome()
  } catch (e) {
    error.value = e.message || '微信登录失败'
  } finally {
    loading.value = false
  }
}

async function handleSendCode() {
  const addr = email.value.trim().toLowerCase()
  if (!addr) {
    error.value = '请输入邮箱'
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
    error.value = '请输入有效的邮箱地址'
    return
  }
  if (!apiOnline.value) {
    error.value = '请先连接网络服务'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await sendEmailLoginCode(addr)
    email.value = addr
    step.value = 'code'
    uni.showToast({ title: '验证码已发送', icon: 'success' })
  } catch (e) {
    error.value = e.message || '发送失败'
  } finally {
    loading.value = false
  }
}

async function handleVerifyCode() {
  const addr = email.value.trim().toLowerCase()
  const code = otpCode.value.trim()
  if (!code || code.length < 6) {
    error.value = '请输入 6 位验证码'
    return
  }
  if (!apiOnline.value) {
    error.value = '请先连接网络服务'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await loginWithEmailOtp(addr, code)
    goHome()
  } catch (e) {
    error.value = e.message || '验证码错误或已过期'
  } finally {
    loading.value = false
  }
}

async function handlePasswordSubmit() {
  const acct = account.value.trim()
  const pw = password.value
  if (!acct) {
    error.value = '请输入邮箱或手机号'
    return
  }
  if (!pw) {
    error.value = '请输入密码'
    return
  }
  if (authMode.value === 'register') {
    if (!isStrongPassword(pw)) {
      error.value = '密码至少 8 位，且须包含大写、小写字母和数字'
      return
    }
    if (pw !== passwordConfirm.value) {
      error.value = '两次输入的密码不一致'
      return
    }
    const isPhone = accountLooksLikePhone.value && /^1[3-9]\d{9}$/.test(
      acct.replace(/[\s\-()]/g, '').replace(/^\+86|^0086/, ''),
    )
    if (isPhone && !bindEmail.value.trim()) {
      error.value = '手机号注册须绑定邮箱'
      return
    }
    if (isPhone && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bindEmail.value.trim())) {
      error.value = '请输入有效的绑定邮箱'
      return
    }
    if (!isPhone && !acct.includes('@')) {
      error.value = '请输入有效的邮箱或 11 位手机号'
      return
    }
  }
  if (!apiOnline.value) {
    error.value = '请先连接网络服务'
    return
  }
  loading.value = true
  error.value = ''
  try {
    if (authMode.value === 'register') {
      const isPhone = accountLooksLikePhone.value
      await registerWithAccount({
        account: acct,
        password: pw,
        email: isPhone ? bindEmail.value.trim() : (acct.includes('@') ? acct : bindEmail.value.trim()),
      })
    } else {
      await loginWithAccount(acct, pw)
    }
    goHome()
  } catch (e) {
    error.value = e.message || (authMode.value === 'register' ? '注册失败' : '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
@import '../../styles/theme.scss';

.auth-page {
  min-height: 100vh;
  width: 100%;
  max-width: 100vw;
  overflow-x: hidden;
  background: $bg-page;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.hero {
  position: relative;
  min-height: 42vh;
  padding: 100rpx 48rpx 80rpx;
  overflow: hidden;
  background: linear-gradient(160deg, #6b0a12 0%, $primary-dark 35%, $primary 72%, #e07a3d 120%);
}

.hero-pattern {
  position: absolute;
  inset: 0;
  @include azulejo-pattern(0.12);
  opacity: 0.9;
}

.hero-glow {
  position: absolute;
  width: 420rpx;
  height: 420rpx;
  right: -80rpx;
  bottom: -120rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba($accent, 0.35) 0%, transparent 70%);
  pointer-events: none;
}

.hero-content {
  position: relative;
  z-index: 1;
}

.hero-es {
  display: block;
  font-size: 28rpx;
  letter-spacing: 4rpx;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
  margin-bottom: 16rpx;
  font-weight: 600;
}

.brand {
  display: block;
  font-size: 64rpx;
  font-weight: 800;
  color: #fff;
  letter-spacing: 2rpx;
  line-height: 1.15;
  text-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.2);
}

.tagline {
  display: block;
  margin-top: 20rpx;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.88);
  line-height: 1.5;
}

.status-row {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 36rpx;
  padding: 10rpx 20rpx;
  border-radius: $radius-full;
  @include glass-on-primary;
}

.status-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.45);

  &.on {
    background: #7dffb2;
    box-shadow: 0 0 12rpx rgba(125, 255, 178, 0.7);
  }

  &.off {
    background: #ffb4a8;
  }
}

.status-text {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.92);
}

.panel {
  flex: 1;
  width: 100%;
  margin-top: -40rpx;
  padding: 48rpx 40rpx 64rpx;
  background: $bg-page;
  border-radius: 40rpx 40rpx 0 0;
  position: relative;
  z-index: 2;
  box-shadow: 0 -12rpx 40rpx rgba(26, 26, 46, 0.06);
  box-sizing: border-box;
  overflow-x: hidden;
}

.dev-badge {
  display: inline-block;
  margin-bottom: 20rpx;
  padding: 8rpx 18rpx;
  font-size: 22rpx;
  font-weight: 600;
  color: $primary;
  background: rgba($primary, 0.08);
  border-radius: $radius-full;
}

.panel-title {
  display: block;
  font-size: 40rpx;
  font-weight: 800;
  color: $text-primary;
  letter-spacing: 1rpx;
}

.panel-desc {
  display: block;
  margin: 12rpx 0 36rpx;
  font-size: 26rpx;
  line-height: 1.65;
  color: $text-secondary;
}

.hint-line {
  display: block;
  margin: -12rpx 0 24rpx;
  font-size: 22rpx;
  line-height: 1.5;
  color: $text-muted;
}

.field {
  margin-bottom: 28rpx;
  padding: 20rpx 28rpx;
  background: #fff;
  border-radius: $radius-lg;
  border: 2rpx solid transparent;
  box-shadow: $shadow-sm;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &.focused {
    border-color: rgba($primary, 0.45);
    box-shadow: 0 0 0 6rpx rgba($primary, 0.08), $shadow-sm;
  }

  &.error {
    border-color: rgba($error, 0.55);
  }
}

.label {
  display: block;
  font-size: 22rpx;
  font-weight: 600;
  color: $text-muted;
  margin-bottom: 8rpx;
}

.input {
  width: 100%;
  height: 56rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: $text-primary;
}

.code-input {
  letter-spacing: 12rpx;
  text-align: center;
}

.wechat-tip {
  margin-bottom: 28rpx;
  padding: 20rpx 24rpx;
  background: rgba($warning, 0.1);
  border: 1rpx solid rgba($warning, 0.35);
  border-radius: $radius-md;
}

.wechat-tip-title {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  color: darken($warning, 18%);
  margin-bottom: 8rpx;
}

.wechat-tip-body {
  display: block;
  font-size: 22rpx;
  line-height: 1.6;
  color: $text-secondary;
}

.mode-tabs {
  display: flex;
  gap: 8rpx;
  margin-bottom: 28rpx;
  padding: 6rpx;
  background: rgba($primary, 0.06);
  border-radius: $radius-md;
}

.mode-tab {
  flex: 1;
  text-align: center;
  padding: 18rpx 12rpx;
  font-size: 28rpx;
  color: $text-secondary;
  border-radius: calc(#{$radius-md} - 4rpx);
  transition: all 0.2s ease;

  &.active {
    background: #fff;
    color: $primary-dark;
    font-weight: 700;
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  }
}

.quick-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin: -8rpx 0 28rpx;
  padding: 16rpx 24rpx;
  background: rgba($accent, 0.12);
  border-radius: $radius-md;
}

.quick-label {
  font-size: 22rpx;
  color: $text-muted;
}

.quick-name {
  font-size: 26rpx;
  font-weight: 700;
  color: $primary-dark;
}

.error-msg {
  display: block;
  margin-bottom: 24rpx;
  padding: 18rpx 22rpx;
  background: $error-bg;
  color: $error;
  border-radius: $radius-md;
  font-size: 26rpx;
  line-height: 1.5;
}

.switch-hint {
  margin-top: 32rpx;
  text-align: center;
  font-size: 26rpx;
  color: $text-secondary;
}

.switch-link {
  color: $primary;
  font-weight: 700;
}

.legal {
  margin-top: 40rpx;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 8rpx;
}

.legal-text,
.legal-dot {
  font-size: 22rpx;
  color: $text-muted;
}

.legal-link {
  font-size: 22rpx;
  color: $primary;
  font-weight: 600;
}

.offline-banner {
  margin: 0 32rpx 40rpx;
  padding: 20rpx 24rpx;
  background: $error-bg;
  border-radius: $radius-md;
  text-align: center;
  font-size: 26rpx;
  color: $error;
}

.animate-fade {
  animation: fade-in 0.55s ease both;
}

.animate-slide {
  animation: slide-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: 0.08s;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(12rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(48rpx); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
