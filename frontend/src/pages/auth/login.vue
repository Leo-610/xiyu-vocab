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

      <template v-else-if="demoAuthEnabled">
        <view class="dev-badge">开发演示模式</view>
        <text class="panel-title">昵称登录</text>
        <text class="panel-desc">邮箱服务未配置时使用。生产环境请配置 Resend 邮箱验证码登录。</text>

        <view class="field" :class="{ focused: nickFocused, error: Boolean(error) }">
          <text class="label">昵称</text>
          <input
            v-model="nickname"
            class="input"
            type="text"
            maxlength="32"
            placeholder="输入昵称登录或注册"
            confirm-type="done"
            @focus="nickFocused = true"
            @blur="nickFocused = false"
            @confirm="handleDemoSubmit"
          />
        </view>

        <view v-if="recentNickname" class="quick-row" @click="useRecent">
          <text class="quick-label">最近使用</text>
          <text class="quick-name">{{ recentNickname }}</text>
        </view>

        <view v-if="error" class="error-msg">{{ error }}</view>

        <AppButton
          block
          :loading="loading"
          :disabled="!apiOnline || !nickname.trim()"
          @click="handleDemoSubmit"
        >
          进入学习 →
        </AppButton>
      </template>

      <template v-else>
        <text class="panel-title">登录暂不可用</text>
        <text class="panel-desc">请配置邮箱验证码服务（AUTH_RESEND_KEY），或联系管理员开启演示登录。</text>
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
const nickname = ref('')
const recentEmail = ref(getLastEmail())
const recentNickname = ref(getLastNickname())
const loading = ref(false)
const error = ref('')
const apiOnline = ref(false)
const checkedOnline = ref(false)
const emailFocused = ref(false)
const codeFocused = ref(false)
const nickFocused = ref(false)
const wechatStep = ref('login')
const profileUser = ref({ nickname: '', avatarUrl: '' })

const emailAuthEnabled = computed(() => getAuthConfig().email)
const demoAuthEnabled = computed(() => !emailAuthEnabled.value && getAuthConfig().demoLogin)

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

async function handleDemoSubmit() {
  const name = nickname.value.trim()
  if (!name) {
    error.value = '请输入昵称'
    return
  }
  if (!apiOnline.value) {
    error.value = '请先连接网络服务'
    return
  }
  loading.value = true
  error.value = ''
  try {
    if (name.length >= 2) {
      try {
        await loginWithNickname(name)
        goHome()
        return
      } catch {
        await registerWithNickname(name)
        goHome()
        return
      }
    }
    await loginWithNickname(name)
    goHome()
  } catch (e) {
    error.value = e.message || '登录失败'
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
