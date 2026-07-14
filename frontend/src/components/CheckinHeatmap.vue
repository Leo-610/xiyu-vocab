<template>
  <view class="heatmap">
    <text class="hm-title">打卡日历</text>
    <view class="hm-grid">
      <view
        v-for="(day, i) in days"
        :key="i"
        class="hm-cell"
        :class="'lv-' + level(day.count)"
        :title="day.date"
      />
    </view>
    <view class="hm-legend">
      <text>少</text>
      <view class="hm-cell lv-0" />
      <view class="hm-cell lv-1" />
      <view class="hm-cell lv-2" />
      <view class="hm-cell lv-3" />
      <text>多</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  checkins: { type: Array, default: () => [] },
})

const days = computed(() => props.checkins.slice(-35))

function level(count) {
  if (!count) return 0
  if (count < 5) return 1
  if (count < 10) return 2
  return 3
}
</script>

<style lang="scss" scoped>
@import '../styles/theme.scss';

.heatmap {
  margin-top: 8rpx;
}

.hm-title {
  font-size: 24rpx;
  color: $text-muted;
  display: block;
  margin-bottom: 16rpx;
}

.hm-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6rpx;
}

.hm-cell {
  width: 28rpx;
  height: 28rpx;
  border-radius: 6rpx;
  background: $bg-muted;

  &.lv-1 { background: rgba($primary, 0.25); }
  &.lv-2 { background: rgba($primary, 0.55); }
  &.lv-3 { background: $primary; }
}

.hm-legend {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 16rpx;
  font-size: 20rpx;
  color: $text-muted;
}
</style>
