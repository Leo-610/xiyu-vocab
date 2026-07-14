<template>
  <view class="auth-page">
    <view class="auth-bg" />
    <view class="auth-header">
      <text class="brand">西语背单词</text>
      <text class="tagline">DELE 分级识记 · 个人学习工具</text>
    </view>

    <AppCard class="auth-card animate-pop">
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
        <text class="card-title">微信登录</text>
        <text class="card-desc">使用微信身份同步学习进度，数据保存在云端。</text>
        <view v-if="error" class="error-msg">{{ error }}</view>
        <AppButton block :loading="loading" @click="handleWechatLogin">
          微信一键登录
        </AppButton>
      </template>
      <!-- #endif -->

      <!-- #ifndef MP-WEIXIN -->
      <text class="card-title">演示账号</text>
      <text class="card-desc">H5 答辩演示环境：注册昵称后即可保存学习进度（非微信 openid）。</text>

      <view class="field">
        <text class="label">昵称</text>
        <input
          v-model="nickname"
          class="input"
          type="text"
          maxlength="32"
          placeholder="例如：西语2024张三"
          confirm-type="done"
          @confirm="handleLogin"
        />
      </view>

      <view v-if="error" class="error-msg">{{ error }}</view>

      <AppButton block :loading="loading" @click="handleLogin">登录</AppButton>
      <AppButton block variant="outline" class="mt-btn" :loading="loading" @click="handleRegister">
        注册新账号
      </AppButton>
      <!-- #endif -->

      <view v-if="wechatStep !== 'profile'" class="tips">
        <text class="tip-line">登录即表示同意</text>
        <view class="tip-links">
          <text class="link" @click="goTerms">《用户协议》</text>
          <text class="dot">·</text>
          <text class="link" @click="goPrivacy">《隐私政策》</text>
        </view>
      </view>
    </AppCard>

    <view v-if="!apiOnline && checkedOnline && wechatStep !== 'profile'" class="offline-banner">
      <text>后端未连接，请启动 API 后再登录</text>
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

const nickname = ref(getLastNickname())
const loading = ref(false)
const error = ref('')
const apiOnline = ref(false)
const checkedOnline = ref(false)
const wechatStep = ref('login')
const profileUser = ref({ nickname: '', avatarUrl: '' })

onShow(async () => {
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

async function handleLogin() {
  const name = nickname.value.trim()
  if (!name) {
    error.value = '请输入昵称'
    return
  }
  if (!apiOnline.value) {
    error.value = '请先连接后端服务'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await loginWithNickname(name)
    goHome()
  } catch (e) {
    error.value = e.message || '登录失败'
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
  if (!apiOnline.value) {
    error.value = '请先连接后端服务'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await registerWithNickname(name)
    goHome()
  } catch (e) {
    error.value = e.message || '注册失败'
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
  padding-bottom: 48rpx;
  position: relative;
}

.auth-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 420rpx;
  background: linear-gradient(165deg, $primary-dark, $primary 55%, $primary-light);
  @include azulejo-pattern(0.1);
}

.auth-header {
  position: relative;
  z-index: 1;
  padding: 120rpx 40rpx 100rpx;
  text-align: center;
}

.brand {
  display: block;
  font-size: 48rpx;
  font-weight: 800;
  color: #fff;
}

.tagline {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.85);
}

.auth-card {
  margin: -48rpx 32rpx 0;
  position: relative;
  z-index: 1;
}

.card-title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: $text-primary;
}

.card-desc {
  display: block;
  margin: 12rpx 0 32rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: $text-secondary;
}

.field {
  margin-bottom: 24rpx;
}

.label {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: $text-secondary;
  margin-bottom: 12rpx;
}

.input {
  width: 100%;
  height: 88rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
  background: $bg-muted;
  border-radius: $radius-md;
  font-size: 30rpx;
  color: $text-primary;
}

.error-msg {
  display: block;
  margin-bottom: 20rpx;
  padding: 16rpx 20rpx;
  background: $error-bg;
  color: $error;
  border-radius: $radius-sm;
  font-size: 26rpx;
}

.mt-btn {
  margin-top: 20rpx;
}

.tips {
  margin-top: 32rpx;
  text-align: center;
}

.tip-line {
  display: block;
  font-size: 24rpx;
  color: $text-muted;
}

.tip-links {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8rpx;
  margin-top: 8rpx;
}

.link {
  font-size: 24rpx;
  color: $primary;
}

.dot {
  font-size: 24rpx;
  color: $text-muted;
}

.offline-banner {
  margin: 24rpx 32rpx 0;
  padding: 20rpx;
  background: $error-bg;
  border-radius: $radius-md;
  text-align: center;
  font-size: 26rpx;
  color: $error;
}
</style>
