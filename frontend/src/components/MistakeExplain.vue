<template>
  <view v-if="visible" class="explain-card">
    <view class="explain-head">
      <text class="explain-title">错题解析</text>
      <text class="explain-meta">{{ statusLabel }}</text>
    </view>
    <view v-if="loading" class="explain-body">
      <text class="muted">正在生成解析…</text>
    </view>
    <view v-else-if="summary" class="explain-body">
      <text class="summary">{{ summary }}</text>
      <view v-if="citations.length" class="cites">
        <text class="cites-title">引用语料</text>
        <view v-for="c in citations" :key="c.index" class="cite-row">
          <text class="cite-es">{{ c.index }}. {{ c.text_es }}</text>
          <text class="cite-src">{{ c.source }}</text>
        </view>
      </view>
      <text v-if="pendingHint" class="hint">解析待西语同学审核后入库</text>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { explainWordMistake } from '../utils/api.js'

const props = defineProps({
  wordId: { type: [Number, String], default: null },
  wrongChoice: { type: String, default: '' },
  enabled: { type: Boolean, default: true },
  show: { type: Boolean, default: false },
})

const loading = ref(false)
const summary = ref('')
const citations = ref([])
const status = ref('')
const disabled = ref(false)

const visible = computed(() => props.show && props.enabled && !disabled.value)
const pendingHint = computed(() => status.value === 'pending')
const statusLabel = computed(() => {
  if (loading.value) return '…'
  if (status.value === 'approved') return '已审核'
  if (status.value === 'pending') return '待审核'
  return 'RAG'
})

async function load() {
  if (!props.wordId || !props.enabled || !props.show) return
  loading.value = true
  summary.value = ''
  citations.value = []
  try {
    const res = await explainWordMistake(props.wordId, props.wrongChoice)
    if (res.disabled) {
      disabled.value = true
      return
    }
    disabled.value = false
    status.value = res.status || ''
    summary.value = res.explanation?.summary_zh || ''
    citations.value = res.explanation?.citations || []
  } catch {
    summary.value = ''
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.wordId, props.show, props.enabled, props.wrongChoice],
  () => {
    disabled.value = false
    if (props.show && props.enabled) load()
  },
  { immediate: true },
)
</script>

<style lang="scss" scoped>
@import '../styles/theme.scss';

.explain-card {
  margin-top: 20rpx;
  padding: 20rpx 24rpx;
  background: rgba($warning, 0.08);
  border-radius: $radius-md;
  border: 1rpx solid rgba($warning, 0.25);
}

.explain-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.explain-title {
  font-size: 26rpx;
  font-weight: 700;
}

.explain-meta {
  font-size: 20rpx;
  color: #b45309;
  font-weight: 600;
}

.summary {
  display: block;
  font-size: 26rpx;
  line-height: 1.6;
  color: $text-primary;
  white-space: pre-wrap;
}

.muted { font-size: 24rpx; color: $text-muted; }

.cites { margin-top: 16rpx; }
.cites-title {
  display: block;
  font-size: 22rpx;
  color: $text-muted;
  margin-bottom: 8rpx;
}
.cite-row { margin-bottom: 8rpx; }
.cite-es {
  display: block;
  font-size: 24rpx;
  color: $text-secondary;
}
.cite-src {
  display: block;
  font-size: 20rpx;
  color: $primary;
  margin-top: 2rpx;
}
.hint {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: $text-muted;
}
</style>
