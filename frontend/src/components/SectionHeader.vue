<template>
  <view class="section-header" :class="{ compact }">
    <view class="sh-text">
      <text class="sh-title">{{ title }}</text>
      <text v-if="subtitle" class="sh-sub">{{ subtitle }}</text>
    </view>
    <view v-if="$slots.action" class="sh-action">
      <slot name="action" />
    </view>
    <text v-else-if="badge" class="sh-badge">{{ badge }}</text>
  </view>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  badge: { type: String, default: '' },
  compact: { type: Boolean, default: false },
})
</script>

<style lang="scss" scoped>
@import '../styles/theme.scss';

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-sm;
  margin-bottom: $space-md;

  &.compact {
    margin-bottom: $space-sm;
  }
}

.sh-title {
  @include section-title;
  margin-bottom: 0;
}

.sh-sub {
  font-size: $font-sm;
  color: $text-secondary;
  display: block;
  margin-top: 6rpx;
  line-height: 1.5;
  font-weight: 500;
}

.sh-badge {
  font-size: $font-sm;
  font-weight: 700;
  color: $primary;
  background: rgba($primary, 0.08);
  padding: 8rpx 18rpx;
  border-radius: $radius-full;
  flex-shrink: 0;
}

.sh-action {
  flex-shrink: 0;
}
</style>
