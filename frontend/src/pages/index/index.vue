<template>
  <view class="container">
    <view v-if="loading" class="loading-wrap">
      <AppCard><text class="skeleton-pulse">加载中...</text></AppCard>
    </view>

    <template v-else>
      <ContentTeamBanner />

      <AppCard variant="hero" class="hero-card animate-pop">
        <view class="hero-inner">
          <view class="hero-text">
            <view class="user-row" @click="goProfile">
              <UserAvatar
                :src="state.avatarUrl"
                :nickname="state.nickname"
                :size="72"
              />
              <view class="user-meta">
                <text class="hero-greet">{{ displayGreet }}</text>
                <text class="hero-sub">{{ state.nickname || '学习者' }}</text>
                <text v-if="state.authType === 'wechat' || state.isWechatUser" class="hero-tag">微信账号</text>
                <text v-else-if="state.authType === 'email'" class="hero-tag">邮箱账号</text>
                <text v-else class="hero-tag">演示账号</text>
              </view>
            </view>
            <view v-if="apiOnline" class="status-chip">已连接</view>
            <view v-else class="status-chip warn">离线</view>
          </view>
          <ProgressRing
            :percent="progressPercent"
            :value="state.streakDays"
            label="天打卡"
            :size="168"
            color="#F4A261"
            track-color="rgba(255,255,255,0.2)"
          />
        </view>
      </AppCard>

      <AppCard>
        <SectionHeader title="学习目标" :subtitle="vocabSubtitle" />
        <view class="level-row">
          <DeleBadge
            v-for="lv in levels"
            :key="lv"
            :level="lv"
            :active="state.targetLevel === lv"
            @click="setLevel(lv)"
          />
        </view>
      </AppCard>

      <AppCard class="today-card">
        <SectionHeader
          title="今日进度"
          :badge="`${progressPercent}%`"
          compact
        />
        <view class="progress-track">
          <view class="progress-fill" :style="{ width: progressPercent + '%' }" />
        </view>
        <view class="stats-row">
          <view class="stat-pill">
            <text class="pill-num">{{ state.todaySession.total }}/{{ state.dailyNew }}</text>
            <text class="pill-label">已学</text>
          </view>
          <view class="stat-pill success">
            <text class="pill-num">{{ state.todaySession.correct }}</text>
            <text class="pill-label">正确</text>
          </view>
          <view class="stat-pill error">
            <text class="pill-num">{{ state.todaySession.wrong }}</text>
            <text class="pill-label">错误</text>
          </view>
        </view>
      </AppCard>

      <view class="action-area">
        <AppButton
          block
          :disabled="!apiOnline || state.todaySession.finished"
          @click="startLearn"
        >
          {{ state.todaySession.finished ? '✓ 今日已完成' : '开始今日学习 →' }}
        </AppButton>
        <AppButton
          v-if="state.todaySession.finished"
          block
          variant="outline"
          class="mt-btn"
          @click="handleResetToday"
        >
          重新练习
        </AppButton>
      </view>

      <AppCard variant="flat" class="exam-card">
        <SectionHeader title="考试路径" subtitle="同一 DELE 词库 · 按考纲标签筛选" />
        <view class="exam-list">
          <view
            v-for="pack in examPacks"
            :key="pack.id"
            class="exam-item"
            @click="startExam(pack.id)"
          >
            <view class="exam-icon">{{ pack.id === 'tem8' ? '🎓' : '📝' }}</view>
            <view class="exam-body">
              <text class="exam-title">{{ pack.title }}</text>
              <text class="exam-desc">{{ pack.subtitle }}</text>
              <view class="exam-progress">
                <view class="exam-track">
                  <view class="exam-fill" :style="{ width: pack.percent + '%' }" />
                </view>
                <text class="exam-stat">{{ pack.learned }}/{{ pack.total }} 词 · {{ pack.percent }}%</text>
              </view>
            </view>
            <text class="arrow">›</text>
          </view>
        </view>
        <text v-if="!examPacks.length" class="exam-empty">加载考试词包信息中…</text>
      </AppCard>

      <AppCard variant="flat">
        <SectionHeader title="学习模式" />
        <view class="feature-list">
          <view class="feature-item" @click="goConfusable">
            <text class="feature-icon">⚖️</text>
            <view>
              <text class="feature-title">易混词辨析</text>
              <text class="feature-desc">ser/estar · por/para（内容待补充）</text>
            </view>
            <text class="arrow">›</text>
          </view>
          <view class="feature-item" @click="goDictation">
            <text class="feature-icon">✍️</text>
            <view>
              <text class="feature-title">听写练习</text>
              <text class="feature-desc">听音写词 · 拼写判题 · 计入错题本</text>
            </view>
            <text class="arrow">›</text>
          </view>
          <view class="feature-item">
            <view>
              <text class="feature-title">看图识词</text>
              <text class="feature-desc">四选一降低记忆负荷</text>
            </view>
          </view>
          <view class="feature-item">
            <text class="feature-icon">📕</text>
            <view>
              <text class="feature-title">智能错题本</text>
              <text class="feature-desc">SM-2 间隔复习</text>
            </view>
          </view>
        </view>
        <view class="legal-row">
          <text class="legal-link" @click="goPrivacy">隐私政策</text>
          <text class="legal-dot">·</text>
          <text class="legal-link" @click="goTerms">用户协议</text>
        </view>
      </AppCard>
    </template>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  checkApiOnline, ensureAuth, getUserState, updateTargetLevel,
  resetTodaySession, fetchVocabularyTotal, fetchExamPacks, isApiOnline,
} from '../../utils/userService.js'

const levels = ['A1']
const loading = ref(true)
const apiOnline = ref(false)
const vocabTotal = ref(0)
const examPacks = ref([])
const state = ref({
  nickname: '',
  avatarUrl: '',
  authType: 'demo',
  isWechatUser: false,
  targetLevel: 'A2',
  dailyNew: 10,
  streakDays: 0,
  todaySession: { total: 0, correct: 0, wrong: 0, finished: false },
})

const displayGreet = computed(() => '¡Hola!')

const vocabSubtitle = computed(() => {
  const total = vocabTotal.value > 0 ? vocabTotal.value : '…'
  return `选择 DELE 等级上限，词库已收录 ${total} 词`
})

const progressPercent = computed(() => {
  const { total } = state.value.todaySession
  const goal = state.value.dailyNew
  return goal ? Math.min(100, Math.round((total / goal) * 100)) : 0
})

async function refresh() {
  loading.value = true
  try {
    apiOnline.value = await checkApiOnline()
    if (apiOnline.value) {
      await ensureAuth()
      state.value = await getUserState(true)
      vocabTotal.value = await fetchVocabularyTotal()
      examPacks.value = await fetchExamPacks()
    }
  } catch (e) {
    uni.showToast({ title: e.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

onShow(() => {
  refresh().catch(() => {})
})

async function setLevel(lv) {
  if (!isApiOnline()) return
  try {
    state.value = await updateTargetLevel(lv)
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  }
}

function startLearn() {
  uni.removeStorageSync('exam_pack')
  uni.switchTab({ url: '/pages/learn/learn' })
}

async function handleResetToday() {
  try {
    state.value = await resetTodaySession()
    uni.showToast({ title: '已重置今日', icon: 'success' })
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  }
}

function goConfusable() {
  uni.navigateTo({ url: '/pages/confusable/confusable' })
}

function goDictation() {
  uni.navigateTo({ url: '/pages/dictation/dictation' })
}

function startExam(packId) {
  if (!apiOnline.value) {
    uni.showToast({ title: '请先连接后端', icon: 'none' })
    return
  }
  uni.setStorageSync('exam_pack', packId)
  uni.switchTab({ url: '/pages/learn/learn' })
}

function goPrivacy() {
  uni.navigateTo({ url: '/pages/legal/privacy' })
}

function goTerms() {
  uni.navigateTo({ url: '/pages/legal/terms' })
}

function goProfile() {
  if (state.value.isWechatUser) {
    uni.navigateTo({ url: '/pages/auth/profile' })
    return
  }
  // #ifndef MP-WEIXIN
  if (state.value.authType === 'demo' || !state.value.isWechatUser) {
    uni.navigateTo({ url: '/pages/auth/profile' })
  }
  // #endif
}
</script>

<style lang="scss" scoped>
@import '../../styles/theme.scss';

.hero-card {
  padding: 40rpx 36rpx !important;
}

.hero-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 1;
}

.hero-text {
  flex: 1;
  min-width: 0;
}

.user-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 16rpx;
}

.user-meta {
  min-width: 0;
}

.hero-greet {
  font-size: 52rpx;
  font-weight: 800;
  display: block;
  color: #fff;
  text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.28);
}

.hero-sub {
  font-size: 26rpx;
  display: block;
  margin-top: 8rpx;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1rpx 6rpx rgba(0, 0, 0, 0.22);
}

.hero-tag {
  display: inline-block;
  margin-top: 8rpx;
  font-size: 20rpx;
  padding: 4rpx 14rpx;
  border-radius: $radius-full;
  background: rgba(0, 0, 0, 0.18);
  border: 1rpx solid rgba(255, 255, 255, 0.28);
  color: #fff;
}

.status-chip {
  display: inline-block;
  margin-top: 16rpx;
  font-size: 20rpx;
  padding: 6rpx 16rpx;
  border-radius: $radius-full;
  background: rgba(0, 0, 0, 0.2);
  border: 1rpx solid rgba(255, 255, 255, 0.22);
  color: #fff;

  &.warn {
    background: rgba(0, 0, 0, 0.32);
  }
}

:deep(.progress-ring .ring-value),
:deep(.progress-ring .ring-label) {
  color: #fff;
  text-shadow: 0 1rpx 6rpx rgba(0, 0, 0, 0.25);
}

.level-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.hint {
  font-size: 24rpx;
  color: $text-muted;
  margin-top: 20rpx;
  display: block;
}

.no-mb {
  margin-bottom: 0 !important;
}

.today-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.today-pct {
  font-size: 36rpx;
  font-weight: 800;
  color: $primary;
}

.progress-track {
  height: 12rpx;
  background: $bg-muted;
  border-radius: $radius-full;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, $primary, $accent);
  border-radius: $radius-full;
  transition: width 0.4s ease;
}

.stats-row {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}

.stat-pill {
  flex: 1;
  background: $bg-muted;
  border-radius: $radius-md;
  padding: 16rpx;
  text-align: center;

  &.success .pill-num { color: $success; }
  &.error .pill-num { color: $error; }
}

.pill-num {
  font-size: 32rpx;
  font-weight: 700;
  color: $text-primary;
  display: block;
}

.pill-label {
  font-size: 22rpx;
  color: $text-muted;
  display: block;
  margin-top: 4rpx;
}

.action-area {
  margin: 8rpx 0 32rpx;
}

.mt-btn {
  margin-top: 20rpx;
}

.exam-card {
  margin-bottom: 24rpx;
}

.section-sub {
  font-size: 24rpx;
  color: $text-secondary;
  display: block;
  margin-bottom: 20rpx;
}

.exam-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.exam-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx;
  background: $bg-muted;
  border-radius: $radius-md;
}

.exam-icon {
  font-size: 44rpx;
  width: 64rpx;
  text-align: center;
}

.exam-body {
  flex: 1;
  min-width: 0;
}

.exam-title {
  font-size: 28rpx;
  font-weight: 600;
  display: block;
}

.exam-desc {
  font-size: 22rpx;
  color: $text-secondary;
  display: block;
  margin-top: 4rpx;
}

.exam-progress {
  margin-top: 12rpx;
}

.exam-track {
  height: 8rpx;
  background: rgba($primary, 0.1);
  border-radius: $radius-full;
  overflow: hidden;
  margin-bottom: 8rpx;
}

.exam-fill {
  height: 100%;
  background: linear-gradient(90deg, $primary, $accent);
  border-radius: $radius-full;
}

.exam-stat {
  font-size: 22rpx;
  color: $text-muted;
}

.exam-empty {
  font-size: 24rpx;
  color: $text-muted;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid $border-light;

  &.muted {
    opacity: 0.55;
    border-bottom: none;
  }
}

.feature-icon {
  font-size: 40rpx;
  width: 56rpx;
  text-align: center;
}

.feature-title {
  font-size: 28rpx;
  font-weight: 600;
  display: block;
}

.feature-desc {
  font-size: 24rpx;
  color: $text-secondary;
  display: block;
  margin-top: 4rpx;
}

.feature-item {
  cursor: pointer;
}

.arrow {
  font-size: 36rpx;
  color: $text-muted;
  margin-left: auto;
}

.legal-row {
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid $border-light;
  text-align: center;
}

.legal-link {
  font-size: 24rpx;
  color: $text-muted;
}

.legal-dot {
  margin: 0 12rpx;
  color: $text-muted;
}
</style>
