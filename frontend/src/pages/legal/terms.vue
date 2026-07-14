<template>
  <view class="container legal">
    <AppCard>
      <text class="title">用户协议</text>
      <text class="updated">版本 {{ privacyVersion }} · {{ orgName }}</text>
      <view class="section" v-for="(s, i) in sections" :key="i">
        <text class="h">{{ s.title }}</text>
        <text class="p">{{ s.body }}</text>
      </view>
      <text class="footer">联系邮箱：{{ contactEmail }}</text>
    </AppCard>
  </view>
</template>

<script setup>
import { APP_CONFIG } from '../../config/app.js'

const { orgName, contactEmail, privacyVersion } = APP_CONFIG

const sections = [
  { title: '1. 服务说明', body: `本应用「${APP_CONFIG.name}」为西班牙语 DELE 分级背单词学习工具，由 ${orgName} 项目组维护。` },
  { title: '2. 内容版权', body: '词库、配图版权归项目组所有；用户不得擅自爬取、复制或用于商业用途。' },
  { title: '3. 免责声明', body: '学习内容仅供参考，不保证与官方 DELE 考试完全一致，不作任何过级承诺。' },
  { title: '4. 协议变更', body: '我们可能更新本协议，重大变更将通过 App 内通知；继续使用即视为接受更新。' },
]
</script>

<style lang="scss" scoped>
@import '../../styles/theme.scss';
.title { font-size: 40rpx; font-weight: 800; display: block; }
.updated { font-size: 24rpx; color: $text-muted; display: block; margin: 8rpx 0 24rpx; }
.h { font-size: 30rpx; font-weight: 600; display: block; margin: 20rpx 0 8rpx; }
.p { font-size: 28rpx; color: $text-secondary; line-height: 1.7; display: block; }
.footer { font-size: 24rpx; color: $text-muted; margin-top: 32rpx; display: block; }
</style>
