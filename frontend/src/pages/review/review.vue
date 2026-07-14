<template>
  <view class="container">
    <AppCard class="header-card hero-review">
      <view class="header-row">
        <view>
          <text class="page-title">错题本</text>
          <text class="page-sub">Focus · 间隔复习重点词</text>
        </view>
        <view class="count-badge">{{ mistakes.length }}</view>
      </view>
    </AppCard>

    <view v-if="loading">
      <AppCard><text class="skeleton-pulse">加载中...</text></AppCard>
    </view>

    <view v-else-if="mistakes.length === 0" class="empty-wrap">
      <AppCard>
        <text class="empty-emoji">✨</text>
        <text class="empty-title">零错题，太棒了！</text>
        <text class="empty-sub">继续保持，西语词汇在进步</text>
        <AppButton block @click="goLearn">去学习</AppButton>
      </AppCard>
    </view>

    <view v-else class="list">
      <AppCard
        v-for="item in mistakes"
        :key="item.wordId"
        class="mistake-item"
        :style="{ '--level-color': levelColor(item.level) }"
      >
        <view class="level-bar" />
        <view class="item-body">
          <view class="item-top">
            <text class="lemma">{{ item.lemma }}</text>
            <DeleBadge :level="item.level" sm active />
          </view>
          <text class="meaning">{{ item.meaning_zh }}</text>
          <text class="time">{{ formatTime(item.wrongAt) }}</text>
          <view v-if="item.example_es" class="example-box">
            <text class="ex-es">{{ item.example_es }}</text>
            <text v-if="item.example_zh" class="ex-zh">{{ item.example_zh }}</text>
          </view>
        </view>
      </AppCard>
    </view>

    <AppCard v-if="!loading && mistakes.length > 0" variant="flat">
      <AppButton block @click="startReview">开始错题复习</AppButton>
      <text class="tip-text">💡 SM-2 到期复习已并入「今日学习」</text>
    </AppCard>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { ensureAuth, fetchMistakes } from '../../utils/userService.js'

const COLORS = { A1: '#2A9D8F', A2: '#43AA8B', B1: '#F4A261', B2: '#E76F51', C1: '#9B5DE5', C2: '#C1121F' }

const loading = ref(true)
const mistakes = ref([])

onShow(async () => {
  loading.value = true
  try {
    await ensureAuth()
    mistakes.value = await fetchMistakes()
  } catch (e) {
    uni.showToast({ title: e.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
})

function levelColor(lv) {
  return COLORS[lv] || '#C1121F'
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'))
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function goLearn() {
  uni.switchTab({ url: '/pages/learn/learn' })
}

function startReview() {
  uni.navigateTo({ url: '/pages/review-session/review-session' })
}
</script>

<style lang="scss" scoped>
@import '../../styles/theme.scss';

.hero-review {
  background: linear-gradient(135deg, rgba($primary, 0.06), rgba($accent, 0.12));
  border: 1rpx solid rgba($primary, 0.08);
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-title {
  font-size: 40rpx;
  font-weight: 800;
  display: block;
}

.page-sub {
  font-size: 24rpx;
  color: $text-muted;
  display: block;
  margin-top: 4rpx;
}

.count-badge {
  min-width: 64rpx;
  height: 64rpx;
  padding: 0 20rpx;
  border-radius: $radius-full;
  background: rgba($primary, 0.1);
  color: $primary;
  font-size: 32rpx;
  font-weight: 800;
  @include flex-center;
}

.empty-wrap {
  text-align: center;
}

.empty-emoji {
  font-size: 80rpx;
  display: block;
}

.empty-title {
  font-size: 34rpx;
  font-weight: 700;
  display: block;
  margin: 20rpx 0 8rpx;
}

.empty-sub {
  font-size: 26rpx;
  color: $text-secondary;
  display: block;
  margin-bottom: 32rpx;
}

.mistake-item {
  position: relative;
  padding-left: 24rpx !important;
  overflow: hidden;
}

.level-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 8rpx;
  background: var(--level-color, $primary);
  border-radius: 8rpx 0 0 8rpx;
}

.item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.lemma {
  font-size: 40rpx;
  font-weight: 700;
}

.meaning {
  font-size: 28rpx;
  color: $text-secondary;
  display: block;
  margin-top: 8rpx;
}

.time {
  font-size: 22rpx;
  color: $text-muted;
  display: block;
  margin-top: 12rpx;
}

.example-box {
  margin-top: 16rpx;
  padding: 16rpx 20rpx;
  background: $bg-muted;
  border-radius: $radius-md;
}

.ex-es {
  font-size: 26rpx;
  font-style: italic;
  display: block;
}

.ex-zh {
  font-size: 24rpx;
  color: $text-muted;
  display: block;
  margin-top: 6rpx;
}

.tip-text {
  font-size: 24rpx;
  color: $text-muted;
  display: block;
  margin-top: 16rpx;
  text-align: center;
}
</style>
