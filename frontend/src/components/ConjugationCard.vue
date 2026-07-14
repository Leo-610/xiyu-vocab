<template>
  <view v-if="visible" class="conj-card">
    <view class="conj-head" @click="expanded = !expanded">
      <text class="conj-title">📖 动词变位</text>
      <text class="conj-toggle">{{ expanded ? '收起' : '展开' }}</text>
    </view>

    <view v-if="pending" class="conj-placeholder">
      <text class="ph-icon">📝</text>
      <text class="ph-title">变位表待西语同学补充</text>
      <text class="ph-sub">格式见 docs/conjugation-schema.json</text>
    </view>

    <view v-else-if="expanded && conjugation?.tenses" class="conj-body">
      <view v-for="(t, i) in conjugation.tenses" :key="i" class="tense-block">
        <text class="tense-name">{{ t.name_zh || t.name }}</text>
        <view v-for="f in t.forms" :key="f.person" class="form-row">
          <text class="person">{{ f.person }}</text>
          <text class="form">{{ f.form }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  conjugation: { type: Object, default: null },
  conjugationPending: { type: Boolean, default: true },
  pos: { type: String, default: '' },
})

const expanded = ref(true)
const visible = computed(() => props.pos === 'v' || props.conjugation || props.conjugationPending)
const pending = computed(() => props.conjugationPending && !props.conjugation)
</script>

<style lang="scss" scoped>
@import '../styles/theme.scss';

.conj-card {
  margin-top: 20rpx;
  background: $bg-muted;
  border-radius: $radius-md;
  overflow: hidden;
}

.conj-head {
  display: flex;
  justify-content: space-between;
  padding: 20rpx 24rpx;
  align-items: center;
}

.conj-title {
  font-size: 28rpx;
  font-weight: 600;
}

.conj-toggle {
  font-size: 24rpx;
  color: $primary;
}

.conj-placeholder {
  padding: 24rpx;
  text-align: center;
  border-top: 1rpx dashed rgba($primary, 0.2);
}

.ph-icon { font-size: 48rpx; display: block; }
.ph-title { font-size: 26rpx; color: $text-secondary; display: block; margin-top: 8rpx; }
.ph-sub { font-size: 22rpx; color: $text-muted; display: block; margin-top: 4rpx; }

.conj-body {
  padding: 0 24rpx 24rpx;
  border-top: 1rpx solid $border-light;
}

.tense-block {
  margin-top: 16rpx;
}

.tense-name {
  font-size: 24rpx;
  font-weight: 600;
  color: $primary;
  display: block;
  margin-bottom: 8rpx;
}

.form-row {
  display: flex;
  justify-content: space-between;
  padding: 8rpx 0;
  font-size: 26rpx;
}

.person { color: $text-muted; }
.form { font-weight: 600; color: $text-primary; }
</style>
