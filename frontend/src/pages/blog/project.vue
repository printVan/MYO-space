<template>
  <view class="blog-page">
    <view class="gh-header">
      <GhIcon name="arrowLeftCircle" :size="24" color="var(--header-text)" class="back-icon" @click="goBack" />
      <GhIcon name="home" :size="20" color="var(--header-text)" class="home-icon" @click="goHome" />
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

      <!-- 目录树与文件列表 -->
      <view class="project-main">
        <view class="tree-panel">
          <view class="panel-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>
            <text>目录</text>
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
          <view class="panel-title">
            文件（{{ entries.length }}）
            <text v-if="currentFolderId" class="back-btn" @click="goBackFolder">← 返回上一级</text>
          </view>
          <view v-if="!entries.length" class="empty-tip">此目录暂无笔记</view>
          <view v-for="e in entries" :key="e.id" class="file-row" @click="onEntryClick(e)">
            <text class="file-icon">{{ e.kind === 'folder' ? '▸' : '·' }}</text>
            <text class="gh-link file-name">{{ e.name }}</text>
            <text v-if="e.kind === 'note' && e.meta?.updatedAt" class="file-time">
              {{ relativeTimeStr(e.meta.updatedAt) }}
            </text>
            <GhIcon name="trash" :size="16" color="#2d6a4f" class="file-del" @click.stop="onDelete(e)" />
            <GhIcon name="move" :size="16" color="#2d6a4f" class="file-del" @click.stop="onMove(e)" />
          </view>
        </view>
      </view>
    </view>

    <!-- 移动弹窗 -->
    <view v-if="moveModal.show" class="modal-mask" @click="moveModal.show = false">
      <view class="move-pop" @click.stop>
        <view class="move-title">移动到</view>
        <view class="move-list">
          <view v-for="p in moveModal.targets" :key="p.id" class="move-item">
            <view class="move-row" @click="toggleMoveFolder(p.id)">
              <text class="move-caret">{{ moveModal.expanded === p.id ? '▾' : '▸' }}</text>
              <text class="move-name">{{ p.name }}</text>
              <text class="move-confirm" @click.stop="confirmMove(p.id, null)">选择</text>
            </view>
            <view v-if="moveModal.expanded === p.id" class="move-sub">
              <view v-for="f in moveModal.folders[p.id] || []" :key="f.id" class="move-sub-item" @click="confirmMove(p.id, f.id)">
                <text>{{ f.name }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
    <!-- 删除确认弹窗 -->
    <view v-if="deleteModal.show" class="modal-mask" @click="deleteModal.show = false">
      <view class="move-pop" @click.stop>
        <view class="move-title">确认删除</view>
        <view class="delete-msg">{{ deleteModal.msg }}</view>
        <view class="delete-actions">
          <text class="btn-cancel" @click="deleteModal.show = false">取消</text>
          <text class="btn-ok" @click="confirmDelete">删除</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Taro, { useRouter } from '@tarojs/taro'
import { getNote, listPublicNotes, deleteNote, moveNote } from '@/services/notes'
import { buildProjectTree, listFolderEntries, deleteFolder, type FileEntry, type TreeItem } from '@/services/folders'
import { getProject, listProjects } from '@/services/projects'
import type { Project } from '@/types/models'
import { relativeTimeStr } from '@/utils/time'
import FileTree from '@/components/FileTree'
import GhIcon from '@/components/GhIcon'
import { bindAutoMobile } from '@/utils/mobile'
import { db } from '@/db'
import { useAccountStore } from '@/stores/account'
const accountStore = useAccountStore()

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
const allFolders = ref<{ id: string; name: string }[]>([])
const currentFolderId = ref<string | null>(null)
const expandedIds = ref<string[]>([])
const activeId = ref('')
const noteCount = ref(0)

const moveModal = ref({
  show: false,
  targets: [] as Project[],
  folders: {} as Record<string, { id: string; name: string }[]>,
  expanded: '',
  file: null as FileEntry | null,
  needPw: false,
})
const deleteModal = ref({
  show: false,
  msg: '',
  file: null as FileEntry | null,
})
const totalCount = computed(() => {
  let count = 0
  const walk = (items: TreeItem[]) => {
    for (const it of items) {
      if (it.kind === 'note') count++
      walk(it.children)
    }
  }
  walk(tree.value)
  return count
})

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
  allFolders.value = await db.folders.where('projectId').equals(projectId).toArray()
  await loadEntries()
}

async function loadEntries() {
  // 项目页：未同步私密文件也能看到（作者自己），已同步私密对外隐藏
  const all = await listFolderEntries(projectId, currentFolderId.value)
  const result: FileEntry[] = []
  for (const e of all) {
    if (e.kind === 'folder') {
      result.push(e)
      continue
    }
    const note = await getNote(e.id)
    // 公开可看；未同步私密也可看（本地作者）；已同步私密对外隐藏
    const canView = accountStore.account || note.visibility === 'public' || !note.synced
    if (note && canView) result.push(e)
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
  if (item.kind !== 'note') {
    await enterFolder(item.id)
    activeId.value = item.id
    return
  }
  const note = await getNote(item.id)
  // 已同步私密对外隐藏，未同步私密可看
  if (note && !accountStore.account && note.visibility !== 'public' && note.synced) {
    Taro.showToast({ title: '该笔记为私密笔记', icon: 'none' })
    return
  }
  Taro.navigateTo({ url: `/pages/blog/note?id=${item.id}` })
}

async function enterFolder(folderId: string | null) {
  currentFolderId.value = folderId
  await loadEntries()
}

async function goBackFolder() {
  if (!currentFolderId.value) return
  // 查当前文件夹的父文件夹
  const f = await db.folders.get(currentFolderId.value)
  currentFolderId.value = f?.parentId ?? null
  await loadEntries()
}

async function onEntryClick(e: FileEntry) {
  if (e.kind === 'folder') {
    await enterFolder(e.id)
  } else {
    const note = await getNote(e.id)
    if (note && !accountStore.account && note.visibility !== 'public' && note.synced) {
      Taro.showToast({ title: '该笔记为私密笔记', icon: 'none' })
      return
    }
    Taro.navigateTo({ url: `/pages/blog/note?id=${e.id}` })
  }
}

function goBack() {
  Taro.navigateBack()
}
function goHome() {
  Taro.reLaunch({ url: '/pages/blog/index' })
}

// 收集一个目录下所有子孙目录 id（不含自身），用于整树迁移与防循环
async function collectDescendantFolderIds(rootFolderId: string): Promise<string[]> {
  const result: string[] = []
  const queue = [rootFolderId]
  while (queue.length) {
    const cur = queue.shift()!
    const kids = await db.folders.where('parentId').equals(cur).toArray()
    for (const k of kids) {
      result.push(k.id)
      queue.push(k.id)
    }
  }
  return result
}

async function onMove(e: FileEntry) {
  let vis: 'public' | 'private' = 'private'
  let synced = false
  let folderParentId: string | null = null
  if (e.kind === 'note') {
    const n = await getNote(e.id)
    vis = n?.visibility ?? 'private'
    synced = !!n?.synced
  } else {
    // 目录无独立可见性，跟随所属项目
    const folder = await db.folders.get(e.id)
    const proj = folder ? await db.projects.get(folder.projectId) : null
    vis = proj?.visibility ?? 'private'
    folderParentId = folder?.parentId ?? null
    const folderNotes = await db.notes.where('folderId').equals(e.id).toArray()
    synced = folderNotes.some(n => n.synced)
  }
  // 列出同属性项目
  const allProjects = await listProjects()
  let targets = allProjects.filter(p => p.visibility === vis)
  // 排除上一级：目录在项目根下（folderParentId=null）时，不允许移回本项目
  if (e.kind === 'folder' && folderParentId === null && project.value?.id) {
    targets = targets.filter(p => p.id !== project.value!.id)
  }
  if (!targets.length) {
    Taro.showToast({ title: '没有可移动的同属性项目', icon: 'none' })
    return
  }
  // 加载每个项目的文件夹
  const foldersMap: Record<string, { id: string; name: string }[]> = {}
  for (const p of targets) {
    let fs = await db.folders.where('projectId').equals(p.id).toArray()
    // 目录在某父目录下时，展开本项目排除其直接父目录（不能移回上一级目录）
    if (e.kind === 'folder' && folderParentId && p.id === project.value?.id) {
      fs = fs.filter(f => f.id !== folderParentId)
    }
    foldersMap[p.id] = fs
  }
  moveModal.value = {
    show: true,
    targets,
    folders: foldersMap,
    expanded: '',
    file: e,
    needPw: synced && vis === 'private',
  }
}

function toggleMoveFolder(pid: string) {
  moveModal.value.expanded = moveModal.value.expanded === pid ? '' : pid
}

async function confirmMove(pid: string, fid: string | null) {
  const m = moveModal.value
  if (!m.file) return
  // 不能移回自己的直接父级
  if (m.file.kind === 'note') {
    const n = await getNote(m.file.id)
    if (n && n.projectId === pid && n.folderId === fid) {
      Taro.showToast({ title: '不能移回原位置', icon: 'none' })
      return
    }
  } else {
    // 目录：禁止移动到自身或自己的子孙目录，避免循环
    const desc = await collectDescendantFolderIds(m.file.id)
    if (fid !== null && (fid === m.file.id || desc.includes(fid))) {
      Taro.showToast({ title: '不能移动到自身或其内部', icon: 'none' })
      return
    }
  }
  if (m.needPw) {
    const pwRes = await Taro.showModal({ title: '需要密码', editable: true, placeholderText: '请输入密码' })
    if (!pwRes.confirm) return
  }
  if (m.file.kind === 'note') {
    await moveNote(m.file.id, pid, fid)
  } else {
    // 整树迁移：主目录 + 所有子孙目录 + 所有文件一起改挂新项目
    const folderId = m.file.id
    await db.transaction('rw', [db.folders, db.notes], async () => {
      await db.folders.update(folderId, { projectId: pid, parentId: fid })
      const desc = await collectDescendantFolderIds(folderId)
      for (const cid of desc) {
        await db.folders.update(cid, { projectId: pid })
      }
      const allFolderIds = [folderId, ...desc]
      for (const fId of allFolderIds) {
        const ns = await db.notes.where('folderId').equals(fId).toArray()
        for (const n of ns) await db.notes.update(n.id, { projectId: pid })
      }
    })
  }
  m.show = false
  Taro.showToast({ title: '已移动', icon: 'success' })
  await loadContent()
}

async function onDelete(e: FileEntry) {
  let synced = false
  if (e.kind === 'note') {
    const n = await getNote(e.id)
    synced = !!n?.synced
  } else {
    const folderNotes = await db.notes.where('folderId').equals(e.id).toArray()
    synced = folderNotes.some(n => n.synced)
  }
  const needPw = synced && project.value?.visibility !== 'public'
  const msg = e.kind === 'folder'
    ? `删除目录「${e.name}」将一并删除其中所有文件，此操作不可恢复。`
    : `删除文件「${e.name}」？此操作不可恢复。`
  deleteModal.value = { show: true, msg, file: e }
}

async function confirmDelete() {
  const e = deleteModal.value.file
  if (!e) return
  deleteModal.value.show = false
  if (e.kind === 'folder') {
    await deleteFolder(e.id)
  } else {
    await deleteNote(e.id)
  }
  Taro.showToast({ title: '已删除', icon: 'success' })
  await loadContent()
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
.blog-page .gh-header {
  gap: 4px;
}
.back-icon, .home-icon {
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  &:hover { background: var(--bg-hover, rgba(0,0,0,0.06)); }
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
  color: #1f2328;
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
  background: var(--bg-subtle);
  border-radius: 8px;
  padding: 12px;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tree-panel .panel-title {
  justify-content: flex-start;
  gap: 6px;
}
.back-btn {
  font-size: 12px;
  color: #2d6a4f;
  cursor: pointer;
  font-weight: 400;
}
.folder-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.folder-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
  &.active {
    background: var(--accent-subtle, rgba(45, 106, 79, 0.1));
    color: #2d6a4f;
    font-weight: 500;
  }
  &:hover {
    background: var(--bg-hover, rgba(0,0,0,0.04));
  }
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
.file-del {
  flex-shrink: 0;
  cursor: pointer;
  transition: transform 0.15s ease, color 0.15s ease;
  color: #2d6a4f;
  &:hover {
    color: #1b4332;
    transform: scale(1.15);
  }
  &:active {
    transform: scale(0.95);
  }
}
.file-move {
  font-size: 12px;
  color: #2d6a4f;
  cursor: pointer;
  padding: 2px 8px;
  flex-shrink: 0;
}
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.move-pop {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  min-width: 280px;
  max-height: 400px;
  overflow-y: auto;
  box-shadow: 0 8px 30px rgba(0,0,0,0.15);
  font-family: "Comic Sans MS", "Chalkboard SE", "Segoe Print", cursive;
}
.move-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #24292f;
}
.move-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.move-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
  border-radius: 6px;
  cursor: pointer;
  &:hover { background: #f3f4f6; }
}
.move-caret {
  font-size: 10px;
  color: #656d76;
  width: 14px;
}
.move-name {
  flex: 1;
  font-size: 13px;
  color: #24292f;
}
.move-confirm {
  font-size: 11px;
  color: #2d6a4f;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
  &:hover { background: #d3f0e0; }
}
.move-sub {
  padding-left: 28px;
}
.move-sub-item {
  padding: 5px 8px;
  font-size: 12px;
  color: #59636e;
  border-radius: 4px;
  cursor: pointer;
  &:hover { background: #f3f4f6; }
}
.delete-msg {
  font-size: 13px;
  color: #59636e;
  margin-bottom: 16px;
  line-height: 1.6;
}
.delete-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.btn-cancel {
  padding: 6px 14px;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  color: #59636e;
  &:hover { background: #f3f4f6; }
}
.btn-ok {
  padding: 6px 14px;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  color: #fff;
  background: #cf222e;
}
</style>
