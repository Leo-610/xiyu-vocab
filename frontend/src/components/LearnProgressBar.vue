<template>
  <view class="learn-progress">
    <view class="track">
      <view class="fill" :style="{ width: percent + '%' }" />
    </view>
    <view class="meta">
      <text class="count">第 {{ current }} / {{ total }} 词</text>
      <DeleBadge v-if="level" :level="level" sm active />
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import DeleBadge from './DeleBadge.vue'

const props = defineProps({
  current: { type: Number, default: 1 },
  total: { type: Number, default: 10 },
  level: { type: String, default: '' },
})

const percent = computed(() => {
  if (!props.total) return 0
  return Math.round((props.current / props.total) * 100)
})
</script>

<style lang="scss" scoped>
@import '../styles/theme.scss';

.learn-progress {
  margin-bottom: 24rpx;
}

.track {
  height: 8rpx;
  background: $bg-muted;
  border-radius: $radius-full;
  overflow: hidden;
}

.fill {
  height: 100%;
  background: linear-gradient(90deg, $primary, $accent);
  border-radius: $radius-full;
  transition: width 0.35s ease;
}

.meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16rpx;
}

.count {
  font-size: 26rpx;
  color: $text-secondary;
  font-weight: 500;
}
</style>
