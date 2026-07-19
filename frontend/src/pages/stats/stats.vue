<template>
  <view class="container">
    <view v-if="loading">
      <AppCard><text class="skeleton-pulse">加载统计...</text></AppCard>
    </view>

    <template v-else>
      <AppCard v-if="stats.studySummary">
        <SectionHeader title="近 30 日学习" :badge="`${stats.studySummary.accuracyPercent}%`" compact />
        <view class="stat-grid">
          <view class="stat-card">
            <text class="stat-icon">📊</text>
            <text class="stat-num">{{ stats.studySummary.totalEvents }}</text>
            <text class="stat-label">答题次数</text>
          </view>
          <view class="stat-card accent">
            <text class="stat-icon">📅</text>
            <text class="stat-num">{{ stats.studySummary.activeDays }}</text>
            <text class="stat-label">活跃天数</text>
          </view>
        </view>
      </AppCard>

      <AppCard>
        <SectionHeader title="学习概览" />
        <view class="stat-grid">
          <view v-for="item in statCards" :key="item.label" class="stat-card" :class="item.cls">
            <text class="stat-icon">{{ item.icon }}</text>
            <text class="stat-num">{{ item.value }}</text>
            <text class="stat-label">{{ item.label }}</text>
          </view>
        </view>
      </AppCard>

      <AppCard>
        <text class="section-title">DELE 词库覆盖</text>
        <view v-for="item in stats.levelBars || []" :key="item.level" class="bar-row">
          <DeleBadge :level="item.level" sm active />
          <view class="bar-track">
            <view
              class="bar-fill"
              :style="{
                width: barPercent(item) + '%',
                background: levelColor(item.level),
              }"
            />
          </view>
          <text class="bar-count">{{ item.learned }}/{{ item.count }}</text>
        </view>
      </AppCard>

      <AppCard>
        <text class="section-title">今日学习</text>
        <view class="today-list">
          <view class="today-row">
            <text>新词目标</text>
            <text class="val">{{ stats.dailyNew }} 词</text>
          </view>
          <view class="today-row">
            <text>已完成</text>
            <text class="val">{{ stats.todaySession?.total || 0 }} 词</text>
          </view>
          <view class="today-row">
            <text>正确 / 错误</text>
            <text class="val">{{ stats.todaySession?.correct || 0 }} / {{ stats.todaySession?.wrong || 0 }}</text>
          </view>
        </view>
      </AppCard>

      <AppCard>
        <SectionHeader title="学习设置" subtitle="保存到账号，多设备同步" />
        <SettingSwitch
          v-model="settings.soundEnabled"
          icon="🔊"
          label="发音朗读"
          desc="学习页点击喇叭播放西语读音"
          @change="(v) => saveSetting('soundEnabled', v)"
        />
        <SettingSwitch
          v-model="settings.vibrationEnabled"
          icon="📳"
          label="答题震动"
          desc="选错时轻微震动反馈"
          @change="(v) => saveSetting('vibrationEnabled', v)"
        />
        <SettingSwitch
          v-model="settings.showIpa"
          icon="🔤"
          label="显示音标"
          desc="学习页展示 IPA 国际音标"
          @change="(v) => saveSetting('showIpa', v)"
        />
      </AppCard>

      <AppCard v-if="stats.checkins?.length">
        <text class="section-title">打卡记录</text>
        <CheckinHeatmap :checkins="stats.checkins" />
      </AppCard>

      <AppCard>
        <text class="section-title">账号</text>
        <view class="account-row">
          <UserAvatar
            :src="stats.avatarUrl"
            :nickname="stats.nickname"
            :size="88"
          />
          <view class="account-meta">
            <text class="account-name">{{ stats.nickname || '未命名' }}</text>
            <text v-if="stats.authType === 'wechat' || stats.isWechatUser" class="account-tag">微信用户</text>
            <text v-else-if="stats.authType === 'email'" class="account-tag">邮箱用户</text>
            <text v-else class="account-tag">演示账号</text>
          </view>
        </view>
        <!-- #ifdef MP-WEIXIN -->
        <AppButton
          v-if="stats.isWechatUser"
          block
          variant="outline"
          class="profile-btn"
          @click="goEditProfile"
        >
          编辑头像与昵称
        </AppButton>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <AppButton
          block
          variant="outline"
          class="profile-btn"
          @click="goEditProfile"
        >
          编辑昵称
        </AppButton>
        <!-- #endif -->
        <AppButton block variant="outline" class="logout-btn" @click="handleLogout">退出登录</AppButton>
      </AppCard>

      <AppCard variant="flat">
        <text class="section-title">升级路线</text>
        <view v-for="r in roadmap" :key="r.phase" class="road-item">
          <text class="road-phase">{{ r.phase }}</text>
          <text class="road-text">{{ r.text }}</text>
        </view>
      </AppCard>

      <AppButton block variant="outline" @click="resetData">重置演示数据</AppButton>
    </template>
  </view>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  ensureAuth, fetchStats, resetAllProgress, logout, setCachedState,
} from '../../utils/userService.js'
import * as api from '../../utils/api.js'

const COLORS = { A1: '#2A9D8F', A2: '#43AA8B', B1: '#F4A261', B2: '#E76F51', C1: '#9B5DE5', C2: '#C1121F' }

const loading = ref(true)
const stats = ref({})
const settings = reactive({
  soundEnabled: true,
  vibrationEnabled: true,
  showIpa: true,
})
const savingSetting = ref(false)

const statCards = computed(() => [
  { icon: '📚', value: stats.value.learnedIds?.length || 0, label: '已学单词', cls: '' },
  { icon: '🔥', value: stats.value.streakDays || 0, label: '连续打卡', cls: 'accent' },
  { icon: '📕', value: stats.value.mistakes?.length || 0, label: '错题数', cls: 'warn' },
  { icon: '🎯', value: `${stats.value.accuracy || 0}%`, label: '今日正确率', cls: 'ok' },
])

const roadmap = [
  { phase: '二期', text: 'SM-2 复习 · 微信小程序 · 5000 词' },
  { phase: '三期', text: 'RAG 语境例句 · LLM 错题解析' },
  { phase: '四期', text: '可视化热力图 · 国家级大创' },
]

onShow(async () => {
  loading.value = true
  try {
    await ensureAuth()
    stats.value = await fetchStats()
    syncSettings(stats.value.settings)
  } catch (e) {
    uni.showToast({ title: e.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
})

function syncSettings(src) {
  settings.soundEnabled = src?.soundEnabled !== false
  settings.vibrationEnabled = src?.vibrationEnabled !== false
  settings.showIpa = src?.showIpa !== false
}

async function saveSetting(key, value) {
  if (savingSetting.value) return
  savingSetting.value = true
  const prev = settings[key]
  settings[key] = value
  try {
    const next = await api.updateSettings({ [key]: value })
    stats.value = await fetchStats()
    setCachedState({ ...next, settings: stats.value.settings })
    syncSettings(stats.value.settings)
    uni.showToast({ title: '已保存', icon: 'success', duration: 1200 })
  } catch (e) {
    settings[key] = prev
    uni.showToast({ title: e.message || '保存失败', icon: 'none' })
  } finally {
    savingSetting.value = false
  }
}

function levelColor(lv) {
  return COLORS[lv] || '#C1121F'
}

function barPercent(item) {
  if (!item.count) return 0
  return Math.max(8, Math.round((item.learned / item.count) * 100))
}

function resetData() {
  uni.showModal({
    title: '确认重置',
    content: '将清空学习记录与错题本',
    success: async (res) => {
      if (res.confirm) {
        try {
          stats.value = await resetAllProgress()
          uni.showToast({ title: '已重置', icon: 'success' })
        } catch (e) {
          uni.showToast({ title: e.message, icon: 'none' })
        }
      }
    },
  })
}

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '退出后需重新登录才能同步进度',
    async success(res) {
      if (res.confirm) await logout()
    },
  })
}

function goEditProfile() {
  uni.navigateTo({ url: '/pages/auth/profile' })
}
</script>

<style lang="scss" scoped>
@import '../../styles/theme.scss';

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}

.stat-card {
  background: $bg-muted;
  border-radius: $radius-md;
  padding: 24rpx 16rpx;
  text-align: center;

  &.accent .stat-num { color: $accent; }
  &.warn .stat-num { color: $error; }
  &.ok .stat-num { color: $success; }
}

.stat-icon {
  font-size: 32rpx;
  display: block;
  margin-bottom: 8rpx;
}

.stat-num {
  font-size: 44rpx;
  font-weight: 800;
  color: $primary;
  display: block;
}

.stat-label {
  font-size: 22rpx;
  color: $text-muted;
  display: block;
  margin-top: 6rpx;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.bar-track {
  flex: 1;
  height: 16rpx;
  background: $bg-muted;
  border-radius: $radius-full;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: $radius-full;
  transition: width 0.4s ease;
  min-width: 0;
}

.bar-count {
  width: 88rpx;
  font-size: 22rpx;
  color: $text-muted;
  text-align: right;
}

.today-row {
  display: flex;
  justify-content: space-between;
  padding: 18rpx 0;
  border-bottom: 1rpx solid $border-light;
  font-size: 28rpx;
  color: $text-secondary;

  &:last-child { border-bottom: none; }
}

.val {
  font-weight: 700;
  color: $primary;
}

.account-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.account-meta {
  flex: 1;
  min-width: 0;
}

.account-name {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: $text-primary;
}

.account-tag {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $text-muted;
}

.profile-btn {
  margin-bottom: 16rpx;
}

.logout-btn {
  margin-top: 0;
}

.road-item {
  display: flex;
  gap: 16rpx;
  align-items: flex-start;
  padding: 14rpx 0;
}

.road-phase {
  background: rgba($primary, 0.08);
  color: $primary;
  font-size: 22rpx;
  font-weight: 600;
  padding: 6rpx 14rpx;
  border-radius: $radius-sm;
  flex-shrink: 0;
}

.road-text {
  font-size: 26rpx;
  color: $text-secondary;
  line-height: 1.5;
}
</style>
