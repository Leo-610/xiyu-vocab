<template>
  <view class="heatmap">
    <view class="hm-top">
      <text class="hm-title">近 12 周打卡</text>
      <text class="hm-sub">{{ activeDays }} 天有学习</text>
    </view>

    <view class="hm-months">
      <text
        v-for="(m, i) in monthLabels"
        :key="i"
        class="hm-month"
        :style="{ left: m.left + 'rpx' }"
      >{{ m.label }}</text>
    </view>

    <view class="hm-body">
      <view class="hm-weekdays">
        <text v-for="w in weekdayLabels" :key="w" class="hm-wd">{{ w }}</text>
      </view>
      <view class="hm-grid">
        <view v-for="(col, ci) in weeks" :key="ci" class="hm-col">
          <view
            v-for="(day, di) in col"
            :key="di"
            class="hm-cell"
            :class="'lv-' + level(day.count)"
            @click="onTap(day)"
          />
        </view>
      </view>
    </view>

    <view class="hm-legend">
      <text>少</text>
      <view class="hm-cell lv-0" />
      <view class="hm-cell lv-1" />
      <view class="hm-cell lv-2" />
      <view class="hm-cell lv-3" />
      <view class="hm-cell lv-4" />
      <text>多</text>
    </view>

    <text v-if="tip" class="hm-tip">{{ tip }}</text>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  checkins: { type: Array, default: () => [] },
})

const tip = ref('')
const WEEKDAY_CN = ['一', '', '三', '', '五', '', '']

function parseDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  return new Date(y, m - 1, d)
}

function fmt(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const countMap = computed(() => {
  const map = {}
  for (const row of props.checkins || []) {
    map[row.date] = Number(row.count) || 0
  }
  return map
})

/** 对齐到周一开始的 12 周网格（84 天） */
const weeks = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(today)
  // 对齐到本周日（若今天是周日则为今天）
  const dow = (end.getDay() + 6) % 7 // Mon=0
  end.setDate(end.getDate() + (6 - dow))
  const start = new Date(end)
  start.setDate(start.getDate() - 83)

  const cols = []
  const cursor = new Date(start)
  for (let w = 0; w < 12; w++) {
    const col = []
    for (let d = 0; d < 7; d++) {
      const key = fmt(cursor)
      col.push({ date: key, count: countMap.value[key] || 0 })
      cursor.setDate(cursor.getDate() + 1)
    }
    cols.push(col)
  }
  return cols
})

const weekdayLabels = WEEKDAY_CN

const monthLabels = computed(() => {
  const labels = []
  let last = ''
  weeks.value.forEach((col, i) => {
    const m = col[0]?.date?.slice(5, 7)
    if (m && m !== last) {
      labels.push({ label: `${Number(m)}月`, left: i * 22 })
      last = m
    }
  })
  return labels
})

const activeDays = computed(() =>
  (props.checkins || []).filter((d) => Number(d.count) > 0).length,
)

function level(count) {
  if (!count) return 0
  if (count < 3) return 1
  if (count < 6) return 2
  if (count < 12) return 3
  return 4
}

function onTap(day) {
  if (!day?.date) return
  tip.value = day.count
    ? `${day.date} · 学习 ${day.count} 次`
    : `${day.date} · 未打卡`
}
</script>

<style lang="scss" scoped>
@import '../styles/theme.scss';

.heatmap {
  margin-top: 8rpx;
}

.hm-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 12rpx;
}

.hm-title {
  font-size: 26rpx;
  font-weight: 700;
  color: $text-primary;
}

.hm-sub {
  font-size: 22rpx;
  color: $text-muted;
}

.hm-months {
  position: relative;
  height: 28rpx;
  margin-left: 40rpx;
  margin-bottom: 6rpx;
}

.hm-month {
  position: absolute;
  font-size: 18rpx;
  color: $text-muted;
}

.hm-body {
  display: flex;
  gap: 8rpx;
}

.hm-weekdays {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  width: 32rpx;
}

.hm-wd {
  height: 16rpx;
  font-size: 16rpx;
  line-height: 16rpx;
  color: $text-muted;
  text-align: right;
}

.hm-grid {
  display: flex;
  gap: 6rpx;
  flex: 1;
  overflow: hidden;
}

.hm-col {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.hm-cell {
  width: 16rpx;
  height: 16rpx;
  border-radius: 4rpx;
  background: $bg-muted;

  &.lv-1 { background: rgba($primary, 0.22); }
  &.lv-2 { background: rgba($primary, 0.42); }
  &.lv-3 { background: rgba($primary, 0.68); }
  &.lv-4 { background: $primary; }
}

.hm-legend {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 16rpx;
  font-size: 20rpx;
  color: $text-muted;
}

.hm-tip {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: $text-secondary;
}
</style>
