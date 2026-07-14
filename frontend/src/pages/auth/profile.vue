<template>
  <view class="container">
    <AppCard>
      <!-- #ifdef MP-WEIXIN -->
      <WechatProfileForm
        :initial-nickname="user.nickname"
        :initial-avatar-url="user.avatarUrl"
        title="编辑微信资料"
        subtitle="更新头像与昵称，仅用于 App 内展示"
        submit-text="保存"
        @saved="onSaved"
      />
      <!-- #endif -->

      <!-- #ifndef MP-WEIXIN -->
      <SectionHeader
        title="编辑演示资料"
        subtitle="H5 答辩演示：可修改昵称，头像显示首字母"
      />

      <view class="avatar-wrap">
        <UserAvatar :src="user.avatarUrl" :nickname="nickname" :size="128" />
      </view>

      <view class="field">
        <text class="label">昵称</text>
        <input
          v-model="nickname"
          class="input"
          type="text"
          maxlength="32"
          placeholder="例如：西语学习者"
          confirm-type="done"
        />
      </view>

      <view v-if="saved" class="success-msg">✓ 已保存，正在返回…</view>
      <view v-if="error" class="error-msg">{{ error }}</view>

      <AppButton block :loading="loading" :disabled="saved" @click="handleSave">保存</AppButton>

      <text class="hint">演示账号仅改显示昵称；重新注册新昵称需到登录页。</text>
      <!-- #endif -->
    </AppCard>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { ensureAuth, setCachedState } from '../../utils/userService.js'
import { updateProfile } from '../../utils/api.js'

const user = ref({ nickname: '', avatarUrl: '' })
const nickname = ref('')
const loading = ref(false)
const error = ref('')
const saved = ref(false)

onShow(async () => {
  saved.value = false
  error.value = ''
  try {
    user.value = await ensureAuth()
    nickname.value = user.value.nickname === '微信用户' ? '' : (user.value.nickname || '')
  } catch {
    // redirected to login
  }
})

function goBackAfterSave() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
    return
  }
  uni.switchTab({ url: '/pages/index/index' })
}

function onSaved(nextUser) {
  setCachedState(nextUser)
  saved.value = true
  uni.showToast({ title: '已保存', icon: 'success' })
  setTimeout(goBackAfterSave, 500)
}

async function handleSave() {
  const name = nickname.value.trim()
  if (!name) {
    error.value = '请输入昵称'
    return
  }
  if (name === user.value.nickname) {
    saved.value = true
    setTimeout(goBackAfterSave, 300)
    return
  }
  loading.value = true
  error.value = ''
  saved.value = false
  try {
    const next = await updateProfile({ nickname: name })
    user.value = next
    setCachedState(next)
    saved.value = true
    uni.showToast({ title: '已保存', icon: 'success' })
    setTimeout(goBackAfterSave, 500)
  } catch (e) {
    error.value = e.message || '保存失败，请检查是否已登录'
    uni.showToast({ title: error.value, icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
@import '../../styles/theme.scss';

.avatar-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: $space-lg;
}

.field {
  margin-bottom: $space-md;
}

.label {
  display: block;
  font-size: $font-sm;
  font-weight: 600;
  color: $text-secondary;
  margin-bottom: 12rpx;
}

.input {
  width: 100%;
  height: 88rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
  background: $bg-muted;
  border-radius: $radius-md;
  font-size: 30rpx;
  color: $text-primary;
}

.error-msg {
  display: block;
  margin-bottom: 20rpx;
  padding: 16rpx 20rpx;
  background: $error-bg;
  color: $error;
  border-radius: $radius-sm;
  font-size: $font-sm;
}

.success-msg {
  display: block;
  margin-bottom: 20rpx;
  padding: 16rpx 20rpx;
  background: $success-bg;
  color: $success;
  border-radius: $radius-sm;
  font-size: $font-sm;
  font-weight: 600;
  text-align: center;
}

.hint {
  display: block;
  margin-top: 24rpx;
  font-size: $font-sm;
  color: $text-muted;
  line-height: 1.6;
  text-align: center;
}
</style>
