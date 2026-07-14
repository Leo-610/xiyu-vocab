<template>
  <view class="user-avatar" :class="[sizeClass]" :style="wrapStyle">
    <image
      v-if="displaySrc"
      class="avatar-img"
      :src="displaySrc"
      mode="aspectFill"
    />
    <view v-else class="avatar-fallback">
      <text class="avatar-initial">{{ initial }}</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { resolveMediaUrl, userInitial } from '../utils/media.js'

const props = defineProps({
  src: { type: String, default: '' },
  nickname: { type: String, default: '' },
  size: { type: [Number, String], default: 80 },
})

const initial = computed(() => userInitial(props.nickname))
const displaySrc = computed(() => resolveMediaUrl(props.src))

const wrapStyle = computed(() => {
  const n = Number(props.size) || 80
  return { width: `${n}rpx`, height: `${n}rpx` }
})

const sizeClass = computed(() => {
  const n = Number(props.size) || 80
  if (n >= 120) return 'lg'
  if (n <= 64) return 'sm'
  return 'md'
})
</script>

<style lang="scss" scoped>
@import '../styles/theme.scss';

.user-avatar {
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba($primary, 0.12);
  border: 2rpx solid rgba($primary, 0.15);
}

.avatar-img,
.avatar-fallback {
  width: 100%;
  height: 100%;
}

.avatar-fallback {
  @include flex-center;
  background: linear-gradient(145deg, rgba($primary, 0.18), rgba($accent, 0.25));
}

.avatar-initial {
  font-weight: 700;
  color: $primary-dark;
}

.sm .avatar-initial { font-size: 24rpx; }
.md .avatar-initial { font-size: 32rpx; }
.lg .avatar-initial { font-size: 44rpx; }
</style>
