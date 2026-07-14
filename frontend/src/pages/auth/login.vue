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
      <view class="mode-tabs">
        <view
          class="mode-tab"
          :class="{ active: mode === 'login' }"
          @click="switchMode('login')"
        >
          登录
        </view>
        <view
          class="mode-tab"
          :class="{ active: mode === 'register' }"
          @click="switchMode('register')"
        >
          注册
        </view>
      </view>

      <text class="panel-title">{{ mode === 'login' ? '欢迎回来' : '创建账号' }}</text>
      <text class="panel-desc">
        {{ mode === 'login'
          ? '输入你的昵称登录，继续上次的学习进度。'
          : '取一个昵称完成注册，进度会保存在云端。' }}
      </text>

      <view class="field" :class="{ focused: nickFocused, error: Boolean(error) }">
        <text class="label">昵称</text>
        <input
          v-model="nickname"
          class="input"
          type="text"
          maxlength="32"
          :placeholder="mode === 'login' ? '输入已注册的昵称' : '例如：西语同学小李'"
          confirm-type="done"
          @focus="nickFocused = true"
          @blur="nickFocused = false"
          @confirm="submit"
        />
      </view>

      <view v-if="recentNickname && mode === 'login'" class="quick-row" @click="useRecent">
        <text class="quick-label">最近使用</text>
        <text class="quick-name">{{ recentNickname }}</text>
      </view>

      <view v-if="error" class="error-msg">{{ error }}</view>

      <AppButton
        block
        :loading="loading"
        :disabled="!apiOnline || !nickname.trim()"
        @click="submit"
      >
        {{ mode === 'login' ? '进入学习 →' : '注册并开始 →' }}
      </AppButton>

      <view class="switch-hint" @click="switchMode(mode === 'login' ? 'register' : 'login')">
        <text v-if="mode === 'login'">还没有账号？</text>
        <text v-else>已有账号？</text>
        <text class="switch-link">{{ mode === 'login' ? '去注册' : '去登录' }}</text>
      </view>
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
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import {
  checkApiOnline,
  getLastNickname,
  getUserState,
  isLoggedIn,
  loginWithNickname,
  loginWithWechat,
  registerWithNickname,
  setCachedState,
} from '../../utils/userService.js'

const nickname = ref('')
const recentNickname = ref(getLastNickname())
const mode = ref('login')
const loading = ref(false)
const error = ref('')
const apiOnline = ref(false)
const checkedOnline = ref(false)
const nickFocused = ref(false)
const wechatStep = ref('login')
const profileUser = ref({ nickname: '', avatarUrl: '' })

onShow(async () => {
  recentNickname.value = getLastNickname()
  if (!nickname.value && recentNickname.value && mode.value === 'login') {
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

function switchMode(next) {
  if (mode.value === next) return
  mode.value = next
  error.value = ''
  if (next === 'login' && recentNickname.value && !nickname.value.trim()) {
    nickname.value = recentNickname.value
  }
  if (next === 'register') {
    nickname.value = ''
  }
}

function useRecent() {
  nickname.value = recentNickname.value
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

async function submit() {
  if (mode.value === 'login') {
    await handleLogin()
  } else {
    await handleRegister()
  }
}

async function handleLogin() {
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
    await loginWithNickname(name)
    goHome()
  } catch (e) {
    error.value = e.message || '登录失败，昵称可能尚未注册'
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  const name = nickname.value.trim()
  if (!name) {
    error.value = '请输入昵称'
    return
  }
  if (name.length < 2) {
    error.value = '昵称至少 2 个字符'
    return
  }
  if (!apiOnline.value) {
    error.value = '请先连接网络服务'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await registerWithNickname(name)
    goHome()
  } catch (e) {
    error.value = e.message || '注册失败，该昵称可能已被使用'
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

.mode-tabs {
  display: flex;
  gap: 8rpx;
  padding: 8rpx;
  margin-bottom: 36rpx;
  background: $bg-muted;
  border-radius: $radius-full;
}

.mode-tab {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  font-size: 28rpx;
  font-weight: 600;
  color: $text-muted;
  border-radius: $radius-full;
  transition: all 0.2s ease;

  &.active {
    background: #fff;
    color: $primary;
    box-shadow: $shadow-sm;
  }
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
  margin-left: 8rpx;
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
