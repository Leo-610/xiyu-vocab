<template>
  <view v-if="visible" class="corpus-card">
    <view class="corpus-head">
      <text class="corpus-title">语境例句 · 可溯源</text>
      <text v-if="loading" class="corpus-meta">检索中…</text>
      <text v-else-if="examples.length" class="corpus-meta">RAG</text>
    </view>

    <view v-if="!loading && !examples.length" class="corpus-empty">
      <text>暂无匹配语料（不会用模型编造例句）</text>
    </view>

    <view v-for="(ex, i) in examples" :key="ex.chunkId || i" class="ex-item">
      <text class="ex-es">{{ ex.text_es }}</text>
      <text v-if="ex.text_zh" class="ex-zh">{{ ex.text_zh }}</text>
      <view class="ex-source">
        <text class="source-badge">{{ ex.source }}</text>
        <text v-if="ex.level" class="source-level">{{ ex.level }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { getWordExamples } from '../utils/api.js'

const props = defineProps({
  wordId: { type: [Number, String], default: null },
  enabled: { type: Boolean, default: true },
  show: { type: Boolean, default: false },
})

const loading = ref(false)
const examples = ref([])
const disabled = ref(false)

const visible = computed(() => props.show && props.enabled && !disabled.value)

async function load() {
  if (!props.wordId || !props.enabled || !props.show) return
  loading.value = true
  examples.value = []
  try {
    const res = await getWordExamples(props.wordId, 3)
    if (res.disabled) {
      disabled.value = true
      examples.value = []
      return
    }
    disabled.value = false
    examples.value = res.examples || []
  } catch {
    examples.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.wordId, props.show, props.enabled],
  () => {
    disabled.value = false
    if (props.show && props.enabled) load()
  },
  { immediate: true },
)
</script>

<style lang="scss" scoped>
@import '../styles/theme.scss';

.corpus-card {
  margin-top: 20rpx;
  padding: 20rpx 24rpx;
  background: rgba($primary, 0.04);
  border-radius: $radius-md;
  border: 1rpx solid rgba($primary, 0.12);
}

.corpus-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.corpus-title {
  font-size: 26rpx;
  font-weight: 700;
  color: $text-primary;
}

.corpus-meta {
  font-size: 20rpx;
  color: $primary;
  font-weight: 600;
}

.corpus-empty {
  font-size: 24rpx;
  color: $text-muted;
  line-height: 1.5;
}

.ex-item {
  padding: 16rpx 0;
  border-top: 1rpx dashed rgba($primary, 0.15);

  &:first-of-type {
    border-top: none;
  }
}

.ex-es {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: $text-primary;
  line-height: 1.45;
}

.ex-zh {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: $text-secondary;
}

.ex-source {
  display: flex;
  gap: 12rpx;
  margin-top: 10rpx;
  align-items: center;
}

.source-badge {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: $radius-full;
  background: rgba($accent, 0.2);
  color: $primary-dark;
  font-weight: 600;
}

.source-level {
  font-size: 20rpx;
  color: $text-muted;
}
</style>
