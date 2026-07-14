<template>
  <view class="app-card" :class="[variant, { 'no-padding': noPadding }]" @click="$emit('click')">
    <slot />
  </view>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'default' },
  noPadding: { type: Boolean, default: false },
})
defineEmits(['click'])
</script>

<style lang="scss" scoped>
@import '../styles/theme.scss';

.app-card {
  @include card-base;
  padding: 32rpx;
  margin-bottom: 24rpx;

  &.no-padding {
    padding: 0;
    overflow: hidden;
  }

  &.hero {
    background-color: $primary-dark;
    background-image: linear-gradient(145deg, #6b0a12 0%, $primary-dark 28%, $primary 68%, #b0101c 100%);
    color: #fff;
    box-shadow: $shadow-lg;
    position: relative;
    overflow: hidden;
    @include azulejo-pattern(0.05);

    &::before {
      content: '';
      position: absolute;
      top: -40rpx;
      right: -40rpx;
      width: 200rpx;
      height: 200rpx;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
    }

    &::after {
      content: '';
      position: absolute;
      bottom: -60rpx;
      left: -30rpx;
      width: 160rpx;
      height: 160rpx;
      border-radius: 50%;
      background: rgba(244, 162, 97, 0.15);
    }
  }

  &.accent {
    background: linear-gradient(135deg, $accent-light, $bg-card);
    border: 1rpx solid rgba($accent, 0.25);
    box-shadow: $shadow-sm;
  }

  &.flat {
    box-shadow: none;
    border: 1rpx solid $border-light;
  }
}
</style>
