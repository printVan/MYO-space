<template>
  <view class="blog-page">
    <view class="gh-header">
      <view class="gh-link" @click="goBack">← 返回</view>
      <text class="header-title">{{ project?.name ?? '项目' }}</text>
      <view v-if="project?.password" class="gh-tag">密码保护</view>
    </view>

    <!-- 密码访问校验（§4.5.3） -->
    <view v-if="project?.password && !unlocked" class="password-box">
      <view class="pw-title">此项目受密码保护</view>
      <view class="pw-sub">请输入访问密码以浏览内容</view>
      <input class="gh-input pw-input" password type="text" :value="passwordInput" @input="onPwInput" placeholder="访问密码" />
      <view class="gh-btn primary" @click="tryUnlock">确认</view>
      <view v-if="pwError" class="pw-error">{{ pwError }}</view>
    </view>

    <view v-else-if="project" class="project-body">
      <view class="project-header">
        <view class="repo-title">{{ project.name }}</view>
        <view class="repo-desc">{{ project.description }}</view>
        <view class="repo-meta">
          <text v-for="t in project.topics" :key="t" class="gh-tag">{{ t }}</text>
          <text class="meta-item">{{ noteCount }} 篇公开笔记</text>
        </view>
      </view>

      <!-- 目录树与文件列表（公开可见部分） -->
      <view class="project-main">
        <view class="tree-panel">
          <view class="panel-title">目录</view>
          <view class="breadcrumb">
            <text class="gh-link" @click="enterFolder(null)">根目录</text>
            <text v-for="(crumb, i) in breadcrumbs" :key="i" class="crumb-item">
              <text class="crumb-sep">/</text>
              <text class="gh-link" @click="enterFolder(crumb.id)">{{ crumb.name }}</text>
            </text>
          </view>
          <FileTree
            :items="tree"
            :active-id="activeId"
            :expanded-ids="expandedIds"
            @toggle="onToggle"
            @select="onSelect"
          />
        </view>
        <view class="file-panel">
          <view class="panel-title">文件（{{ entries.length }}）</view>
          <view v-if="!entries.length" class="empty-tip">此目录暂无公开笔记</view>
          <view v-for="e in entries" :key="e.id" class="file-row" @click="onEntryClick(e)">
            <text class="file-icon">{{ e.kind === 'folder' ? '▸' : '·' }}</text>
            <text class="gh-link file-name">{{ e.name }}</text>
            <text v-if="e.kind === 'note' && e.meta?.updatedAt" class="file-time">
              {{ relativeTimeStr(e.meta.updatedAt) }}
            </text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Taro, { useRouter } from '@tarojs/taro'
import { getNote, listPublicNotes } from '@/services/notes'
import { buildProjectTree, listFolderEntries, type FileEntry, type TreeItem } from '@/services/folders'
import { getProject } from '@/services/projects'
import type { Project } from '@/types/models'
import { relativeTimeStr } from '@/utils/time'
import FileTree from '@/components/FileTree'
import { bindAutoMobile } from '@/utils/mobile'

/**
 * 公开项目页（§4.6.2）
 * 密码访问校验；目录树浏览公开笔记；访问路径：公开主页 → 项目 → 笔记
 */
const router = useRouter()
const projectId = String(router.params.id ?? '')

const project = ref<Project | null>(null)
const unlocked = ref(false)
const passwordInput = ref('')
const pwError = ref('')

const tree = ref<TreeItem[]>([])
const entries = ref<FileEntry[]>([])
const currentFolderId = ref<string | null>(null)
const expandedIds = ref<string[]>([])
const activeId = ref('')
const noteCount = ref(0)

const breadcrumbs = computed(() => {
  // 简化：只展示一层路径（由 entries 加载时记录）
  return []
})

async function load() {
  const p = await getProject(projectId)
  if (!p) {
    Taro.showToast({ title: '项目不存在', icon: 'none' })
    return
  }
  project.value = p
  noteCount.value = await countVisible()
  if (p.password) {
    // 有密码则等待解锁；会话内解锁状态保留
    unlocked.value = await getUnlocked(p.id)
    if (unlocked.value) await loadContent()
  } else {
    unlocked.value = true
    await loadContent()
  }
}

async function loadContent() {
  tree.value = await buildProjectTree(projectId)
  await loadEntries()
}

async function loadEntries() {
  // 公开项目页：文件夹展示全部，笔记只展示公开的（§4.5.2 私密笔记对外隐藏）
  const all = await listFolderEntries(projectId, currentFolderId.value)
  const result: FileEntry[] = []
  for (const e of all) {
    if (e.kind === 'folder') {
      result.push(e)
      continue
    }
    const note = await getNote(e.id)
    if (note && note.visibility === 'public') result.push(e)
  }
  entries.value = result
}

async function countVisible(): Promise<number> {
  const notes = await listPublicNotes(projectId)
  return notes.length
}

async function getUnlocked(id: string): Promise<boolean> {
  // 会话级解锁状态（仅内存）
  const state = (globalThis as any).__blogUnlocked
  return state ? state[id] === true : false
}

async function tryUnlock() {
  if (passwordInput.value === project.value?.password) {
    unlocked.value = true
    pwError.value = ''
    const state = (globalThis as any).__blogUnlocked || {}
    state[project.value.id] = true
    ;(globalThis as any).__blogUnlocked = state
    await loadContent()
  } else {
    pwError.value = '密码错误，请重试'
  }
}

function onPwInput(e: any) {
  passwordInput.value = e?.detail?.value ?? e?.target?.value ?? ''
}

function onToggle(id: string) {
  const idx = expandedIds.value.indexOf(id)
  if (idx >= 0) expandedIds.value.splice(idx, 1)
  else expandedIds.value.push(id)
}

async function onSelect(item: TreeItem) {
  if (item.kind !== 'note') return
  const note = await getNote(item.id)
  if (note && note.visibility !== 'public') {
    Taro.showToast({ title: '该笔记为私密笔记', icon: 'none' })
    return
  }
  Taro.navigateTo({ url: `/pages/blog/note?id=${item.id}` })
}

async function enterFolder(folderId: string | null) {
  currentFolderId.value = folderId
  await loadEntries()
}

async function onEntryClick(e: FileEntry) {
  if (e.kind === 'folder') {
    await enterFolder(e.id)
  } else {
    const note = await getNote(e.id)
    if (note && note.visibility !== 'public') {
      Taro.showToast({ title: '该笔记为私密笔记', icon: 'none' })
      return
    }
    Taro.navigateTo({ url: `/pages/blog/note?id=${e.id}` })
  }
}

function goBack() {
  Taro.navigateBack()
}

onMounted(() => {
  load()
  autoMobileOff = bindAutoMobile(() => document.querySelector('.blog-page'))
})

let autoMobileOff: (() => void) | null = null
</script>

<style scoped lang="scss">
.blog-page {
  min-height: 100vh;
}
.header-title {
  font-weight: 600;
  font-size: 15px;
}
.password-box {
  max-width: 420px;
  margin: 80px auto;
  padding: 32px 24px;
  border: 1px solid var(--border);
  border-radius: 8px;
  text-align: center;
}
.pw-title {
  font-size: 16px;
  font-weight: 600;
}
.pw-sub {
  margin: 8px 0 20px;
  color: var(--text-secondary);
  font-size: 13px;
}
.pw-input {
  margin-bottom: 16px;
  text-align: center;
}
.pw-error {
  margin-top: 12px;
  color: var(--danger);
  font-size: 13px;
}
.project-body {
  max-width: 980px;
  margin: 0 auto;
  padding: 24px 20px 64px;
}
.project-header {
  margin-bottom: 20px;
}
.repo-title {
  font-size: 24px;
  font-weight: 600;
}
.repo-desc {
  color: var(--text-secondary);
  margin-top: 4px;
}
.repo-meta {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.meta-item {
  font-size: 12px;
  color: var(--text-muted);
}
.project-main {
  display: flex;
  gap: 24px;
  border-top: 1px solid var(--border);
  padding-top: 20px;
}
/* 手机宽度自动单栏（设置页开关关闭时加 .no-auto-mobile 禁用） */
@media (max-width: 767px) {
  .blog-page:not(.no-auto-mobile) .project-main {
    flex-direction: column;
    gap: 16px;
  }
  .blog-page:not(.no-auto-mobile) .tree-panel {
    width: 100%;
  }
}
.tree-panel {
  width: 260px;
  flex-shrink: 0;
}
.file-panel {
  flex: 1;
  min-width: 0;
}
.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 10px;
}
.breadcrumb {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 10px;
  font-size: 13px;
}
.crumb-item {
  display: flex;
}
.crumb-sep {
  margin: 0 6px;
  color: var(--text-muted);
}
.empty-tip {
  color: var(--text-secondary);
  padding: 20px 0;
}
.file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border-muted);
}
.file-icon {
  color: var(--text-muted);
  width: 14px;
}
.file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-time {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}
</style>
