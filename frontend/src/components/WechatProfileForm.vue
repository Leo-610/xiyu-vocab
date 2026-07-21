<template>
  <view class="wechat-profile">
    <text class="form-title">{{ title }}</text>
    <text v-if="subtitle" class="form-sub">{{ subtitle }}</text>

    <!-- 不用 open-type=chooseAvatar 包自定义组件（会导致渲染层 FLOW / addListener 崩溃） -->
    <view class="avatar-picker" @click="pickAvatar">
      <image
        v-if="avatarPreview"
        class="avatar-img"
        :src="avatarPreview"
        mode="aspectFill"
      />
      <view v-else class="avatar-fallback">
        <text class="avatar-initial">{{ avatarInitial }}</text>
      </view>
      <text class="avatar-hint">点击选择头像</text>
    </view>

    <view class="field">
      <text class="label">昵称</text>
      <input
        v-model="nickname"
        class="nickname-input"
        type="text"
        maxlength="32"
        placeholder="请输入昵称"
      />
    </view>

    <view v-if="error" class="error-msg">{{ error }}</view>
    <view v-if="hint" class="hint-msg">{{ hint }}</view>

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
import { computed, ref, watch } from 'vue'
import { updateProfile, uploadAvatar } from '../utils/api.js'
import { userInitial } from '../utils/media.js'

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
const hint = ref('')

const avatarInitial = computed(() => userInitial(nickname.value))

watch(() => props.initialNickname, (v) => {
  if (v && v !== '微信用户') nickname.value = v
})

watch(() => props.initialAvatarUrl, (v) => {
  if (v) avatarPreview.value = v
})

function pickAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success(res) {
      const path = res.tempFilePaths?.[0]
      if (!path) return
      avatarLocalPath.value = path
      avatarPreview.value = path
      hint.value = ''
      error.value = ''
    },
    fail(err) {
      const msg = err?.errMsg || ''
      if (/privacy|authorize|scope|cancel/i.test(msg) && !/cancel/i.test(msg)) {
        hint.value = '若无法选图，请在公众平台配置隐私指引中的「选中的照片或视频」'
      } else if (!/cancel/i.test(msg)) {
        error.value = '选择图片失败，可稍后设置'
      }
    },
  })
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
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 32rpx;
}

.avatar-img,
.avatar-fallback {
  width: 128rpx;
  height: 128rpx;
  border-radius: 50%;
  overflow: hidden;
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, $primary-light, $primary);
}

.avatar-initial {
  color: #fff;
  font-size: 48rpx;
  font-weight: 700;
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

.hint-msg {
  display: block;
  margin-bottom: 20rpx;
  padding: 16rpx 20rpx;
  background: rgba($warning, 0.12);
  color: $text-secondary;
  border-radius: $radius-sm;
  font-size: 24rpx;
  line-height: 1.5;
}

.mt-btn {
  margin-top: 20rpx;
}
</style>
