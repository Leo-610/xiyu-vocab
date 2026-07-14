<template>
  <view class="setting-row">
    <view class="setting-info">
      <text class="setting-label">{{ icon }} {{ label }}</text>
      <text v-if="desc" class="setting-desc">{{ desc }}</text>
    </view>
    <switch
      :checked="modelValue"
      :color="color"
      @change="onChange"
    />
  </view>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: true },
  label: { type: String, required: true },
  desc: { type: String, default: '' },
  icon: { type: String, default: '' },
  color: { type: String, default: '#c1121f' },
})

const emit = defineEmits(['update:modelValue', 'change'])

function onChange(e) {
  const val = Boolean(e.detail?.value)
  emit('update:modelValue', val)
  emit('change', val)
}
</script>

<style lang="scss" scoped>
@import '../styles/theme.scss';

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-md;
  padding: $space-md 0;
  border-bottom: 1rpx solid $border-light;

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  &:first-child {
    padding-top: 0;
  }
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  font-size: $font-md;
  font-weight: 600;
  color: $text-primary;
  display: block;
}

.setting-desc {
  font-size: $font-sm;
  color: $text-muted;
  display: block;
  margin-top: 6rpx;
  line-height: 1.5;
}
</style>
