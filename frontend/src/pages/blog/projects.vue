<template>
  <view class="pm-page">
    <view class="gh-header">
      <GhIcon name="arrowLeftCircle" :size="22" color="var(--header-text)" class="back-icon" @click="goBack" />
      <GhIcon name="home" :size="18" color="var(--header-text)" class="home-icon" @click="goHome" />
    </view>

    <view class="pm-body">
      <!-- 公开项目 -->
      <view class="pm-section">
        <view class="section-title">
          <GhIcon name="repoPublic" :size="14" color="#2d6a4f" />
          <text>公开项目</text>
          <text class="count">{{ publicProjects.length }}</text>
        </view>
        <view v-if="!publicProjects.length" class="empty-tip">暂无公开项目</view>
        <view class="card-grid">
          <view
            v-for="p in publicProjects"
            :key="p.id"
            class="project-card"
            @click="openProject(p)"
          >
            <view class="card-top">
              <GhIcon name="briefcase" :size="16" color="#2d6a4f" />
              <text class="card-name">{{ p.name }}</text>
              <text v-if="!p.synced" class="unsynced-dot" title="未同步"></text>
              <view class="visibility-badge public">公开</view>
            </view>
            <view class="card-desc">{{ p.description || '暂无描述' }}</view>
            <view class="card-meta">
              <text class="meta-item">{{ countOf(p.id) }} 篇笔记</text>
              <text class="meta-item">{{ formatTime(p.updatedAt) }}</text>
            </view>
            <view class="card-actions" @click.stop>
              <view v-if="!isDefault(p.id)" class="gh-btn sm" @click="openMakePrivate(p)">转为私密</view>
              <view v-if="isDefault(p.id)" class="gh-tag">默认项目</view>
              <view v-if="!isDefault(p.id)" class="gh-btn sm danger" @click="openDelete(p)">删除</view>
            </view>
          </view>
        </view>
      </view>

      <!-- 私密项目 -->
      <view class="pm-section">
        <view class="section-title">
          <GhIcon name="repoPrivate" :size="14" color="#656d76" />
          <text>私密项目</text>
          <text class="count">{{ privateProjects.length }}</text>
        </view>
        <view v-if="!privateProjects.length" class="empty-tip">暂无私密项目</view>
        <view class="card-grid">
          <view
            v-for="p in privateProjects"
            :key="p.id"
            class="project-card"
            @click="openProject(p)"
          >
            <view class="card-top">
              <GhIcon name="briefcase" :size="16" color="#656d76" />
              <text class="card-name">{{ p.name }}</text>
              <text v-if="!p.synced" class="unsynced-dot" title="未同步"></text>
              <view class="visibility-badge private">私密</view>
            </view>
            <view class="card-desc">{{ p.description || '暂无描述' }}</view>
            <view class="card-meta">
              <text class="meta-item">{{ countOf(p.id) }} 篇笔记</text>
              <text class="meta-item">{{ formatTime(p.updatedAt) }}</text>
            </view>
            <view class="card-actions" @click.stop>
              <view v-if="!isDefault(p.id)" class="gh-btn sm" @click="openMakePublic(p)">转为公开</view>
              <view v-if="isDefault(p.id)" class="gh-tag">默认项目</view>
              <view v-if="!isDefault(p.id)" class="gh-btn sm danger" @click="openDelete(p)">删除</view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 弹窗：转公开/私密 -->
    <view v-if="modal" class="modal-mask" @click="closeModal">
      <view class="modal-box" @click.stop>
        <view class="modal-title">{{ modal.title }}</view>
        <view class="modal-desc">{{ modal.desc }}</view>
        <input
          v-if="modal.needPassword"
          class="gh-input"
          password
          type="text"
          :value="passwordInput"
          @input="onPwInput"
          placeholder="请输入密码确认"
        />
        <view v-if="modal.error" class="pw-error">{{ modal.error }}</view>
        <view class="modal-actions">
          <view class="gh-btn" @click="closeModal">取消</view>
          <view class="gh-btn primary" @click="confirmModal">确认</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Taro from '@tarojs/taro'
import { listProjects, updateProject, deleteProject, isDefaultProject } from '@/services/projects'
import { db } from '@/db'
import type { Project } from '@/types/models'
import GhIcon from '@/components/GhIcon'
import BrandIcon from '@/components/BrandIcon'
import AppHeaderActions from '@/components/AppHeaderActions'
import { bindAutoMobile } from '@/utils/mobile'

const keyword = ref('')
const headerActions = ref<any>(null)
function onSearchInput(e: any) {
  keyword.value = e.detail?.value ?? ''
}
function goSearch() {
  Taro.reLaunch({ url: `/pages/blog/index?kw=${encodeURIComponent(keyword.value)}` })
}

/**
 * 项目管理页（v1.1 S4）
 * 公开/私密分组卡片墙；属性变更和删除都在这里操作，需密码二次确认
 */
const projects = ref<Project[]>([])
const noteCounts = ref<Record<string, number>>({})

const publicProjects = computed(() => projects.value.filter(p => p.visibility === 'public'))
const privateProjects = computed(() => projects.value.filter(p => p.visibility !== 'public'))

const modal = ref<null | {
  title: string
  desc: string
  needPassword: boolean
  error?: string
  action: 'makePublic' | 'makePrivate' | 'delete'
  project: Project
}>(null)
const passwordInput = ref('')

function isDefault(id: string) {
  return isDefaultProject(id)
}

async function load() {
  projects.value = await listProjects()
  const counts: Record<string, number> = {}
  for (const p of projects.value) {
    counts[p.id] = await db.notes.where('projectId').equals(p.id).count()
  }
  noteCounts.value = counts
}

function countOf(id: string) {
  return noteCounts.value[id] ?? 0
}

function formatTime(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function goBack() {
  Taro.navigateBack()
}
function goHome() {
  Taro.reLaunch({ url: '/pages/blog/index' })
}

function openProject(p: Project) {
  Taro.navigateTo({ url: `/pages/blog/project?id=${p.id}` })
}

function openMakePublic(p: Project) {
  const needPw = !!p.synced
  modal.value = {
    title: '转为公开',
    desc: needPw
      ? `项目「${p.name}」下的所有内容将对访客可见。请输入密码确认。`
      : `项目「${p.name}」下的所有内容将对访客可见。`,
    needPassword: needPw,
    action: 'makePublic',
    project: p
  }
  passwordInput.value = ''
}

function openMakePrivate(p: Project) {
  modal.value = {
    title: '转为私密',
    desc: `项目「${p.name}」下的所有内容将不再对访客展示。`,
    needPassword: false,
    action: 'makePrivate',
    project: p
  }
}

function openDelete(p: Project) {
  // 未同步项目不需要密码，已同步项目才需要
  const needPw = !!p.synced
  modal.value = {
    title: '删除项目',
    desc: needPw
      ? `删除项目「${p.name}」将一并删除其中所有文件，此操作不可恢复。请输入密码确认。`
      : `删除项目「${p.name}」将一并删除其中所有文件，此操作不可恢复。`,
    needPassword: needPw,
    action: 'delete',
    project: p
  }
  passwordInput.value = ''
}

function onPwInput(e: any) {
  passwordInput.value = e.detail.value
}

function closeModal() {
  modal.value = null
  passwordInput.value = ''
}

async function confirmModal() {
  if (!modal.value) return
  const m = modal.value
  if (m.needPassword) {
    // 简单校验：当前项目密码或用户登录密码（v1.1 先用项目密码，后续接用户密码）
    if (m.project.password && passwordInput.value !== m.project.password) {
      m.error = '密码错误'
      return
    }
  }
  try {
    if (m.action === 'makePublic') {
      await updateProject(m.project.id, { visibility: 'public' })
      Taro.showToast({ title: '已转为公开', icon: 'success' })
    } else if (m.action === 'makePrivate') {
      await updateProject(m.project.id, { visibility: 'private' })
      Taro.showToast({ title: '已转为私密', icon: 'success' })
    } else if (m.action === 'delete') {
      await deleteProject(m.project.id)
      Taro.showToast({ title: '已删除', icon: 'success' })
    }
    closeModal()
    await load()
  } catch (err: any) {
    Taro.showToast({ title: err.message || '操作失败', icon: 'none' })
  }
}

onMounted(() => {
  load()
  bindAutoMobile(() => document.querySelector('.pm-page'))
})
</script>

<style scoped lang="scss">
.pm-page {
  min-height: 100vh;
  background: var(--bg, #fff);
  color: var(--fg, #24292f);
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.brand-name {
  font-weight: 700;
  font-size: 16px;
  color: var(--header-text);
}
.header-search {
  flex: 1;
  max-width: 400px;
  margin: 0 auto;
}
.search-input {
  width: 100%;
}
.back-icon, .home-icon {
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  &:hover { background: var(--bg-hover, rgba(0,0,0,0.06)); }
}
.gh-link {
  color: #0969da;
  cursor: pointer;
  font-size: 14px;
}
.pm-body {
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
}
.pm-section {
  margin-bottom: 28px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
  text-transform: uppercase;
  color: var(--text-secondary, #656d76);
  .count {
    background: var(--border, #d0d7de);
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 11px;
  }
}
.empty-tip {
  color: var(--text-secondary, #656d76);
  font-size: 13px;
  padding: 16px 0;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.project-card {
  border: 1px solid var(--border, #d0d7de);
  border-radius: 8px;
  padding: 14px;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    border-color: var(--accent, #2d6a4f);
    background: var(--accent-muted, rgba(45,106,79,0.08));
  }
}
.card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.card-name {
  font-weight: 600;
  font-size: 14px;
  flex: 1;
}
.unsynced-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d29922;
  display: inline-block;
  flex-shrink: 0;
}
.visibility-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  &.public {
    background: #dafbe1;
    color: #1a7f37;
  }
  &.private {
    background: #fff8c5;
    color: #9a6700;
  }
}
.card-desc {
  font-size: 12px;
  color: var(--text-secondary, #656d76);
  margin-bottom: 8px;
  line-height: 1.5;
}
.card-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--text-secondary, #656d76);
  margin-bottom: 10px;
}
.card-actions {
  display: flex;
  gap: 6px;
}
.gh-btn {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  border: 1px solid var(--border, #d0d7de);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  background: var(--bg, #fff);
  &.sm {
    padding: 3px 10px;
    font-size: 11px;
  }
  &.primary {
    background: #0969da;
    border-color: #0969da;
    color: #fff;
  }
  &.danger {
    color: #cf222e;
    border-color: rgba(207, 34, 46, 0.4);
  }
}
.gh-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  background: var(--border, #d0d7de);
  color: var(--text-secondary, #656d76);
}
.gh-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border, #d0d7de);
  border-radius: 6px;
  font-size: 14px;
  margin: 10px 0;
  box-sizing: border-box;
}
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-box {
  background: var(--bg, #fff);
  border-radius: 10px;
  padding: 20px;
  width: 90%;
  max-width: 380px;
}
.modal-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
}
.modal-desc {
  font-size: 13px;
  color: var(--text-secondary, #656d76);
  line-height: 1.5;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}
.pw-error {
  color: #cf222e;
  font-size: 12px;
  margin-top: 4px;
}
</style>
