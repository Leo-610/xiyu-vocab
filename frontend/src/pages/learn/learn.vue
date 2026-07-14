<template>
  <view class="container learn-page">
    <view v-if="loading" class="loading-wrap">
      <AppCard><text class="skeleton-pulse">加载词包...</text></AppCard>
    </view>

    <view v-else-if="finished" class="done-wrap animate-pop">
      <AppCard class="done-card">
        <view class="done-badge">🎉</view>
        <text class="done-title">¡Muy bien!</text>
        <text class="done-sub">{{ doneSubtitle }}</text>
        <view class="done-stats">
          <view class="done-stat">
            <text class="ds-num">{{ sessionStats.total }}</text>
            <text class="ds-label">总词数</text>
          </view>
          <view class="done-stat ok">
            <text class="ds-num">{{ sessionStats.correct }}</text>
            <text class="ds-label">正确</text>
          </view>
          <view class="done-stat bad">
            <text class="ds-num">{{ sessionStats.wrong }}</text>
            <text class="ds-label">错误</text>
          </view>
        </view>
        <AppButton block @click="goHome">返回首页</AppButton>
        <AppButton block variant="outline" class="mt-btn" @click="goReview">查看错题本</AppButton>
      </AppCard>
    </view>

    <view v-else-if="currentWord" class="learn-area">
      <LearnProgressBar
        :current="currentIndex + 1"
        :total="pack.length"
        :level="currentWord.level"
      />

      <AppCard no-padding class="word-hero animate-slide-up">
        <view class="image-wrap" :class="'grad-' + (currentIndex % 4)">
          <image
            v-if="currentWord.image_url && !imageError"
            class="word-image"
            :src="imageSrc"
            mode="aspectFill"
            @error="imageError = true"
          />
          <view v-else class="emoji-fallback">
            <text class="word-emoji">{{ currentWord.emoji }}</text>
          </view>
          <view class="image-overlay" />
        </view>
        <view class="word-info">
          <view class="lemma-row">
            <text class="lemma">{{ currentWord.lemma }}</text>
            <view class="speak-btn" @click="onSpeak">🔊</view>
          </view>
          <text v-if="currentWord.ipa && showIpa" class="ipa">/{{ currentWord.ipa }}/</text>
          <view class="meta-row">
            <text v-if="currentWord.pos" class="pos-tag">{{ posLabel(currentWord.pos) }}</text>
            <DeleBadge :level="currentWord.level" sm active />
            <text v-if="currentWord.studyMode === 'review'" class="mode-review">复习</text>
            <text v-else-if="isExamMode" class="mode-exam">{{ examPackInfo?.tag || '考试' }}</text>
          </view>
          <ConjugationCard
            :conjugation="currentWord.conjugation"
            :conjugation-pending="currentWord.conjugationPending"
            :pos="currentWord.pos"
          />
          <view v-if="currentWord.tags?.length" class="tags">
            <text v-for="t in currentWord.tags.slice(0, 3)" :key="t" class="tag">{{ t }}</text>
          </view>
        </view>
      </AppCard>

      <text class="prompt">选择正确的中文释义</text>

      <view class="options" :class="{ 'animate-shake': shakeOptions }">
        <view
          v-for="(opt, idx) in shuffledOptions"
          :key="idx"
          class="option-item"
          :class="optionClass(opt)"
          @click="selectOption(opt)"
        >
          <text class="opt-letter">{{ ['A', 'B', 'C', 'D'][idx] }}</text>
          <text class="opt-text">{{ opt.text }}</text>
        </view>
      </view>

      <AppCard v-if="answered" class="feedback animate-slide-up">
        <view class="fb-header" :class="lastCorrect ? 'ok' : 'bad'">
          <text class="fb-icon">{{ lastCorrect ? '✓' : '✗' }}</text>
          <text class="fb-title">{{ lastCorrect ? '正确！' : '再想想' }}</text>
        </view>
        <text v-if="!lastCorrect" class="fb-answer">答案：{{ currentWord.meaning_zh }}</text>
        <view v-if="currentWord.example_es" class="example-box">
          <text class="example">{{ currentWord.example_es }}</text>
          <text v-if="currentWord.example_zh" class="example-zh">{{ currentWord.example_zh }}</text>
        </view>
        <AppButton block :variant="lastCorrect ? 'success' : 'primary'" @click="nextWord">
          {{ currentIndex + 1 >= pack.length ? '完成今日学习' : '下一词 →' }}
        </AppButton>
      </AppCard>
    </view>

    <view v-else class="empty-wrap">
      <AppCard>
        <text class="empty-text">{{ emptyMessage }}</text>
        <AppButton block class="mt-btn" @click="initPack">重新加载</AppButton>
      </AppCard>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow, onLoad } from '@dcloudio/uni-app'
import {
  ensureAuth, fetchDailyPack, fetchExamPack, submitWordAnswer, completeSession,
  getUserState, shuffleOptions, posLabel, getCachedState,
} from '../../utils/userService.js'
import { speakLemma } from '../../utils/tts.js'

const loading = ref(true)
const examPackId = ref('')
const examPackInfo = ref(null)
const pack = ref([])
const currentIndex = ref(0)
const shuffledOptions = ref([])
const answered = ref(false)
const lastCorrect = ref(false)
const selectedOpt = ref(null)
const finished = ref(false)
const emptyMessage = ref('暂无待学单词')
const imageError = ref(false)
const shakeOptions = ref(false)
const sessionStats = ref({ total: 0, correct: 0, wrong: 0 })
const showIpa = ref(true)

const isExamMode = computed(() => Boolean(examPackId.value))
const doneSubtitle = computed(() => {
  if (isExamMode.value) return `${examPackInfo.value?.title || '考试词包'}完成`
  return '今日学习完成'
})

const currentWord = computed(() => pack.value[currentIndex.value] || null)

const imageSrc = computed(() => {
  const url = currentWord.value?.image_url
  if (!url) return ''
  if (url.startsWith('http')) return url
  return url
})

onLoad((options) => {
  if (options?.exam) {
    examPackId.value = options.exam
    uni.setStorageSync('exam_pack', options.exam)
  }
})

onShow(async () => {
  loading.value = true
  try {
    await ensureAuth()
    if (!examPackId.value) {
      examPackId.value = uni.getStorageSync('exam_pack') || ''
    }
    if (isExamMode.value) {
      const title = examPackId.value === 'tem8' ? '专八高频词包' : '专四冲刺词包'
      uni.setNavigationBarTitle({ title })
      sessionStats.value = { total: 0, correct: 0, wrong: 0 }
      await initPack()
      return
    }
    const state = await getUserState(true)
    showIpa.value = state.settings?.showIpa !== false
    sessionStats.value = { ...state.todaySession }
    if (state.todaySession.finished) {
      finished.value = true
      loading.value = false
      return
    }
    await initPack()
  } catch (e) {
    emptyMessage.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
})

async function initPack() {
  finished.value = false
  imageError.value = false
  try {
    if (isExamMode.value) {
      const res = await fetchExamPack(examPackId.value, 10)
      examPackInfo.value = res.pack
      if (res.empty || !res.words?.length) {
        emptyMessage.value = res.message || '暂无该考试词包，请内容组补充 exam_tags'
        pack.value = []
        return
      }
      pack.value = res.words
      currentIndex.value = 0
      loadOptions()
      return
    }

    const state = await getUserState(true)
    const remaining = Math.max(state.dailyNew - state.todaySession.total, 1)
    const res = await fetchDailyPack(remaining)
    if (res.finished) {
      finished.value = true
      sessionStats.value = { ...state.todaySession }
      return
    }
    pack.value = res.words
    if (!pack.value.length) {
      emptyMessage.value = '该等级下暂无新词，请切换等级或重置进度'
      return
    }
    currentIndex.value = 0
    loadOptions()
  } catch (e) {
    emptyMessage.value = e.message || '加载词包失败'
  }
}

function loadOptions() {
  imageError.value = false
  shakeOptions.value = false
  if (currentWord.value) {
    shuffledOptions.value = shuffleOptions(currentWord.value)
    answered.value = false
    selectedOpt.value = null
  }
}

function onSpeak() {
  if (getCachedState()?.settings?.soundEnabled === false) {
    uni.showToast({ title: '发音已关闭，可在统计页开启', icon: 'none' })
    return
  }
  speakLemma(currentWord.value?.lemma).catch(() => {})
}

async function selectOption(opt) {
  if (answered.value || !currentWord.value) return
  selectedOpt.value = opt
  answered.value = true
  lastCorrect.value = opt.correct

  if (!opt.correct) {
    shakeOptions.value = true
    setTimeout(() => { shakeOptions.value = false }, 400)
    if (getCachedState()?.settings?.vibrationEnabled !== false) {
      try {
        uni.vibrateShort({ type: 'medium' })
      } catch { /* H5 may not support */ }
    }
  }

  try {
    const studyMode = isExamMode.value ? 'exam' : (currentWord.value.studyMode || 'new')
    const res = await submitWordAnswer(currentWord.value.id, opt.correct, studyMode)
    if (isExamMode.value) {
      sessionStats.value.total += 1
      if (opt.correct) sessionStats.value.correct += 1
      else sessionStats.value.wrong += 1
    } else {
      sessionStats.value = { ...res.state.todaySession }
    }
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  }
}

function optionClass(opt) {
  if (!answered.value) return ''
  if (opt.correct) return 'correct'
  if (selectedOpt.value === opt) return 'wrong'
  return 'dim'
}

async function nextWord() {
  if (currentIndex.value + 1 >= pack.value.length) {
    if (isExamMode.value) {
      finished.value = true
      return
    }
    try {
      const state = await completeSession()
      sessionStats.value = { ...state.todaySession }
      finished.value = true
    } catch (e) {
      uni.showToast({ title: e.message, icon: 'none' })
    }
    return
  }
  currentIndex.value += 1
  loadOptions()
}

function goHome() {
  uni.removeStorageSync('exam_pack')
  examPackId.value = ''
  uni.switchTab({ url: '/pages/index/index' })
}

function goReview() {
  uni.switchTab({ url: '/pages/review/review' })
}
</script>

<style lang="scss" scoped>
@import '../../styles/theme.scss';

.learn-page {
  padding-top: 16rpx;
}

.word-hero {
  overflow: hidden;
}

.image-wrap {
  position: relative;
  width: 100%;
  height: 420rpx;
  @include flex-center;

  &.grad-0 { background: linear-gradient(160deg, #ffecd2, #fcb69f); }
  &.grad-1 { background: linear-gradient(160deg, #a8edea, #fed6e3); }
  &.grad-2 { background: linear-gradient(160deg, #d4fc79, #96e6a1); }
  &.grad-3 { background: linear-gradient(160deg, #fbc2eb, #a6c1ee); }
}

.word-image {
  width: 100%;
  height: 100%;
}

.emoji-fallback {
  @include flex-center;
  width: 100%;
  height: 100%;
}

.word-emoji {
  font-size: 140rpx;
}

.image-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.15), transparent 50%);
  pointer-events: none;
}

.word-info {
  padding: 32rpx 36rpx 36rpx;
}

.lemma-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
}

.lemma {
  @include text-lemma;
}

.speak-btn {
  font-size: 36rpx;
  padding: 8rpx;
  opacity: 0.7;
}

.ipa {
  text-align: center;
  font-size: 26rpx;
  color: $text-muted;
  display: block;
  margin-top: 8rpx;
}

.meta-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12rpx;
  margin-top: 16rpx;
}

.pos-tag {
  font-size: 22rpx;
  color: $primary;
  background: rgba($primary, 0.08);
  padding: 6rpx 16rpx;
  border-radius: $radius-full;
}

.mode-review {
  font-size: 20rpx;
  color: $accent;
  background: rgba($accent, 0.2);
  padding: 4rpx 12rpx;
  border-radius: $radius-full;
}

.mode-exam {
  font-size: 20rpx;
  color: $primary;
  background: rgba($primary, 0.12);
  padding: 4rpx 12rpx;
  border-radius: $radius-full;
}

.tags {
  text-align: center;
  margin-top: 16rpx;
}

.prompt {
  font-size: 28rpx;
  color: $text-secondary;
  font-weight: 500;
  display: block;
  margin: 28rpx 8rpx 20rpx;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  background: $bg-card;
  border-radius: $radius-md;
  padding: 28rpx 32rpx;
  box-shadow: $shadow-sm;
  border: 2rpx solid transparent;
  transition: all 0.2s ease;

  &:active:not(.dim):not(.correct):not(.wrong) {
    transform: scale(0.99);
    border-color: rgba($primary, 0.2);
  }

  &.correct {
    background: $success-bg;
    border-color: $success;
  }

  &.wrong {
    background: $error-bg;
    border-color: $error;
  }

  &.dim {
    opacity: 0.45;
  }
}

.opt-letter {
  width: 48rpx;
  height: 48rpx;
  border-radius: 12rpx;
  background: $bg-muted;
  font-size: 24rpx;
  font-weight: 700;
  color: $text-secondary;
  @include flex-center;
  flex-shrink: 0;

  .correct & {
    background: $success;
    color: #fff;
  }

  .wrong & {
    background: $error;
    color: #fff;
  }
}

.opt-text {
  font-size: 30rpx;
  color: $text-primary;
  flex: 1;
}

.feedback {
  margin-top: 24rpx;
}

.fb-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 16rpx;

  &.ok .fb-title { color: $success; }
  &.bad .fb-title { color: $error; }
}

.fb-icon {
  font-size: 40rpx;
  font-weight: 700;
}

.fb-title {
  font-size: 36rpx;
  font-weight: 700;
}

.fb-answer {
  font-size: 28rpx;
  color: $text-secondary;
  display: block;
  margin-bottom: 16rpx;
}

.example-box {
  background: $bg-muted;
  border-radius: $radius-md;
  padding: 20rpx 24rpx;
  margin-bottom: 24rpx;
}

.example {
  font-size: 28rpx;
  color: $text-primary;
  font-style: italic;
  display: block;
}

.example-zh {
  font-size: 24rpx;
  color: $text-muted;
  display: block;
  margin-top: 8rpx;
}

.done-card {
  text-align: center;
  padding: 48rpx 32rpx !important;
}

.done-badge {
  font-size: 100rpx;
  line-height: 1.2;
}

.done-title {
  font-size: 44rpx;
  font-weight: 800;
  color: $primary;
  display: block;
  margin-top: 16rpx;
}

.done-sub {
  font-size: 28rpx;
  color: $text-secondary;
  display: block;
  margin-bottom: 32rpx;
}

.done-stats {
  display: flex;
  justify-content: center;
  gap: 32rpx;
  margin-bottom: 40rpx;
}

.done-stat .ds-num {
  font-size: 40rpx;
  font-weight: 800;
  display: block;
}

.done-stat.ok .ds-num { color: $success; }
.done-stat.bad .ds-num { color: $error; }

.ds-label {
  font-size: 22rpx;
  color: $text-muted;
}

.mt-btn {
  margin-top: 20rpx;
}

.empty-text {
  text-align: center;
  color: $text-secondary;
  display: block;
  margin-bottom: 24rpx;
}
</style>
