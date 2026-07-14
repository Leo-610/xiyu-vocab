<template>
  <AppCard v-if="status && showBanner" variant="flat" class="team-banner">
    <view class="banner-head">
      <text class="banner-title">📋 内容组进度</text>
      <text class="banner-pct">{{ overallPct }}%</text>
    </view>
    <view class="bar-track">
      <view class="bar-fill" :style="{ width: overallPct + '%' }" />
    </view>
    <text class="banner-hint">
      词库 {{ status.wordsTotal }}/{{ status.targetTotal }} ·
      配图待补 {{ status.gaps?.images }} ·
      变位待补 {{ status.gaps?.conjugations }}
    </text>
    <text class="banner-note">西语同学 CSV/配图交付后自动更新 · 管理台 → /admin</text>
  </AppCard>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getContentStatus } from '../utils/api.js'
import { APP_CONFIG } from '../config/app.js'

const status = ref(null)
const showBanner = APP_CONFIG.showDevBanner !== false

const overallPct = computed(() => {
  if (!status.value) return 0
  return Math.min(100, Math.round((status.value.wordsTotal / status.value.targetTotal) * 100))
})

onMounted(async () => {
  try {
    status.value = await getContentStatus()
  } catch { /* offline */ }
})
</script>

<style lang="scss" scoped>
@import '../styles/theme.scss';

.team-banner {
  border: 1rpx dashed rgba($primary, 0.25) !important;
  background: rgba($accent, 0.08) !important;
}

.banner-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.banner-title {
  font-size: 28rpx;
  font-weight: 600;
}

.banner-pct {
  font-size: 32rpx;
  font-weight: 800;
  color: $primary;
}

.bar-track {
  height: 10rpx;
  background: rgba($primary, 0.1);
  border-radius: $radius-full;
  margin: 16rpx 0;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, $primary, $accent);
  border-radius: $radius-full;
}

.banner-hint, .banner-note {
  font-size: 22rpx;
  color: $text-muted;
  display: block;
  line-height: 1.6;
}

.banner-note {
  margin-top: 8rpx;
  font-style: italic;
}
</style>
