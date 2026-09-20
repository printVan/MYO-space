<template>
  <view class="header-actions">
    <!-- 首页入口（工作区页使用，图标+悬浮提示"首页"） -->
    <view v-if="showBlogLink" class="gh-link blog-link" @click="goBlog" title="首页">
      <GhIcon name="boardPin" :size="18" />
    </view>

    <!-- 项目管理入口 -->
    <view class="icon-btn" title="项目管理" @click="goProjects">
      <GhIcon name="briefcase" :size="16" />
    </view>

    <!-- 账号入口：未登录显示登录，已登录显示头像 -->
    <view class="account-entry" @click="openAccountModal">
      <template v-if="!accountStore.isLoggedIn">
        <BrandIcon :size="18" variant="flat" color="currentColor" />
        <text class="account-text">登录</text>
      </template>
      <template v-else>
        <view class="account-avatar">{{ accountStore.initial }}</view>
        <text class="account-text">{{ accountStore.username }}</text>
      </template>
      <!-- 悬浮提示 -->
      <view class="account-tip">
        <template v-if="!accountStore.isLoggedIn">
          <view class="tip-title">登录后同步</view>
          <view class="tip-desc">内容已保存在本地浏览器，登录账号后可同步到云端备份。</view>
        </template>
        <template v-else>
          <view class="tip-title">{{ accountStore.username }}</view>
          <view class="tip-desc">{{ accountStore.syncStatusText }}。点击查看同步与账号。</view>
        </template>
      </view>
    </view>

    <!-- 设置入口 -->
    <view class="icon-btn" title="设置" @click="goSettings">
      <GhIcon name="gear" :size="16" />
    </view>

    <!-- 主题切换 -->
    <view class="icon-btn" :title="themeStore.isDark ? '切换浅色主题' : '切换深色主题'" @click="themeStore.toggle()">
      <GhIcon :name="themeStore.isDark ? 'sun' : 'moon'" :size="16" />
    </view>

    <!-- 账号弹窗：登录 / 注册 / 同步 -->
    <view v-if="modalOpen" class="modal-mask" @click.self="closeModal">
      <view class="modal account-modal">
        <view class="modal-title">{{ accountStore.isLoggedIn ? '账号与同步' : authMode === 'login' ? '登录' : '注册' }}</view>

        <!-- 未登录：登录 / 注册 Tab 切换 -->
        <view v-if="!accountStore.isLoggedIn" class="auth-tabs">
          <view class="auth-tab" :class="{ active: authMode === 'login' }" @click="authMode = 'login'">登录</view>
          <view class="auth-tab" :class="{ active: authMode === 'register' }" @click="authMode = 'register'">注册</view>
        </view>

        <!-- 已登录：同步状态 -->
        <template v-if="accountStore.isLoggedIn">
          <view class="account-info">
            <view class="account-avatar lg">{{ accountStore.initial }}</view>
            <view class="account-meta">
              <view class="account-name">{{ accountStore.username }}</view>
              <view class="account-status">{{ accountStore.syncStatusText }}</view>
            </view>
          </view>
          <view class="sync-hint">本地数据保存在浏览器 IndexedDB；点击同步将把全部内容备份到云端。</view>
          <view class="modal-actions">
            <view class="gh-btn" @click="onLogout">退出登录</view>
            <view class="gh-btn primary" :disabled="accountStore.syncing" @click="onSync">
              <GhIcon :name="accountStore.syncing ? 'refresh' : 'check'" :size="14" />
              {{ accountStore.syncing ? '同步中…' : '立即同步' }}
            </view>
          </view>
        </template>

        <!-- 未登录：登录/注册表单 -->
        <template v-else>
          <view class="modal-field">
            <text class="modal-label">用户名</text>
            <input class="gh-input" v-model="username" placeholder="至少 3 个字符" />
          </view>
          <view class="modal-field">
            <text class="modal-label">密码</text>
            <input class="gh-input" v-model="password" password placeholder="至少 8 位，含字母和数字" />
          </view>
          <view class="modal-field" v-if="accountError">
            <text class="form-error">{{ accountError }}</text>
          </view>
          <view class="modal-actions">
            <view class="gh-btn primary" :disabled="submitting" @click="onAuth">
              {{ submitting ? '处理中…' : authMode === 'login' ? '登录' : '注册并登录' }}
            </view>
          </view>
          <view class="local-hint">未登录也可完整使用，数据保存在本地浏览器。</view>
        </template>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Taro from '@tarojs/taro'
import { useAccountStore } from '@/stores/account'
import { useThemeStore } from '@/stores/theme'
import { message } from '@/utils/feedback'
import GhIcon from './GhIcon.vue'
import BrandIcon from './BrandIcon.vue'

/**
 * 顶栏操作区：项目管理 + 首页 + 账号（登录/同步）+ 设置 + 主题
 * 悬浮在账号入口上时显示提示（未登录提示本地保存与登录同步）
 */
const props = withDefaults(
  defineProps<{ showBlogLink?: boolean }>(),
  { showBlogLink: true }
)

const accountStore = useAccountStore()
const themeStore = useThemeStore()

const modalOpen = ref(false)
const authMode = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const accountError = ref('')
const submitting = ref(false)

function openAccountModal() {
  accountError.value = ''
  modalOpen.value = true
}
function closeModal() {
  if (accountStore.syncing || submitting.value) return
  modalOpen.value = false
}

async function onAuth() {
  const name = username.value.trim()
  const pwd = password.value
  if (name.length < 3) { accountError.value = '用户名至少 3 个字符'; return }
  if (pwd.length < 8) { accountError.value = '密码至少 8 个字符'; return }
  if (!/[A-Za-z]/.test(pwd) || !/\d/.test(pwd)) { accountError.value = '密码需同时包含字母和数字'; return }
  submitting.value = true
  accountError.value = ''
  try {
    if (authMode.value === 'login') {
      await accountStore.login(name, pwd)
    } else {
      await accountStore.register(name, pwd)
    }
    message.success(authMode.value === 'login' ? '登录成功' : '注册成功')
    // 登录后自动同步一次
    try {
      await accountStore.syncNow()
      message.success('已同步本地数据到云端')
      // 同步完成后整页刷新，让用户直接看到云端数据，不用手动 F5
      setTimeout(() => window.location.reload(), 600)
    } catch (e: any) {
      message.warning(`已登录，但同步失败：${e.message}`)
    }
    username.value = ''
    password.value = ''
  } catch (e: any) {
    accountError.value = e.message || '操作失败'
  } finally {
    submitting.value = false
  }
}

async function onSync() {
  try {
    await accountStore.syncNow()
    message.success(`同步完成（${accountStore.lastSyncCount} 条）`)
    // 同步完成后整页刷新，让用户直接看到云端数据
    setTimeout(() => window.location.reload(), 600)
  } catch (e: any) {
    message.error(`同步失败：${e.message}`)
  }
}

async function onLogout() {
  await accountStore.logout()
  message.success('已退出登录')
  closeModal()
}

function goSettings() {
  Taro.reLaunch({ url: '/pages/settings/index' })
}
function goBlog() {
  if (!props.showBlogLink) return
  Taro.reLaunch({ url: '/pages/blog/index' })
}
function goProjects() {
  Taro.navigateTo({ url: '/pages/blog/projects' })
}

defineExpose({ openAccountModal })
</script>

<style scoped lang="scss">
.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  flex-shrink: 0;
}

/* 公开博客图标入口 */
.blog-link {
  display: flex;
  align-items: center;
  padding: 4px;
  border-radius: 6px;
}
.blog-link:hover {
  background: rgba(255, 255, 255, 0.08);
}

/* 账号入口：无边框链接式，hover 提亮背景（深色顶栏下避免黑色边框） */
.account-entry {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--header-text);
  font-size: 13px;
}
.account-entry:hover {
  background: rgba(255, 255, 255, 0.08);
}
.account-text {
  white-space: nowrap;
}
.account-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6e40c9, #0969da);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.account-avatar.lg {
  width: 44px;
  height: 44px;
  font-size: 18px;
}

/* 悬浮提示气泡：固定白底深字，两种主题下都清晰可见 */
.account-tip {
  display: none;
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 220px;
  padding: 10px 12px;
  background: #ffffff;
  border: 1px solid #d1d9e0;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(1, 4, 9, 0.15);
  z-index: 260;
}
.account-entry:hover .account-tip {
  display: block;
}
.tip-title {
  font-size: 12px;
  font-weight: 700;
  color: #1f2328;
}
.tip-desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: #59636e;
}

/* 图标按钮 */
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  color: var(--header-text);
  cursor: pointer;
}
.icon-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

/* 弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal {
  width: 400px;
  max-width: 90vw;
  /* 弹框固定浅色（白底深字），不随主题变深；内部 var() 元素通过变量重定义自动适配 */
  --bg: #ffffff;
  --bg-subtle: #f6f8fa;
  --text: #1f2328;
  --text-secondary: #59636e;
  --text-muted: #8d959e;
  --border: #d1d9e0;
  --border-muted: #eaeef2;
  --accent: #0969da;
  --accent-muted: #ddf4ff;
  --hover: #f3f4f6;
  --danger: #cf222e;
  --success: #1a7f37;
  background: #ffffff;
  border-radius: 10px;
  border: 1px solid #d1d9e0;
  padding: 20px;
  color: #1f2328;
}
.modal-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}
.modal-field {
  margin-bottom: 12px;
}
.modal-label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.form-error {
  color: var(--danger);
  font-size: 12px;
}
/* 弹窗内输入框/按钮固定浅色（白底深字），不随主题变深 */
.modal .gh-input,
.modal :deep(.gh-input) {
  background: #ffffff;
  color: #1f2328;
  border-color: #d1d9e0;
}
.modal .gh-input::placeholder {
  color: #8d959e;
}
.modal .gh-btn:not(.primary) {
  background: #ffffff;
  color: #1f2328;
  border-color: #d1d9e0;
}
.modal .gh-btn:not(.primary):hover {
  background: #f6f8fa;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
}
/* 登录/注册 Tab */
.auth-tabs {
  display: flex;
  border: 1px solid var(--border, #d1d9e0);
  border-radius: 8px;
  overflow: hidden;
  margin: 12px 0 16px;
}
.auth-tab {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary, #57606a);
  background: transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}
.auth-tab.active {
  color: #fff;
  background: var(--primary, #2563eb);
}
.auth-tab:not(.active):hover {
  color: var(--primary, #2563eb);
  background: var(--bg-subtle, #f6f8fa);
}
.account-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0 12px;
}
.account-name {
  font-size: 15px;
  font-weight: 700;
}
.account-status {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}
.sync-hint {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
  background: var(--bg-subtle);
  border: 1px solid var(--border-muted);
  border-radius: 6px;
  padding: 10px 12px;
}
.local-hint {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}
</style>
