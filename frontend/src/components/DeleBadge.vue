<template>
  <view
    class="dele-badge"
    :class="{ active, sm }"
    :style="{ '--level-color': color }"
    @click="$emit('click')"
  >
    <text class="badge-text">{{ level }}</text>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  level: { type: String, required: true },
  active: { type: Boolean, default: false },
  sm: { type: Boolean, default: false },
})

const COLORS = {
  A1: '#1a7a6f', A2: '#2d8f6e', B1: '#c97d2e',
  B2: '#c44f35', C1: '#7a3fbf', C2: '#9b0f18',
}

const color = computed(() => COLORS[props.level] || '#C1121F')

defineEmits(['click'])
</script>

<style lang="scss" scoped>
@import '../styles/theme.scss';

.dele-badge {
  --level-color: #c1121f;
  padding: 18rpx 36rpx;
  border-radius: 999rpx;
  background: $bg-muted;
  border: 2rpx solid rgba(26, 26, 46, 0.12);
  transition: all 0.2s ease;

  &.sm {
    padding: 6rpx 16rpx;
  }

  &.active {
    background: var(--level-color);
    border-color: var(--level-color);
    box-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.12);
  }
}

.badge-text {
  font-size: 28rpx;
  font-weight: 800;
  color: var(--level-color);

  .sm & {
    font-size: 22rpx;
  }

  .active & {
    color: #fff;
  }
}
</style>
