<template>
  <view class="container legal">
    <AppCard>
      <text class="title">隐私政策</text>
      <text class="updated">版本 {{ privacyVersion }} · {{ orgName }}</text>
      <view class="section" v-for="(s, i) in sections" :key="i">
        <text class="h">{{ s.title }}</text>
        <text class="p">{{ s.body }}</text>
      </view>
      <text class="footer">如有疑问请联系：{{ contactEmail }}</text>
    </AppCard>
  </view>
</template>

<script setup>
import { APP_CONFIG } from '../../config/app.js'

const { orgName, contactEmail, privacyVersion } = APP_CONFIG

const sections = [
  { title: '1. 采集信息', body: '我们仅采集微信 openid、昵称（可选）与学习进度数据，不采集手机号、位置、通讯录等敏感信息。' },
  { title: '2. 信息用途', body: '用于同步个人学习记录、统计打卡与错题本，不用于商业推销或向第三方出售。' },
  { title: '3. 信息存储', body: '数据存储于境内服务器，采用 HTTPS 传输与定期备份。' },
  { title: '4. 用户权利', body: '您可通过联系邮箱申请导出或删除个人学习数据，我们将在合理期限内处理。' },
  { title: '5. 联系我们', body: `运营主体：${orgName}。联系邮箱：${contactEmail}。` },
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
