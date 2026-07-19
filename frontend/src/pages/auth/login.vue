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
      <template v-if="emailAuthEnabled">
        <template v-if="step === 'email'">
          <text class="panel-title">邮箱登录</text>
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

      <template v-else-if="passwordAuthEnabled">
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
            ? '使用昵称和密码登录，学习进度将保存在云端。'
            : '设置昵称与密码完成注册，之后可用同一账号继续学习。' }}
        </text>

        <view class="field" :class="{ focused: nickFocused, error: Boolean(error) }">
          <text class="label">昵称</text>
          <input
            v-model="nickname"
            class="input"
            type="text"
            maxlength="32"
            :placeholder="authMode === 'login' ? '已注册的昵称' : '2–32 个字符'"
            confirm-type="next"
            @focus="nickFocused = true"
            @blur="nickFocused = false"
          />
        </view>

        <view class="field" :class="{ focused: passFocused, error: Boolean(error) }">
          <text class="label">密码</text>
          <input
            v-model="password"
            class="input"
            password
            maxlength="64"
            :placeholder="authMode === 'login' ? '输入密码' : '至少 6 位'"
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

        <view v-if="recentNickname && authMode === 'login'" class="quick-row" @click="useRecent">
          <text class="quick-label">最近使用</text>
          <text class="quick-name">{{ recentNickname }}</text>
        </view>

        <view v-if="error" class="error-msg">{{ error }}</view>

        <AppButton
          block
          :loading="loading"
          :disabled="!apiOnline || !nickname.trim() || !password"
          @click="handlePasswordSubmit"
        >
          {{ authMode === 'login' ? '登录并进入 →' : '注册并开始 →' }}
        </AppButton>

        <view class="switch-hint" @click="switchAuthMode(authMode === 'login' ? 'register' : 'login')">
          <text v-if="authMode === 'login'">还没有账号？</text>
          <text v-else>已有账号？</text>
          <text class="switch-link">{{ authMode === 'login' ? '去注册' : '去登录' }}</text>
        </view>
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
  getLastEmail,
  getLastNickname,
  getUserState,
  isLoggedIn,
  loginWithEmailOtp,
  loginWithNickname,
  loginWithWechat,
  registerWithNickname,
  sendEmailLoginCode,
  setCachedState,
} from '../../utils/userService.js'

const email = ref('')
const otpCode = ref('')
const step = ref('email')
const authMode = ref('login')
const nickname = ref('')
const password = ref('')
const passwordConfirm = ref('')
const recentEmail = ref(getLastEmail())
const recentNickname = ref(getLastNickname())
const loading = ref(false)
const error = ref('')
const apiOnline = ref(false)
const checkedOnline = ref(false)
const emailFocused = ref(false)
const codeFocused = ref(false)
const nickFocused = ref(false)
const passFocused = ref(false)
const pass2Focused = ref(false)
const wechatStep = ref('login')
const profileUser = ref({ nickname: '', avatarUrl: '' })

const emailAuthEnabled = computed(() => getAuthConfig().email)
const passwordAuthEnabled = computed(() => !emailAuthEnabled.value && getAuthConfig().password !== false)

function switchAuthMode(mode) {
  authMode.value = mode
  error.value = ''
  password.value = ''
  passwordConfirm.value = ''
}

onShow(async () => {
  recentEmail.value = getLastEmail()
  recentNickname.value = getLastNickname()
  if (!email.value && recentEmail.value) {
    email.value = recentEmail.value
  }
  if (!nickname.value && recentNickname.value) {
    nickname.value = recentNickname.value
  }

  apiOnline.value = await checkApiOnline()
  checkedOnline.value = true

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

function useRecent() {
  nickname.value = recentNickname.value
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
  const name = nickname.value.trim()
  const pw = password.value
  if (!name) {
    error.value = '请输入昵称'
    return
  }
  if (name.length < 2) {
    error.value = '昵称至少 2 个字符'
    return
  }
  if (!pw) {
    error.value = '请输入密码'
    return
  }
  if (pw.length < 6) {
    error.value = '密码至少 6 位'
    return
  }
  if (authMode.value === 'register') {
    if (pw !== passwordConfirm.value) {
      error.value = '两次输入的密码不一致'
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
      await registerWithNickname(name, pw)
    } else {
      await loginWithNickname(name, pw)
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
  background: $bg-page;
  display: flex;
  flex-direction: column;
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
  margin-top: -40rpx;
  padding: 48rpx 40rpx 64rpx;
  background: $bg-page;
  border-radius: 40rpx 40rpx 0 0;
  position: relative;
  z-index: 2;
  box-shadow: 0 -12rpx 40rpx rgba(26, 26, 46, 0.06);
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
