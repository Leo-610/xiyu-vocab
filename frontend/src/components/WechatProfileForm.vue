<template>
  <view class="wechat-profile">
    <text class="form-title">{{ title }}</text>
    <text v-if="subtitle" class="form-sub">{{ subtitle }}</text>

    <view class="avatar-picker">
      <button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
        <UserAvatar :src="avatarPreview" :nickname="nickname" :size="128" />
        <text class="avatar-hint">点击选择头像</text>
      </button>
    </view>

    <view class="field">
      <text class="label">昵称</text>
      <input
        v-model="nickname"
        class="nickname-input"
        type="nickname"
        maxlength="32"
        placeholder="点击输入微信昵称"
      />
    </view>

    <view v-if="error" class="error-msg">{{ error }}</view>

    <AppButton block :loading="loading" @click="handleSave">
      {{ submitText }}
    </AppButton>
    <AppButton
      v-if="allowSkip"
      block
      variant="outline"
      class="mt-btn"
      @click="$emit('skip')"
    >
      稍后设置
    </AppButton>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue'
import UserAvatar from './UserAvatar.vue'
import { updateProfile, uploadAvatar } from '../utils/api.js'

const props = defineProps({
  initialNickname: { type: String, default: '' },
  initialAvatarUrl: { type: String, default: '' },
  title: { type: String, default: '完善微信资料' },
  subtitle: { type: String, default: '选择头像与昵称，用于个人展示（可选）' },
  submitText: { type: String, default: '保存并继续' },
  allowSkip: { type: Boolean, default: false },
})

const emit = defineEmits(['saved', 'skip'])

const nickname = ref(props.initialNickname === '微信用户' ? '' : props.initialNickname)
const avatarPreview = ref(props.initialAvatarUrl)
const avatarLocalPath = ref('')
const loading = ref(false)
const error = ref('')

watch(() => props.initialNickname, (v) => {
  if (v && v !== '微信用户') nickname.value = v
})

watch(() => props.initialAvatarUrl, (v) => {
  if (v) avatarPreview.value = v
})

function onChooseAvatar(e) {
  const path = e.detail?.avatarUrl
  if (!path) return
  avatarLocalPath.value = path
  avatarPreview.value = path
}

async function handleSave() {
  const name = nickname.value.trim()
  if (!name) {
    error.value = '请输入昵称'
    return
  }
  loading.value = true
  error.value = ''
  try {
    if (avatarLocalPath.value) {
      const uploadRes = await uploadAvatar(avatarLocalPath.value, name)
      emit('saved', uploadRes.user)
      return
    }
    const user = await updateProfile({ nickname: name })
    emit('saved', user)
  } catch (e) {
    error.value = e.message || '保存失败'
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
@import '../styles/theme.scss';

.form-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: $text-primary;
}

.form-sub {
  display: block;
  margin-top: 8rpx;
  margin-bottom: 28rpx;
  font-size: 26rpx;
  color: $text-secondary;
  line-height: 1.5;
}

.avatar-picker {
  display: flex;
  justify-content: center;
  margin-bottom: 32rpx;
}

.avatar-btn {
  padding: 0;
  margin: 0;
  background: transparent;
  border: none;
  line-height: 1.2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;

  &::after {
    border: none;
  }
}

.avatar-hint {
  font-size: 24rpx;
  color: $text-muted;
}

.field {
  margin-bottom: 24rpx;
}

.label {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: $text-secondary;
  margin-bottom: 12rpx;
}

.nickname-input {
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
  font-size: 26rpx;
}

.mt-btn {
  margin-top: 20rpx;
}
</style>
