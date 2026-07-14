# UI 设计系统（个人开发者版）

> 代码位置：`frontend/src/styles/theme.scss` · 组件 `AppCard` / `AppButton` / `SectionHeader`  
> 风格定位：**西班牙红 + 暖金 + 瓷砖纹样**，专业 DELE 感 + 轻游戏化

---

## 一、设计原则

| 维度 | 说明 |
|------|------|
| 识别性 | 西班牙红 `#C1121F` 主色，区别于英语背单词 App |
| 可读性 | lemma 大号加粗，IPA/释义层级分明 |
| 触控 | 选项按钮加大，圆角胶囊 CTA |
| 情感 | 打卡环形进度、完成页庆祝、答题震动反馈 |
| 个人版 | 关闭「内容组进度」横幅（`app.js` → `showDevBanner: false`） |

---

## 二、Design Tokens

### 色彩

| Token | 值 | 用途 |
|-------|-----|------|
| `$primary` | `#C1121F` | 主按钮、导航栏、强调 |
| `$accent` | `#F4A261` | 打卡、成就、复习标签 |
| `$bg-page` | `#FAF7F5` | 页面底色（米白） |
| `$success` | `#2A9D8F` | 答对反馈 |
| `$error` | `#E76F51` | 答错、错题 |

### DELE 等级色带

| 等级 | 色值 |
|------|------|
| A1 | `#2A9D8F` |
| A2 | `#43AA8B` |
| B1 | `#F4A261` |
| B2 | `#E76F51` |
| C1 | `#9B5DE5` |
| C2 | `#C1121F` |

### 字体层级

| Token | 大小 | 场景 |
|-------|------|------|
| `$font-lemma` | 56rpx | 学习页西语词条 |
| `$font-2xl` | 52rpx | 首页问候 |
| `$font-lg` | 32rpx | 区块标题 |
| `$font-md` | 28rpx | 正文 |
| `$font-sm` | 24rpx | 辅助说明 |

### 圆角与阴影

- 卡片：`$radius-lg`（28rpx）+ `$shadow-sm`
- 按钮：`$radius-full` 胶囊 + `$shadow-btn`
- Hero 卡片：`$shadow-lg` + 瓷砖纹样 `@mixin azulejo-pattern`

---

## 三、组件规范

### AppCard 变体

| variant | 场景 |
|---------|------|
| `default` | 常规模块 |
| `hero` | 首页用户区（红渐变 + 纹样） |
| `flat` | 列表容器（浅边框） |
| `accent` | 强调提示（暖金底） |

### AppButton 变体

| variant | 场景 |
|---------|------|
| `primary` | 主 CTA「开始今日学习」 |
| `outline` | 次要操作 |
| `success` | 答对后「下一词」 |
| `ghost` | 轻量操作 |

### SectionHeader

统一区块标题 + 副标题 + 可选 badge（如今日进度百分比）。

---

## 四、分页面规范

### 首页 `index.vue`

- Hero：头像 + ¡Hola! + 打卡环
- 学习目标：DELE Chip 选择
- 今日进度：渐变进度条 + 三列统计
- 考试路径 / 学习模式：列表卡片

### 学习页 `learn.vue`

- 全宽 1:1 配图区（无图时 emoji + 渐变）
- lemma + IPA + 词性 + DELE 徽章
- 四选项 A/B/C/D 字母标
- 答对/错颜色过渡 + 震动（`settings.vibrationEnabled`）

### 错题本 `review.vue`

- 暖色渐变页头 + 错题计数徽章
- 左侧等级色条列表项
- 空态插画文案

### 登录页 `login.vue`

- 顶部红渐变 + 瓷砖背景
- 小程序：微信一键登录
- H5：昵称注册/登录（演示）

### 统计页 `stats.vue`

- 近 30 日答题/活跃天（`studySummary`）
- 四宫格概览 + DELE 条形图 + 打卡热力图

---

## 五、小程序适配

- 底部 Tab 预留 `safe-area-inset-bottom`
- 导航栏背景 `#9b0f18`，文字白色
- 微信头像：`open-type="chooseAvatar"`
- 昵称：`type="nickname"` 输入框

---

## 六、文件索引

```
frontend/src/styles/
  theme.scss      # Design Tokens + mixins
  global.scss     # 页面容器、动画、标签

frontend/src/components/
  AppCard.vue
  AppButton.vue
  SectionHeader.vue
  DeleBadge.vue
  ProgressRing.vue
  LearnProgressBar.vue
```

---

## 七、个人版配置

`frontend/src/config/app.js`：

```javascript
showDevBanner: false,   // 隐藏内容组横幅
subjectType: 'personal',
orgName: '个人开发者',
contactEmail: 'your-email@example.com',  // 必填
```
