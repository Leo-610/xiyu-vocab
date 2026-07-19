<template>
  <view class="consent-page">
    <view class="consent-card animate-pop">
      <text class="logo">西语背单词</text>
      <text class="subtitle">DELE 分级识记 · 用户隐私保护提示</text>

      <view class="body">
        <text class="p">
          欢迎使用「{{ appName }}」。我们重视您的个人信息保护。使用前请阅读并同意：
        </text>
        <view class="link-row">
          <text class="link" @click="openTerms">《用户协议》</text>
          <text class="dot">与</text>
          <text class="link" @click="openPrivacy">《隐私政策》</text>
        </view>
        <text class="p muted">
          我们将采集微信 openid 与学习进度，用于同步个人数据，不采集手机号等敏感信息。详情见隐私政策。
        </text>
      </view>

      <view class="actions">
        <AppButton block @click="onAgree">同意并继续</AppButton>
        <AppButton block variant="outline" class="mt-btn" @click="onDecline">不同意</AppButton>
      </view>
    </view>
  </view>
</template>

<script setup>
import { APP_CONFIG } from '../../config/app.js'
import { setPrivacyAgreed, declinePrivacy } from '../../utils/privacy.js'
import { safeNavigateTo, safeReLaunch } from '../../utils/nav.js'

const appName = APP_CONFIG.name

function openPrivacy() {
  safeNavigateTo('/pages/legal/privacy')
}

function openTerms() {
  safeNavigateTo('/pages/legal/terms')
}

function onAgree() {
  setPrivacyAgreed()
  safeReLaunch('/pages/auth/login')
}

function onDecline() {
  declinePrivacy()
}
</script>

<style lang="scss" scoped>
@import '../../styles/theme.scss';

.consent-page {
  min-height: 100vh;
  background: linear-gradient(165deg, $primary-dark 0%, $primary 45%, $bg-page 45%);
  padding: 120rpx 32rpx 48rpx;
  box-sizing: border-box;
}

.consent-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: 48rpx 40rpx;
  box-shadow: $shadow-lg;
}

.logo {
  display: block;
  font-size: 44rpx;
  font-weight: 800;
  color: $primary;
}

.subtitle {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: $text-secondary;
}

.body {
  margin-top: 40rpx;
}

.p {
  display: block;
  font-size: 28rpx;
  line-height: 1.75;
  color: $text-primary;

  &.muted {
    margin-top: 24rpx;
    font-size: 26rpx;
    color: $text-secondary;
  }
}

.link-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 20rpx 0 8rpx;
  gap: 8rpx;
}

.link {
  font-size: 28rpx;
  font-weight: 600;
  color: $primary;
}

.dot {
  font-size: 28rpx;
  color: $text-secondary;
}

.actions {
  margin-top: 48rpx;
}

.mt-btn {
  margin-top: 20rpx;
}
</style>
