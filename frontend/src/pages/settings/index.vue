<template>
  <view class="settings-page">
    <view class="gh-header">
      <view class="brand">
        <BrandIcon :size="26" />
        <text class="brand-name">MYO Space</text>
      </view>
      <view class="gh-link workspace-link" @click="goWorkspace" title="工作台"><GhIcon name="penSquare" :size="18" /></view>
      <AppHeaderActions ref="headerActions" :show-blog-link="false" />
    </view>

    <view class="settings-container">
      <view class="settings-section">
        <view class="section-title">外观</view>
        <view class="setting-row">
          <view class="setting-label">
            <text class="label-title">主题</text>
            <text class="label-desc">深浅双主题</text>
          </view>
          <view class="theme-switch" @click="themeStore.toggle()">
            <view class="switch-track" :class="{ on: themeStore.isDark }">
              <view class="switch-thumb"></view>
            </view>
            <text class="switch-label">{{ themeStore.isDark ? '深色' : '浅色' }}</text>
          </view>
        </view>
        <view class="setting-row">
          <view class="setting-label">
            <text class="label-title">自动适配手机端</text>
            <text class="label-desc">开启后，手机浏览器打开时自动切换为移动布局；关闭则保持桌面布局</text>
          </view>
          <view class="theme-switch" @click="toggleAutoMobile">
            <view class="switch-track" :class="{ on: autoMobile }">
              <view class="switch-thumb"></view>
            </view>
            <text class="switch-label">{{ autoMobile ? '允许' : '不允许' }}</text>
          </view>
        </view>
      </view>

      <view class="settings-section">
        <view class="section-title">同步与账号</view>
        <view class="setting-row">
          <view class="setting-label">
            <text class="label-title">云端同步</text>
            <text class="label-desc">{{ accountStore.isLoggedIn ? `已登录 ${accountStore.username} · ${accountStore.syncStatusText}` : '未登录时全部数据保存在本地浏览器，完整功能可用。登录后开启云端增量同步。' }}</text>
          </view>
          <view class="gh-btn" @click="onAccountAction">
            {{ accountStore.isLoggedIn ? '同步 / 管理' : '登录' }}
          </view>
        </view>
        <view class="setting-row">
          <view class="setting-label">
            <text class="label-title">数据存储量</text>
            <text class="label-desc">{{ statsText }}</text>
          </view>
        </view>
      </view>

      <view class="settings-section">
        <view class="section-title">数据管理</view>
        <view class="setting-row">
          <view class="setting-label">
            <text class="label-title">清空本地数据</text>
            <text class="label-desc danger-text">删除全部项目、笔记、快照，不可恢复</text>
          </view>
          <view class="gh-btn danger" @click="onClear">清空</view>
        </view>
      </view>
    </view>
    <MobileLayoutToggle />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import Taro from '@tarojs/taro'
import { useThemeStore } from '@/stores/theme'
import { useAccountStore } from '@/stores/account'
import { db } from '@/db'
import AppHeaderActions from '@/components/AppHeaderActions'
import BrandIcon from '@/components/BrandIcon'
import GhIcon from '@/components/GhIcon'
import MobileLayoutToggle from '@/components/MobileLayoutToggle'
import { isAutoMobileEnabled, setAutoMobileEnabled, onAutoMobileChange } from '@/utils/mobile'

/**
 * 设置页（本地偏好配置 §3.2）
 * 主题、同步状态、数据管理
 */
const themeStore = useThemeStore()
const accountStore = useAccountStore()
const headerActions = ref<InstanceType<typeof AppHeaderActions> | null>(null)

const stats = ref({ projects: 0, notes: 0, snapshots: 0 })
const statsText = computed(
  () => `${stats.value.projects} 个项目 · ${stats.value.notes} 篇笔记 · ${stats.value.snapshots} 份快照`
)

/** 自动适配手机端开关（默认允许） */
const autoMobile = ref(isAutoMobileEnabled())
let offAuto: (() => void) | null = null

function toggleAutoMobile() {
  setAutoMobileEnabled(!autoMobile.value)
}

async function loadStats() {
  stats.value = {
    projects: await db.projects.count(),
    notes: await db.notes.count(),
    snapshots: await db.snapshots.count()
  }
}

function onAccountAction() {
  headerActions.value?.openAccountModal()
}

function goWorkspace() {
  Taro.reLaunch({ url: '/pages/workspace/index' })
}

function onClear() {
  Taro.showModal({
    title: '清空本地数据',
    content: '将删除全部项目、笔记、快照，此操作不可恢复。确定继续？',
    confirmText: '清空',
    confirmColor: '#cf222e'
  }).then(async (res) => {
    if (res.confirm) {
      await db.transaction('rw', db.projects, db.folders, db.notes, db.snapshots, db.annotations, db.preferences, async () => {
        await Promise.all([
          db.projects.clear(),
          db.folders.clear(),
          db.notes.clear(),
          db.snapshots.clear(),
          db.annotations.clear(),
          db.preferences.clear()
        ])
      })
      await loadStats()
      Taro.showToast({ title: '已清空', icon: 'success' })
    }
  })
}

onMounted(() => {
  loadStats()
  offAuto = onAutoMobileChange((enabled) => {
    autoMobile.value = enabled
  })
})

onUnmounted(() => {
  offAuto?.()
})
</script>

<style scoped lang="scss">
.settings-page {
  min-height: 100vh;
  background: var(--bg);
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.brand-name {
  font-weight: 700;
  font-size: 15px;
  color: var(--header-text);
}
.workspace-link {
  display: flex;
  align-items: center;
  padding: 4px;
  border-radius: 6px;
  transition: background 0.15s;
}
.workspace-link:hover {
  background: rgba(255, 255, 255, 0.08);
}
.settings-container {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 20px 64px;
}
.settings-section {
  margin-bottom: 24px;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 10px;
}
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 10px;
}
.setting-label {
  flex: 1;
  min-width: 0;
}
.label-title {
  display: block;
  font-weight: 600;
  font-size: 14px;
}
.label-desc {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}
.danger-text {
  color: var(--danger);
}
.theme-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.switch-track {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: var(--border);
  position: relative;
  transition: background 0.2s;
}
.switch-track.on {
  background: var(--accent);
}
.switch-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: left 0.2s;
}
.switch-track.on .switch-thumb {
  left: 22px;
}
.switch-label {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
