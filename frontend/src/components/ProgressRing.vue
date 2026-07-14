<template>
  <view class="progress-ring" :style="{ width: sizeRpx, height: sizeRpx }">
    <view class="ring-bg" />
    <view class="ring-fill" :style="ringStyle" />
    <view class="ring-center">
      <text class="ring-value">{{ displayValue }}</text>
      <text v-if="label" class="ring-label">{{ label }}</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  percent: { type: Number, default: 0 },
  value: { type: [Number, String], default: null },
  label: { type: String, default: '' },
  size: { type: Number, default: 160 },
  color: { type: String, default: '#C1121F' },
  trackColor: { type: String, default: 'rgba(255,255,255,0.25)' },
})

const sizeRpx = computed(() => `${props.size}rpx`)

const displayValue = computed(() => {
  if (props.value !== null && props.value !== undefined) return props.value
  return `${Math.min(100, Math.max(0, props.percent))}%`
})

const ringStyle = computed(() => {
  const p = Math.min(100, Math.max(0, props.percent))
  return {
    background: `conic-gradient(${props.color} ${p * 3.6}deg, ${props.trackColor} ${p * 3.6}deg)`,
  }
})
</script>

<style lang="scss" scoped>
.progress-ring {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ring-bg,
.ring-fill {
  position: absolute;
  inset: 0;
  border-radius: 50%;
}

.ring-fill {
  mask: radial-gradient(transparent 58%, #000 59%);
  -webkit-mask: radial-gradient(transparent 58%, #000 59%);
}

.ring-center {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.ring-value {
  font-size: 44rpx;
  font-weight: 800;
  line-height: 1.1;
}

.ring-label {
  font-size: 22rpx;
  opacity: 0.85;
  margin-top: 4rpx;
}
</style>
