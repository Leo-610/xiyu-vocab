<template>
  <view class="container dictation-page">
    <view v-if="loading" class="loading-wrap">
      <AppCard><text class="skeleton-pulse">加载听写词包...</text></AppCard>
    </view>

    <view v-else-if="finished" class="done-wrap animate-pop">
      <AppCard class="done-card">
        <view class="done-badge">✍️</view>
        <text class="done-title">听写完成</text>
        <text class="done-sub">本次 {{ sessionStats.total }} 词</text>
        <view class="done-stats">
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
        <AppButton block variant="outline" class="mt-btn" @click="restart">再练一组</AppButton>
      </AppCard>
    </view>

    <view v-else-if="currentWord" class="dictation-area">
      <LearnProgressBar
        :current="currentIndex + 1"
        :total="pack.length"
        :level="currentWord.level"
      />

      <AppCard class="audio-card animate-slide-up">
        <text class="mode-label">听音写词</text>
        <view class="meta-row">
          <DeleBadge :level="currentWord.level" sm active />
          <text v-if="currentWord.pos" class="pos-tag">{{ posLabel(currentWord.pos) }}</text>
          <text v-if="currentWord.studyMode === 'review'" class="mode-review">复习</text>
        </view>
        <text v-if="currentWord.ipa && answered" class="ipa">/{{ currentWord.ipa }}/</text>

        <view class="play-area">
          <view class="play-btn" :class="{ playing }" @click="onPlay">
            <text class="play-icon">{{ playing ? '⏸' : '🔊' }}</text>
            <text class="play-text">{{ playing ? '播放中…' : '播放发音' }}</text>
          </view>
          <text class="play-hint">听清楚后，在下方输入西班牙语拼写</text>
        </view>
      </AppCard>

      <AppCard v-if="!answered" class="input-card">
        <input
          v-model="userInput"
          class="spell-input"
          type="text"
          confirm-type="done"
          placeholder="输入西班牙语单词"
          :disabled="submitting"
          @confirm="submitAnswer"
        />
        <AppButton block :disabled="!userInput.trim() || submitting" @click="submitAnswer">
          提交
        </AppButton>
      </AppCard>

      <AppCard v-else class="feedback animate-slide-up">
        <view class="fb-header" :class="lastCorrect ? 'ok' : 'bad'">
          <text class="fb-icon">{{ lastCorrect ? '✓' : '✗' }}</text>
          <text class="fb-title">{{ lastCorrect ? '拼写正确！' : '再记一记' }}</text>
        </view>
        <view class="answer-row">
          <text class="lemma">{{ revealWord?.lemma }}</text>
          <text class="meaning">{{ revealWord?.meaning_zh }}</text>
        </view>
        <text v-if="!lastCorrect && userInput.trim()" class="your-answer">
          你的输入：{{ userInput.trim() }}
        </text>
        <view v-if="revealWord?.example_es" class="example-box">
          <text class="example">{{ revealWord.example_es }}</text>
          <text v-if="revealWord.example_zh" class="example-zh">{{ revealWord.example_zh }}</text>
        </view>
        <AppButton block :variant="lastCorrect ? 'success' : 'primary'" @click="nextWord">
          {{ currentIndex + 1 >= pack.length ? '完成听写' : '下一词 →' }}
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
import { onShow } from '@dcloudio/uni-app'
import {
  ensureAuth, fetchDictationPack, submitDictationAnswer, posLabel,
} from '../../utils/userService.js'
import { playWordAudio } from '../../utils/audio.js'

const loading = ref(true)
const pack = ref([])
const currentIndex = ref(0)
const userInput = ref('')
const answered = ref(false)
const lastCorrect = ref(false)
const revealWord = ref(null)
const finished = ref(false)
const emptyMessage = ref('暂无听写单词')
const playing = ref(false)
const submitting = ref(false)
const sessionStats = ref({ total: 0, correct: 0, wrong: 0 })

const currentWord = computed(() => pack.value[currentIndex.value] || null)

onShow(async () => {
  loading.value = true
  try {
    await ensureAuth()
    await initPack()
  } catch (e) {
    emptyMessage.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
})

async function initPack() {
  finished.value = false
  sessionStats.value = { total: 0, correct: 0, wrong: 0 }
  try {
    const res = await fetchDictationPack(10)
    pack.value = res.words
    if (!pack.value.length) {
      emptyMessage.value = '该等级下暂无单词，请切换 DELE 等级或补充词库'
      return
    }
    currentIndex.value = 0
    resetQuestion()
    autoPlay()
  } catch (e) {
    emptyMessage.value = e.message || '加载词包失败'
  }
}

function resetQuestion() {
  userInput.value = ''
  answered.value = false
  lastCorrect.value = false
  revealWord.value = null
}

async function onPlay() {
  if (!currentWord.value || playing.value) return
  playing.value = true
  try {
    await playWordAudio({
      lemma: currentWord.value._speak,
      audio_url: currentWord.value.audio_url,
    })
  } catch {
    uni.showToast({ title: '播放失败', icon: 'none' })
  } finally {
    playing.value = false
  }
}

async function autoPlay() {
  await new Promise((r) => setTimeout(r, 300))
  await onPlay()
}

async function submitAnswer() {
  if (answered.value || submitting.value || !currentWord.value) return
  const text = userInput.value.trim()
  if (!text) return
  submitting.value = true
  try {
    const res = await submitDictationAnswer(currentWord.value.id, text)
    answered.value = true
    lastCorrect.value = res.isCorrect
    revealWord.value = res.word
    sessionStats.value.total += 1
    if (res.isCorrect) sessionStats.value.correct += 1
    else {
      sessionStats.value.wrong += 1
      try { uni.vibrateShort({ type: 'medium' }) } catch { /* H5 */ }
    }
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  } finally {
    submitting.value = false
  }
}

function nextWord() {
  if (currentIndex.value + 1 >= pack.value.length) {
    finished.value = true
    return
  }
  currentIndex.value += 1
  resetQuestion()
  autoPlay()
}

function restart() {
  loading.value = true
  initPack().finally(() => { loading.value = false })
}

function goHome() {
  uni.switchTab({ url: '/pages/index/index' })
}
</script>

<style lang="scss" scoped>
@import '../../styles/theme.scss';

.dictation-page {
  padding-top: 16rpx;
}

.mode-label {
  display: block;
  font-size: 26rpx;
  color: $text-muted;
  margin-bottom: 16rpx;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.pos-tag {
  font-size: 22rpx;
  color: $primary;
  background: rgba($primary, 0.08);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.mode-review {
  font-size: 22rpx;
  color: #2563eb;
}

.ipa {
  display: block;
  font-size: 28rpx;
  color: $text-muted;
  margin-bottom: 16rpx;
}

.play-area {
  text-align: center;
  padding: 24rpx 0 8rpx;
}

.play-btn {
  display: inline-flex;
  align-items: center;
  gap: 16rpx;
  padding: 28rpx 48rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, $primary, $primary-dark);
  color: #fff;
  box-shadow: 0 8rpx 24rpx rgba($primary, 0.25);

  &.playing {
    opacity: 0.85;
  }
}

.play-icon {
  font-size: 40rpx;
}

.play-text {
  font-size: 30rpx;
  font-weight: 600;
}

.play-hint {
  display: block;
  margin-top: 20rpx;
  font-size: 24rpx;
  color: $text-muted;
}

.spell-input {
  width: 100%;
  height: 96rpx;
  padding: 0 24rpx;
  margin-bottom: 24rpx;
  border: 2rpx solid rgba($primary, 0.2);
  border-radius: 16rpx;
  font-size: 32rpx;
  box-sizing: border-box;
}

.feedback {
  margin-top: 8rpx;
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
  font-size: 36rpx;
  font-weight: 700;
}

.fb-title {
  font-size: 32rpx;
  font-weight: 700;
}

.answer-row {
  margin-bottom: 12rpx;
}

.lemma {
  display: block;
  font-size: 44rpx;
  font-weight: 700;
  color: $text-primary;
}

.meaning {
  display: block;
  font-size: 28rpx;
  color: $text-muted;
  margin-top: 8rpx;
}

.your-answer {
  display: block;
  font-size: 26rpx;
  color: $error;
  margin-bottom: 16rpx;
}

.example-box {
  background: rgba($primary, 0.06);
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
  margin-bottom: 24rpx;
}

.example {
  display: block;
  font-size: 28rpx;
}

.example-zh {
  display: block;
  font-size: 24rpx;
  color: $text-muted;
  margin-top: 8rpx;
}

.done-wrap {
  padding-top: 80rpx;
}

.done-card {
  text-align: center;
}

.done-badge {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.done-title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
}

.done-sub {
  display: block;
  font-size: 28rpx;
  color: $text-muted;
  margin: 12rpx 0 32rpx;
}

.done-stats {
  display: flex;
  justify-content: center;
  gap: 48rpx;
  margin-bottom: 32rpx;
}

.done-stat {
  text-align: center;

  .ds-num {
    display: block;
    font-size: 48rpx;
    font-weight: 700;
  }

  .ds-label {
    font-size: 24rpx;
    color: $text-muted;
  }

  &.ok .ds-num { color: $success; }
  &.bad .ds-num { color: $error; }
}

.mt-btn {
  margin-top: 16rpx;
}

.empty-text {
  display: block;
  text-align: center;
  color: $text-muted;
  margin-bottom: 24rpx;
}
</style>
