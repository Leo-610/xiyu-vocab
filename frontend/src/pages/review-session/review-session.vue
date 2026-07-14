<template>
  <view class="container">
    <LearnProgressBar v-if="currentWord" :current="currentIndex + 1" :total="pack.length" :level="currentWord.level" />

    <AppCard v-if="!pack.length && !loading">
      <text>暂无错题可复习</text>
      <AppButton block class="mt" @click="goBack">返回</AppButton>
    </AppCard>

    <template v-else-if="currentWord">
      <AppCard no-padding class="word-hero">
        <view class="image-wrap grad-0">
          <text class="word-emoji">{{ currentWord.emoji }}</text>
        </view>
        <view class="word-info">
          <text class="lemma">{{ currentWord.lemma }}</text>
          <text class="mode-tag">错题复习</text>
        </view>
      </AppCard>

      <view class="options">
        <view
          v-for="(opt, idx) in shuffledOptions"
          :key="idx"
          class="option-item"
          :class="optionClass(opt)"
          @click="selectOption(opt)"
        >
          {{ opt.text }}
        </view>
      </view>

      <AppCard v-if="answered">
        <AppButton block @click="nextWord">{{ done ? '完成' : '下一词' }}</AppButton>
      </AppCard>
    </template>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ensureAuth, fetchReviewPack, submitWordAnswer, shuffleOptions } from '../../utils/userService.js'

const loading = ref(true)
const pack = ref([])
const currentIndex = ref(0)
const shuffledOptions = ref([])
const answered = ref(false)
const selectedOpt = ref(null)
const done = ref(false)

const currentWord = computed(() => pack.value[currentIndex.value] || null)

onMounted(async () => {
  try {
    await ensureAuth()
    const res = await fetchReviewPack('mistakes', 10)
    pack.value = res.words
    loadOptions()
  } finally {
    loading.value = false
  }
})

function loadOptions() {
  if (currentWord.value) {
    shuffledOptions.value = shuffleOptions(currentWord.value)
    answered.value = false
    selectedOpt.value = null
  }
}

async function selectOption(opt) {
  if (answered.value) return
  selectedOpt.value = opt
  answered.value = true
  await submitWordAnswer(currentWord.value.id, opt.correct, 'mistake')
}

function optionClass(opt) {
  if (!answered.value) return ''
  if (opt.correct) return 'correct'
  if (selectedOpt.value === opt) return 'wrong'
  return 'dim'
}

function nextWord() {
  if (currentIndex.value + 1 >= pack.value.length) {
    done.value = true
    uni.showToast({ title: '复习完成', icon: 'success' })
    setTimeout(goBack, 800)
    return
  }
  currentIndex.value += 1
  loadOptions()
}

function goBack() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
@import '../../styles/theme.scss';

.word-hero { overflow: hidden; }
.image-wrap { height: 320rpx; @include flex-center; }
.word-emoji { font-size: 120rpx; }
.grad-0 { background: linear-gradient(160deg, #ffecd2, #fcb69f); }
.word-info { padding: 24rpx; text-align: center; }
.lemma { @include text-lemma; }
.mode-tag { font-size: 22rpx; color: $error; margin-top: 8rpx; display: block; }
.options { display: flex; flex-direction: column; gap: 16rpx; margin-top: 24rpx; }
.option-item {
  background: $bg-card; border-radius: $radius-md; padding: 28rpx;
  text-align: center; box-shadow: $shadow-sm;
  &.correct { background: $success-bg; }
  &.wrong { background: $error-bg; }
  &.dim { opacity: 0.5; }
}
.mt { margin-top: 24rpx; }
</style>
