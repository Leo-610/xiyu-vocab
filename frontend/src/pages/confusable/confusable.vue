<template>
  <view class="container">
    <AppCard>
      <text class="page-title">易混词辨析</text>
      <text class="page-sub">西语高频易混对 · 用法口诀与例句</text>
    </AppCard>

    <view v-if="loading"><AppCard><text class="skeleton-pulse">加载...</text></AppCard></view>

    <view v-else-if="pairs.length === 0">
      <AppCard><text>暂无易混词对</text></AppCard>
    </view>

    <AppCard v-for="p in pairs" :key="p.id" class="pair-card">
      <view class="pair-head">
        <text class="lemma-a">{{ p.lemmaA }}</text>
        <text class="vs">vs</text>
        <text class="lemma-b">{{ p.lemmaB }}</text>
      </view>
      <view class="meanings">
        <text>{{ p.meaningA }}</text>
        <text class="dot">·</text>
        <text>{{ p.meaningB }}</text>
      </view>
      <view v-if="p.content_status === 'pending'" class="pending-box">
        <text class="pending-label">📝 辨析待补充</text>
        <text class="pending-text">{{ p.note_zh }}</text>
      </view>
      <view v-else class="note-box">
        <text>{{ p.note_zh }}</text>
      </view>
    </AppCard>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { fetchConfusables } from '../../utils/userService.js'

const loading = ref(true)
const pairs = ref([])

onMounted(async () => {
  try {
    pairs.value = await fetchConfusables()
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
@import '../../styles/theme.scss';

.page-title { font-size: 40rpx; font-weight: 800; display: block; }
.page-sub { font-size: 24rpx; color: $text-muted; display: block; margin-top: 8rpx; }

.pair-head {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 12rpx;
}

.lemma-a, .lemma-b {
  font-size: 36rpx;
  font-weight: 700;
  color: $primary;
}

.vs {
  font-size: 24rpx;
  color: $text-muted;
}

.meanings {
  font-size: 26rpx;
  color: $text-secondary;
  margin-bottom: 16rpx;
}

.dot { margin: 0 8rpx; }

.pending-box {
  background: rgba($accent, 0.15);
  border-radius: $radius-md;
  padding: 20rpx;
  border: 1rpx dashed rgba($primary, 0.3);
}

.pending-label {
  font-size: 24rpx;
  font-weight: 600;
  color: $primary;
  display: block;
}

.pending-text {
  font-size: 24rpx;
  color: $text-muted;
  display: block;
  margin-top: 8rpx;
}

.note-box {
  background: $bg-muted;
  padding: 20rpx;
  border-radius: $radius-md;
  font-size: 26rpx;
  line-height: 1.7;
  white-space: pre-wrap;
}
</style>
