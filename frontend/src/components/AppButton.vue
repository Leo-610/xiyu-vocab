<template>
  <!-- #ifdef MP-WEIXIN -->
  <view
    class="app-btn"
    :class="[variant, size, { block, disabled: disabled || loading }]"
    @click="onClick"
  >
    <text v-if="loading" class="btn-loading">···</text>
    <slot v-else />
  </view>
  <!-- #endif -->
  <!-- #ifndef MP-WEIXIN -->
  <button
    type="button"
    class="app-btn"
    :class="[variant, size, { block, disabled: disabled || loading }]"
    :disabled="disabled || loading"
    @click="onClick"
  >
    <text v-if="loading" class="btn-loading">···</text>
    <slot v-else />
  </button>
  <!-- #endif -->
</template>

<script setup>
const props = defineProps({
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
  block: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['click'])

function onClick(e) {
  if (props.disabled || props.loading) return
  if (e?.preventDefault) e.preventDefault()
  emit('click', e)
}
</script>

<style lang="scss" scoped>
@import '../styles/theme.scss';

.app-btn {
  box-sizing: border-box;
  max-width: 100%;
  border: none;
  font-weight: 600;
  line-height: 1.4;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;

  &::after {
    border: none;
  }

  &.block {
    width: 100%;
    display: flex;
  }

  &.md {
    font-size: 32rpx;
    padding: 28rpx 48rpx;
    border-radius: $radius-full;
  }

  &.sm {
    font-size: 26rpx;
    padding: 16rpx 32rpx;
    border-radius: $radius-full;
  }

  &.primary {
    background: linear-gradient(135deg, $primary-light, $primary);
    color: #fff;
    box-shadow: 0 8rpx 24rpx rgba($primary, 0.35);
  }

  &.outline {
    background: $bg-card;
    color: $primary;
    border: 2rpx solid rgba($primary, 0.35) !important;
    box-shadow: none;
  }

  &.ghost {
    background: rgba($primary, 0.08);
    color: $primary;
    box-shadow: none;
  }

  &.success {
    background: linear-gradient(135deg, #3db5a8, $success);
    color: #fff;
    box-shadow: 0 8rpx 24rpx rgba($success, 0.3);
  }

  &.disabled {
    opacity: 0.45;
    box-shadow: none;
  }
}

.btn-loading {
  letter-spacing: 4rpx;
}
</style>
