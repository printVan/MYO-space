<template>
  <view class="workspace" :class="{ 'mobile-mode': mobileMode }">
    <!-- GitHub 风格顶部导航（§5.5 三栏布局） -->
    <view class="gh-header">
      <view class="brand" @click="goBlog">
        <BrandIcon :size="26" />
        <text class="brand-name">MYO Space</text>
      </view>
      <text class="project-name">{{ currentProject ? currentProject.name : '未选择项目' }}</text>
      <view class="search-box">
        <input
          class="gh-input search-input"
          :value="searchKeyword"
          placeholder="全局搜索：标题 / 正文 / 标签"
          @input="onSearchInput"
        />
      </view>
      <AppHeaderActions :show-blog-link="false" />
    </view>

    <!-- 全局搜索结果下拉 -->
    <view v-if="searchResults.length && searchKeyword.trim()" class="search-pop">
      <view v-for="r in searchResults" :key="r.id" class="search-item" @click="jumpToResult(r)">
        <view class="search-title">{{ r.title }}</view>
        <view class="search-snippet">{{ r.snippet }}</view>
        <view class="search-meta">{{ r.projectName }} · {{ r.matchedBy.join(' / ') }}</view>
      </view>
    </view>

    <view class="workspace-body">
      <!-- 第一栏：项目切换 + 全局目录树抽屉（§5.5） -->
      <view
        v-if="!editorMaximized && !projectStore.sidebarCollapsed"
        class="sidebar"
        :class="{ 'm-drawer-open': mobileMode && activeDrawer === 'sidebar' }"
        :style="{ width: widths.sidebar + 'px' }"
      >
        <view class="panel-header">
          <text class="panel-title">项目</text>
          <view class="panel-tools">
            <view class="gh-btn sm" @click="openNewProjectModal">新建</view>
            <view class="panel-collapse" @click="projectStore.toggleSidebar()" title="收起项目栏">
              <GhIcon name="chevronLeft" :size="14" />
            </view>
          </view>
        </view>
        <scroll-view class="project-list" scroll-y>
          <view
            v-for="p in projectStore.projects"
            :key="p.id"
            class="project-item"
            :class="{ active: p.id === projectStore.currentProjectId }"
            @click="switchProject(p.id)"
          >
            <text class="project-icon">
              <GhIcon name="repo" :size="14" />
            </text>
            <text class="project-name-item">{{ p.name }}</text>
            <text class="project-vis">{{ p.visibility === 'public' ? '公开' : '私密' }}</text>
            <view class="row-menu" @click.stop>
              <text class="gh-link" @click="toggleProjectVisibility(p)">{{ p.visibility === 'public' ? '设为私密' : '设为公开' }}</text>
              <text class="gh-link danger" @click="confirmDeleteProject(p)">删除</text>
            </view>
          </view>
        </scroll-view>
        <view class="panel-header tree-title">
          <text class="panel-title">目录树</text>
          <view class="gh-btn sm" @click="projectStore.enterFolder(null)">根目录</view>
        </view>
        <scroll-view class="tree-area" scroll-y>
          <FileTree
            :items="projectStore.tree"
            :active-id="projectStore.currentNoteId"
            :expanded-ids="expandedIds"
            @toggle="onToggleTreeNode"
            @select="onSelectTreeNode"
          />
          <view v-if="!projectStore.tree.length" class="tree-empty">项目内暂无内容，在文件面板新建笔记</view>
        </scroll-view>
        <view class="resizer" @mousedown.prevent="startResize('sidebar', $event)"></view>
      </view>
      <view v-else-if="!editorMaximized" class="sidebar-folded" @click="projectStore.toggleSidebar()" title="展开项目栏">▸</view>

      <!-- 第二栏：当前项目文件列表抽屉（§5.5） -->
      <view
        v-if="!editorMaximized && !projectStore.filePanelCollapsed"
        class="file-panel"
        :class="{ 'm-drawer-open': mobileMode && activeDrawer === 'file' }"
        :style="{ width: widths.files + 'px' }"
      >
        <view class="panel-header">
          <text class="panel-title">{{ breadcrumbText }}</text>
          <view class="file-actions">
            <view class="gh-btn sm" @click="openNewFolderModal">+目录</view>
            <view class="gh-btn sm" @click="openNewNoteModal">+笔记</view>
            <view class="gh-btn sm" @click="showExportMenu">导出</view>
            <view class="panel-collapse" @click="projectStore.toggleFilePanel()" title="收起文件栏">
              <GhIcon name="chevronLeft" :size="14" />
            </view>
          </view>
        </view>
        <scroll-view class="file-list" scroll-y>
          <view v-if="!projectStore.currentProjectId" class="file-empty">请先选择或新建项目</view>
          <template v-else>
            <view v-if="projectStore.currentFolderId" class="up-row" @click="projectStore.enterFolder(null)">
              <GhIcon name="arrowUp" :size="14" />
              <text>根目录</text>
            </view>
            <view
              v-for="e in projectStore.entries"
              :key="e.id"
              class="file-row"
              :class="{ active: e.kind === 'note' && e.id === projectStore.currentNoteId }"
              @click="onEntryClick(e)"
            >
              <template v-if="e.kind === 'folder'">
                <GhIcon name="folder" :size="15" />
                <view class="file-main">
                  <text class="file-name">{{ e.name }}</text>
                  <text class="file-summary">{{ (e.meta?.noteCount ?? 0) }} 项</text>
                </view>
              </template>
              <template v-else>
                <GhIcon name="fileText" :size="15" />
                <view class="file-main">
                  <text class="file-name">
                    {{ e.name }}
                    <text v-if="e.meta?.pinned" class="pin-mark">置顶</text>
                  </text>
                  <text class="file-summary">{{ e.meta?.summary || '（空白笔记）' }}</text>
                  <text v-if="e.meta?.updatedAt" class="file-time">{{ relativeTimeStr(e.meta.updatedAt) }}</text>
                </view>
              </template>
              <view class="row-menu" @click.stop>
                <text class="gh-link" @click="onRenameEntry(e)">重命名</text>
                <text class="gh-link danger" @click="onDeleteEntry(e)">删除</text>
              </view>
            </view>
          </template>
        </scroll-view>
        <view class="resizer" @mousedown.prevent="startResize('files', $event)"></view>
      </view>
      <view v-else-if="!editorMaximized" class="file-folded" @click="projectStore.toggleFilePanel()" title="展开文件栏">▸</view>

      <!-- 第三栏：源码编辑 + 预览（§4.2），支持最大化 -->
      <view class="editor-area" :class="{ maximized: editorMaximized }">
        <template v-if="currentNote">
          <!-- 工具栏：可收缩 -->
          <view v-if="!toolbarCollapsed" class="editor-toolbar">
            <view class="toolbar-actions">
              <view class="gh-btn sm" @click="openRenameModal">重命名</view>
              <view class="gh-btn sm" @click="togglePin">{{ currentNote.pinned ? '取消置顶' : '置顶' }}</view>
              <view class="gh-btn sm" @click="toggleVisibility">{{ currentNote.visibility === 'public' ? '设为私密' : '设为公开' }}</view>
              <view class="gh-btn sm" @click="openSnapshotPanel">版本快照</view>
              <view class="gh-btn sm" @click="showNoteExportMenu">导出</view>
              <view class="gh-btn sm editor-max-btn" :title="editorMaximized ? '还原' : '最大化'" @click="editorMaximized = !editorMaximized">
                <GhIcon :name="editorMaximized ? 'minimize' : 'maximize'" :size="14" />
              </view>
              <view class="icon-btn toolbar-toggle" title="收起工具栏" @click="toolbarCollapsed = true">
                <GhIcon name="chevronDown" :size="15" />
              </view>
            </view>
            <text class="save-status">{{ saveStatus }}</text>
          </view>
          <view v-else class="toolbar-collapsed" title="展开工具栏" @click="toolbarCollapsed = false">
            <view class="icon-btn toolbar-toggle">
              <GhIcon name="chevronDown" :size="14" />
            </view>
          </view>
          <view class="editor-split" :class="{ stacked: stackedMode }">
            <view v-if="viewMode !== 'preview'" class="editor-pane">
              <CodeMirrorEditor v-model="editorStore.content" :dark="themeStore.isDark" />
            </view>
            <view v-if="viewMode !== 'edit' && !stackedMode" class="divider-vertical" @mousedown.prevent="startResize('editor', $event)"></view>
            <view v-if="viewMode !== 'edit'" class="preview-pane">
              <MarkdownPreview :source="editorStore.content" />
            </view>
          </view>
          <view class="view-switcher">
            <view class="gh-btn sm" :class="{ active: viewMode === 'split' }" @click="viewMode = 'split'">分栏</view>
            <view class="gh-btn sm" :class="{ active: viewMode === 'edit' }" @click="viewMode = 'edit'">编辑</view>
            <view class="gh-btn sm" :class="{ active: viewMode === 'preview' }" @click="viewMode = 'preview'">预览</view>
          </view>
          <view v-show="snapshotOpen" class="bottom-panel">
            <SnapshotPanel />
          </view>
          <view class="annotation-wrap">
            <AnnotationSection :note-id="currentNote.id" :editable="true" />
          </view>
        </template>
        <view v-else class="welcome">
          <view class="welcome-icon">
            <BrandIcon :size="52" />
          </view>
          <view class="welcome-title">欢迎使用 MYO Space</view>
          <view class="welcome-desc">选择或新建一个项目，然后开始编写 Markdown 笔记</view>
          <view class="welcome-actions">
            <view class="gh-btn primary" @click="openNewProjectModal">新建项目</view>
            <view class="gh-btn" @click="openNewNoteModal">新建笔记</view>
          </view>
        </view>
      </view>
    </view>

    <!-- 新建项目弹窗 -->
    <view v-if="modal === 'newProject'" class="modal-mask" @click.self="closeModal">
      <view class="modal">
        <view class="modal-title">新建项目</view>
        <view class="modal-field">
          <text class="modal-label">项目名称</text>
          <input class="gh-input" v-model="newProject.name" placeholder="例如 my-notes" />
        </view>
        <view class="modal-field">
          <text class="modal-label">描述</text>
          <input class="gh-input" v-model="newProject.description" placeholder="项目简介（可选）" />
        </view>
        <view class="modal-field">
          <text class="modal-label">可见性</text>
          <view class="radio-group">
            <view class="gh-btn sm" :class="{ active: newProject.visibility === 'private' }" @click="newProject.visibility = 'private'">私密</view>
            <view class="gh-btn sm" :class="{ active: newProject.visibility === 'public' }" @click="newProject.visibility = 'public'">公开</view>
          </view>
        </view>
        <view class="modal-field" v-if="newProject.visibility === 'public'">
          <text class="modal-label">访问密码（可选）</text>
          <input class="gh-input" v-model="newProject.password" placeholder="留空则无需密码" />
        </view>
        <view class="modal-field">
          <text class="modal-label">Topic 标签（逗号分隔）</text>
          <input class="gh-input" v-model="newProject.topics" placeholder="vue, notes, blog" />
        </view>
        <view class="modal-actions">
          <view class="gh-btn" @click="closeModal">取消</view>
          <view class="gh-btn primary" @click="confirmNewProject">创建</view>
        </view>
      </view>
    </view>

    <!-- 新建笔记弹窗 -->
    <view v-if="modal === 'newNote'" class="modal-mask" @click.self="closeModal">
      <view class="modal">
        <view class="modal-title">新建笔记</view>
        <view class="modal-field">
          <text class="modal-label">笔记名称（.md）</text>
          <input class="gh-input" v-model="newNoteTitle" placeholder="例如 readme" />
        </view>
        <view class="modal-actions">
          <view class="gh-btn" @click="closeModal">取消</view>
          <view class="gh-btn primary" @click="confirmNewNote">创建</view>
        </view>
      </view>
    </view>

    <!-- 新建文件夹弹窗 -->
    <view v-if="modal === 'newFolder'" class="modal-mask" @click.self="closeModal">
      <view class="modal">
        <view class="modal-title">新建文件夹</view>
        <view class="modal-field">
          <text class="modal-label">文件夹名称</text>
          <input class="gh-input" v-model="newFolderName" placeholder="文件夹名称" />
        </view>
        <view class="modal-actions">
          <view class="gh-btn" @click="closeModal">取消</view>
          <view class="gh-btn primary" @click="confirmNewFolder">创建</view>
        </view>
      </view>
    </view>

    <!-- 重命名弹窗 -->
    <view v-if="modal === 'rename'" class="modal-mask" @click.self="closeModal">
      <view class="modal">
        <view class="modal-title">重命名{{ renameTarget?.kind === 'project' ? '项目' : renameTarget?.kind === 'folder' ? '文件夹' : '笔记' }}</view>
        <view class="modal-field">
          <input class="gh-input" v-model="renameValue" />
        </view>
        <view class="modal-actions">
          <view class="gh-btn" @click="closeModal">取消</view>
          <view class="gh-btn primary" @click="confirmRename">保存</view>
        </view>
      </view>
    </view>

    <!-- 移动端抽屉遮罩（自动/手动移动模式下显示） -->
    <view v-if="activeDrawer !== 'none'" class="m-mask" @click="activeDrawer = 'none'"></view>

    <!-- 移动端悬浮按钮（FAB）：点击弹出 项目/文件/设置 入口（替代原底部导航栏） -->
    <view class="m-fab" @click="fabOpen = !fabOpen">
      <GhIcon :name="fabOpen ? 'close' : 'repo'" :size="22" />
    </view>
    <view v-if="fabOpen" class="m-fab-mask" @click="fabOpen = false"></view>
    <view v-if="fabOpen" class="m-fab-menu">
      <view class="m-fab-item" @click="onFabAction('sidebar')">
        <GhIcon name="repo" :size="16" />
        <text>项目</text>
      </view>
      <view class="m-fab-item" @click="onFabAction('file')">
        <GhIcon name="folder" :size="16" />
        <text>文件</text>
      </view>
      <view class="m-fab-item" @click="onFabAction('settings')">
        <GhIcon name="gear" :size="16" />
        <text>设置</text>
      </view>
    </view>

    <MobileLayoutToggle />
  </view>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Taro from '@tarojs/taro'
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'
import { useThemeStore } from '@/stores/theme'
import { usePreferenceStore } from '@/stores/preference'
import { globalSearch, type SearchResult } from '@/services/search'
import { exportNoteMd, exportNoteHtml, exportNotePdf, exportProjectMdZip, exportProjectHtmlZip } from '@/services/export'
import { formatTime, relativeTimeStr } from '@/utils/time'
import { message } from '@/utils/feedback'
import type { FileEntry, TreeItem } from '@/services/folders'
import FileTree from '@/components/FileTree'
import CodeMirrorEditor from '@/components/CodeMirrorEditor'
import MarkdownPreview from '@/components/MarkdownPreview'
import SnapshotPanel from '@/components/SnapshotPanel'
import AnnotationSection from '@/components/AnnotationSection'
import AppHeaderActions from '@/components/AppHeaderActions'
import GhIcon from '@/components/GhIcon'
import BrandIcon from '@/components/BrandIcon'
import MobileLayoutToggle from '@/components/MobileLayoutToggle'
import { isMobileMode, onMobileChange, bindAutoMobile } from '@/utils/mobile'

/**
 * Web 端工作区（§6 Web端：完整全部功能）
 * 三栏可折叠可拖拽布局；版本快照、全部导出功能可用
 */
const projectStore = useProjectStore()
const editorStore = useEditorStore()
const themeStore = useThemeStore()
const prefStore = usePreferenceStore()
const routeParams = Taro.useRouter().params as Record<string, string>

const widths = ref({ ...prefStore.panelWidths })
const expandedIds = ref<string[]>([])
const searchKeyword = ref('')
const searchResults = ref<SearchResult[]>([])
const saveStatus = ref('')
const snapshotOpen = ref(false)
const stackedMode = ref(false)
const viewMode = ref<'split' | 'edit' | 'preview'>('split')
/** 第三栏最大化：隐藏项目栏与文件栏，编辑区占满工作区 */
const editorMaximized = ref(false)
/** 编辑工具栏收缩状态：收起后只留一条展开入口 */
const toolbarCollapsed = ref(false)

/** 移动端自适应视图（底部按钮手动强制切换；手机宽度自动生效） */
const mobileMode = ref(isMobileMode())
/** 移动端抽屉：当前打开的栏（sidebar=项目+目录树 / file=文件列表） */
const activeDrawer = ref<'none' | 'sidebar' | 'file'>('none')
/** 移动端悬浮菜单是否展开 */
const fabOpen = ref(false)

/** 手动切换移动视图时调整布局状态，保证抽屉可渲染 */
function applyMobile(m: boolean) {
  mobileMode.value = m
  if (m) {
    if (editorMaximized.value) editorMaximized.value = false
    if (projectStore.sidebarCollapsed) projectStore.toggleSidebar()
    if (projectStore.filePanelCollapsed) projectStore.toggleFilePanel()
    activeDrawer.value = 'none'
  }
}

function toggleDrawer(name: 'sidebar' | 'file') {
  // 移动视图下抽屉依赖两栏渲染：若处于最大化状态先还原
  if (editorMaximized.value) editorMaximized.value = false
  // 修复抽屉打不开：栏被折叠时先展开，保证 v-if 渲染
  if (name === 'sidebar' && projectStore.sidebarCollapsed) projectStore.toggleSidebar()
  if (name === 'file' && projectStore.filePanelCollapsed) projectStore.toggleFilePanel()
  activeDrawer.value = activeDrawer.value === name ? 'none' : name
}

/** FAB 菜单动作：打开抽屉或跳转设置 */
function onFabAction(action: 'sidebar' | 'file' | 'settings') {
  fabOpen.value = false
  if (action === 'settings') {
    goSettings()
    return
  }
  toggleDrawer(action)
}

function goSettings() {
  void Taro.navigateTo({ url: '/pages/settings/index' })
}

// 弹窗
const modal = ref('')
const newProject = ref({ name: '', description: '', visibility: 'private' as 'public' | 'private', password: '', topics: '' })
const newNoteTitle = ref('')
const newFolderName = ref('')
const renameTarget = ref<{ kind: 'project' | 'folder' | 'note'; id: string } | null>(null)
const renameValue = ref('')

const currentProject = computed(() => projectStore.currentProject)
const currentNote = computed(() => editorStore.currentNote)

const breadcrumbText = computed(() => {
  const p = projectStore.currentProject
  if (!p) return '文件'
  return p.name
})

// ---- 目录树 ----
function onToggleTreeNode(id: string) {
  const idx = expandedIds.value.indexOf(id)
  if (idx >= 0) expandedIds.value.splice(idx, 1)
  else expandedIds.value.push(id)
}

async function onSelectTreeNode(item: TreeItem) {
  if (item.kind !== 'note') return
  await openNote(item.id)
}

// ---- 笔记打开 ----
async function openNote(noteId: string) {
  await editorStore.openNote(noteId)
  projectStore.openNote(noteId)
  snapshotOpen.value = false
}

async function onEntryClick(e: FileEntry) {
  if (e.kind === 'folder') {
    await projectStore.enterFolder(e.id)
  } else {
    await openNote(e.id)
  }
}

async function switchProject(id: string) {
  if (id === projectStore.currentProjectId) return
  await editorStore.closeNote()
  await projectStore.openProject(id)
}

/** 切换项目公开/私密 */
async function toggleProjectVisibility(p: { id: string; name: string; visibility: 'public' | 'private' }) {
  const next = p.visibility === 'public' ? 'private' : 'public'
  await projectStore.editProject(p.id, { visibility: next })
  message.success(next === 'public' ? '已设为公开' : '已设为私密')
}

/** 删除项目（含全部目录/笔记/快照/补充区），需二次确认 */
function confirmDeleteProject(p: { id: string; name: string }) {
  Taro.showModal({
    title: '删除项目',
    content: `确定删除项目「${p.name}」吗？项目内的全部笔记、目录、快照将一并删除，且无法恢复。`,
    confirmText: '删除',
    confirmColor: '#d1242f',
    success: async (res) => {
      if (!res.confirm) return
      if (projectStore.currentProjectId === p.id) await editorStore.closeNote()
      await projectStore.removeProject(p.id)
      message.success('项目已删除')
    }
  })
}

// ---- 弹窗操作 ----
function openNewProjectModal() { modal.value = 'newProject' }
function openNewNoteModal() {
  if (!projectStore.currentProjectId) {
    message.warning('请先创建或选择项目')
    return
  }
  modal.value = 'newNote'
}
function openNewFolderModal() {
  if (!projectStore.currentProjectId) {
    message.warning('请先创建或选择项目')
    return
  }
  modal.value = 'newFolder'
}

function closeModal() { modal.value = '' }

async function confirmNewProject() {
  const name = newProject.value.name.trim()
  if (!name) { message.warning('请输入项目名称'); return }
  const topics = newProject.value.topics.split(',').map((t) => t.trim()).filter(Boolean)
  await projectStore.addProject({
    name,
    description: newProject.value.description.trim(),
    visibility: newProject.value.visibility,
    password: newProject.value.password.trim() || null,
    topics
  })
  newProject.value = { name: '', description: '', visibility: 'private', password: '', topics: '' }
  closeModal()
  message.success('项目已创建')
}

async function confirmNewNote() {
  const title = newNoteTitle.value.trim()
  if (!title) { message.warning('请输入笔记名称'); return }
  const note = await projectStore.addNote(title)
  newNoteTitle.value = ''
  closeModal()
  if (note) await openNote(note.id)
}

async function confirmNewFolder() {
  const name = newFolderName.value.trim()
  if (!name) { message.warning('请输入文件夹名称'); return }
  await projectStore.addFolder(name)
  newFolderName.value = ''
  closeModal()
}

// ---- 重命名 ----
function onRenameEntry(e: FileEntry) {
  renameTarget.value = { kind: e.kind === 'folder' ? 'folder' : 'note', id: e.id }
  renameValue.value = e.name.replace(/\.md$/i, '')
  modal.value = 'rename'
}

function openRenameModal() {
  if (!currentNote.value) return
  renameTarget.value = { kind: 'note', id: currentNote.value.id }
  renameValue.value = currentNote.value.title
  modal.value = 'rename'
}

async function confirmRename() {
  const value = renameValue.value.trim()
  if (!value || !renameTarget.value) return
  const target = renameTarget.value
  if (target.kind === 'note') await projectStore.renameNoteById(target.id, value)
  else if (target.kind === 'folder') await projectStore.renameFolderById(target.id, value)
  else if (target.kind === 'project') {
    await projectStore.editProject(target.id, { name: value })
  }
  closeModal()
}

function onDeleteEntry(e: FileEntry) {
  const name = e.name
  if (e.kind === 'folder') {
    Taro.showModal({
      title: '删除文件夹',
      content: `删除「${name}」及其全部子内容？此操作不可恢复。`,
      confirmText: '删除',
      confirmColor: '#cf222e'
    }).then(async (res) => {
      if (res.confirm) {
        await projectStore.removeFolder(e.id)
        message.success('已删除')
      }
    })
  } else {
    Taro.showModal({
      title: '删除笔记',
      content: `删除「${name}」及其全部快照？此操作不可恢复。`,
      confirmText: '删除',
      confirmColor: '#cf222e'
    }).then(async (res) => {
      if (res.confirm) {
        await editorStore.closeNote()
        await projectStore.removeNote(e.id)
        message.success('已删除')
      }
    })
  }
}

// ---- 笔记操作 ----
async function togglePin() {
  if (!currentNote.value) return
  const next = !currentNote.value.pinned
  await projectStore.togglePin(currentNote.value.id, next)
  message.success(next ? '已置顶' : '已取消置顶')
}

async function toggleVisibility() {
  if (!currentNote.value) return
  const next = currentNote.value.visibility === 'public' ? 'private' : 'public'
  await editorStore.setNoteVisibility(currentNote.value.id, next)
  message.success(next === 'public' ? '已设为公开' : '已设为私密')
}

function openSnapshotPanel() {
  snapshotOpen.value = !snapshotOpen.value
}

// ---- 导出（§4.7） ----
function showExportMenu() {
  if (!projectStore.currentProjectId) return
  Taro.showActionSheet({
    itemList: ['导出全部 Markdown（zip）', '导出静态 HTML 站点（zip）'],
    success: (res) => {
      const actions = [exportProjectMdZip, exportProjectHtmlZip]
      const fn = actions[res.tapIndex]
      if (fn) {
        fn(projectStore.currentProjectId)
          .then(() => message.success('导出完成'))
          .catch((e) => message.error(`导出失败：${e?.message || JSON.stringify(e)}`))
      }
    },
    fail: () => { /* 用户取消，静默 */ }
  })
}

function showNoteExportMenu() {
  if (!currentNote.value) return
  Taro.showActionSheet({
    itemList: ['导出 .md', '导出静态 HTML', '导出 PDF'],
    success: (res) => {
      const note = currentNote.value!
      if (res.tapIndex === 0) exportNoteMd(note)
      else if (res.tapIndex === 1) exportNoteHtml(note)
      else if (res.tapIndex === 2) {
        exportNotePdf(note)
          .then(() => message.success('PDF 导出完成'))
          .catch((e) => message.error(`PDF 导出失败：${e.message}`))
      }
    },
    fail: () => { /* 用户取消，静默 */ }
  })
}

// ---- 全局搜索（§4.9） ----
let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput(e: any) {
  searchKeyword.value = e?.detail?.value ?? e?.target?.value ?? ''
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    const kw = searchKeyword.value.trim()
    if (!kw) { searchResults.value = []; return }
    searchResults.value = await globalSearch(kw)
  }, 300)
}

async function jumpToResult(r: SearchResult) {
  if (r.projectId !== projectStore.currentProjectId) {
    await projectStore.openProject(r.projectId)
  }
  await openNote(r.id)
  searchKeyword.value = ''
  searchResults.value = []
}

// ---- 三栏拖拽（§5.5） ----
function startResize(which: 'sidebar' | 'files' | 'editor', e: MouseEvent) {
  e.preventDefault()
  const startX = e.clientX
  const move = (ev: MouseEvent) => {
    const delta = ev.clientX - startX
    if (which === 'sidebar') {
      widths.value.sidebar = Math.min(420, Math.max(180, prefStore.panelWidths.sidebar + delta))
    } else if (which === 'files') {
      widths.value.files = Math.min(460, Math.max(200, prefStore.panelWidths.files + delta))
    }
    void prefStore.setPanelWidths({ ...widths.value })
  }
  const up = () => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
  }
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}

// ---- 自适应（窄屏上下分栏，§4.2.2） ----
function onResize() {
  stackedMode.value = window.innerWidth < 1024
}

// ---- 自动保存状态提示 ----
let statusTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => editorStore.content,
  () => {
    saveStatus.value = '编辑中…'
    if (statusTimer) clearTimeout(statusTimer)
    statusTimer = setTimeout(() => {
      saveStatus.value = '已自动保存 ' + formatTime(Date.now())
    }, 3500)
  }
)

function goBlog() {
  Taro.reLaunch({ url: '/pages/blog/index' })
}

onMounted(async () => {
  onResize()
  window.addEventListener('resize', onResize)
  saveStatus.value = '本地优先 · 已就绪'
  mobileOff = onMobileChange(applyMobile)
  autoMobileOff = bindAutoMobile(() => document.querySelector('.workspace'))
  // 从公开阅读页跳转编辑：打开指定项目与笔记
  const pid = routeParams.projectId
  const nid = routeParams.noteId
  if (pid && nid) {
    try {
      await projectStore.openProject(pid)
      await openNote(nid)
    } catch {
      /* 项目/笔记不存在时保持默认工作区 */
    }
  }
})

let mobileOff: (() => void) | null = null
let autoMobileOff: (() => void) | null = null

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  mobileOff?.()
  autoMobileOff?.()
  void editorStore.closeNote()
})
</script>

<style scoped lang="scss">
.workspace {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  flex-shrink: 0;
}
.brand-name {
  font-weight: 700;
  font-size: 15px;
  color: var(--header-text);
}
.project-name {
  font-size: 14px;
  font-weight: 600;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--header-text);
  opacity: 0.85;
}
.search-box {
  flex: 1;
  max-width: 320px;
  margin-left: 8px;
}
.search-input {
  height: 30px;
}

.workspace-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 第一栏 */
.sidebar {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  /* GitHub 面板：浅灰底，内容卡片白 */
  background: var(--bg-subtle);
  position: relative;
  min-width: 180px;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.panel-tools {
  display: flex;
  align-items: center;
  gap: 6px;
}
/* 面板收起按钮 */
.panel-collapse {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 24px;
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.panel-collapse:hover {
  background: var(--hover);
  color: var(--text);
}
.panel-title {
  font-size: 13px;
  font-weight: 600;
}
.project-list {
  max-height: 30%;
  border-bottom: 1px solid var(--border);
  overflow-y: auto;
}
.project-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
}
.project-item:hover {
  background: var(--hover);
}
.project-item.active {
  background: var(--accent-muted);
}
.project-icon {
  color: var(--text-muted);
}
.project-name-item {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.project-vis {
  font-size: 11px;
  color: var(--text-muted);
}
.tree-title {
  border-bottom: 1px solid var(--border);
}
.tree-area {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
}
.tree-empty {
  padding: 16px;
  color: var(--text-secondary);
  font-size: 12px;
}
.sidebar-folded,
.file-folded {
  width: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid var(--border);
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 14px;
  flex-shrink: 0;
}
.sidebar-folded:hover,
.file-folded:hover {
  background: var(--hover);
}

/* 第二栏 */
.file-panel {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  background: var(--bg-subtle);
  position: relative;
  min-width: 200px;
}
.file-actions {
  display: flex;
  gap: 4px;
}
.file-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}
.file-empty {
  padding: 20px;
  color: var(--text-secondary);
  font-size: 12px;
}
.up-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  color: var(--accent);
  cursor: pointer;
  font-size: 13px;
  margin-bottom: 6px;
}
.up-row:hover {
  background: var(--hover);
}
.file-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 13px;
  background: var(--bg);
  border: 1px solid var(--border-muted);
  border-radius: 6px;
  margin-bottom: 6px;
  transition: border-color 0.15s;
}
.file-row:hover {
  border-color: var(--border);
}
.file-row.active {
  border-color: var(--accent);
  background: var(--accent-muted);
}
.file-icon {
  color: var(--text-muted);
  width: 14px;
  flex-shrink: 0;
  line-height: 20px;
}
.file-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.file-name {
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-summary {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-time {
  font-size: 11px;
  color: var(--text-muted);
}
.pin-mark {
  font-size: 10px;
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 8px;
  padding: 0 4px;
  margin-left: 6px;
  vertical-align: 1px;
}
.row-menu {
  display: none;
  gap: 8px;
  font-size: 12px;
}
.file-row:hover .row-menu,
.project-item:hover .row-menu {
  display: flex;
}
.danger {
  color: var(--danger);
}

/* 第三栏 */
.editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg);
}
.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
  position: relative;
}
.toolbar-actions {
  display: flex;
  gap: 6px;
  /* 按钮位于左侧但向右偏移，不与左边缘贴齐 */
  margin-left: 28px;
}
/* 工具栏收起入口（细条） */
.toolbar-collapsed {
  display: flex;
  align-items: center;
  padding: 3px 14px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}
.toolbar-collapsed .toolbar-toggle {
  margin-left: 28px;
}
.toolbar-toggle {
  color: var(--text-secondary);
  border-radius: 6px;
}
.toolbar-toggle:hover {
  background: var(--hover);
  color: var(--accent);
}
.save-status {
  font-size: 12px;
  color: var(--text-muted);
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
}
.editor-area {
  position: relative;
}
/* 最大化/还原按钮：与工具栏其他按钮同排对齐 */
.editor-max-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.editor-area.maximized {
  flex: 1;
  min-width: 0;
}
.editor-split {
  display: flex;
  flex: 1;
  overflow: hidden;
}
.editor-split.stacked {
  flex-direction: column;
}
.editor-pane,
.preview-pane {
  flex: 1;
  min-width: 0;
  overflow: auto;
}
.divider-vertical {
  width: 6px;
  cursor: col-resize;
  background: var(--border-muted);
  flex-shrink: 0;
}
.divider-vertical:hover {
  background: var(--accent);
}
.view-switcher {
  display: flex;
  gap: 6px;
  padding: 6px 14px;
  border-top: 1px solid var(--border-muted);
}
.view-switcher .active {
  border-color: var(--accent);
  color: var(--accent);
}
.bottom-panel {
  height: 260px;
  border-top: 1px solid var(--border);
}
.annotation-wrap {
  border-top: 1px solid var(--border);
  overflow-y: auto;
  max-height: 45%;
}

/* 欢迎 */
.welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary);
}
.welcome-icon {
  font-size: 44px;
}
.welcome-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}
.welcome-desc {
  font-size: 13px;
}
.welcome-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

/* 拖拽条 */
.resizer {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
}
.resizer:hover {
  background: var(--accent);
  opacity: 0.4;
}

/* 搜索下拉 */
.search-pop {
  position: absolute;
  top: 56px;
  left: 50%;
  transform: translateX(-50%);
  width: 480px;
  max-height: 360px;
  overflow-y: auto;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  z-index: 200;
  box-shadow: 0 8px 24px rgba(140, 149, 159, 0.2);
}
.search-item {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-muted);
  cursor: pointer;
}
.search-item:hover {
  background: var(--hover);
}
.search-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--accent);
}
.search-snippet {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}
.search-meta {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
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
  /* 弹框固定浅色（白底深字），不随主题变深 */
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
.radio-group {
  display: flex;
  gap: 8px;
}
.gh-btn.active {
  border-color: var(--accent);
  color: var(--accent);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

/* 弹窗内输入框/按钮固定浅色（白底深字），不随主题变深 */
.modal .gh-input {
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

/* ============ 移动端自适应视图 ============
   1) 手机宽度（≤767px）自动进入移动布局（无需任何操作）
   2) 右下角悬浮按钮可手动强制移动/桌面视图（.mobile-mode 覆盖）
*/
@mixin mobile-drawer-layout {
  .sidebar,
  .file-panel {
    position: fixed;
    top: 54px;
    bottom: 0;
    width: 84vw !important;
    max-width: 340px;
    z-index: 90;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
    transition: transform 0.25s ease;
  }

  .sidebar {
    left: 0;
    transform: translateX(-102%);
  }

  .sidebar.m-drawer-open {
    transform: translateX(0);
  }

  .file-panel {
    right: 0;
    transform: translateX(102%);
  }

  .file-panel.m-drawer-open {
    transform: translateX(0);
  }

  .sidebar-folded,
  .file-folded {
    display: none !important;
  }

  .editor-area {
    /* 为右下角悬浮按钮留出空间，避免遮挡编辑内容 */
    padding-bottom: 92px;
  }

  .workspace-body {
    overflow: hidden;
  }
}

@mixin mobile-nav-show {
  .m-fab {
    display: flex;
  }

  .m-mask {
    display: block;
  }
}

/* 手动强制移动视图（右下角悬浮按钮） */
.workspace.mobile-mode {
  @include mobile-drawer-layout;
  @include mobile-nav-show;
}

/* 手机宽度自动移动布局（设置页开关关闭时加 .no-auto-mobile 禁用） */
@media (max-width: 767px) {
  .workspace:not(.no-auto-mobile) {
    @include mobile-drawer-layout;
    @include mobile-nav-show;

    /* 顶部导航窄屏适配：搜索框换行占满，项目名隐藏 */
    .gh-header {
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 10px;
    }

    .search-box {
      order: 10;
      width: 100%;
      max-width: none;
      margin-left: 0;
    }

    .project-name {
      display: none;
    }
  }
}

/* 移动端悬浮按钮（FAB）：默认隐藏，移动模式下显示；位于左下角避免与视图切换按钮重叠 */
.m-fab {
  display: none;
  position: fixed;
  left: 18px;
  bottom: 24px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  z-index: 96;
  cursor: pointer;
  transition: transform 0.15s;
}

.m-fab:active {
  transform: scale(0.92);
}

/* FAB 弹出菜单 */
.m-fab-menu {
  position: fixed;
  left: 18px;
  bottom: 88px;
  min-width: 132px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
  z-index: 97;
  overflow: hidden;
}

.m-fab-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s;
}

.m-fab-item + .m-fab-item {
  border-top: 1px solid var(--border-muted);
}

.m-fab-item:hover {
  background: var(--bg-subtle);
}

/* FAB 菜单遮罩（点击关闭，层级在抽屉之上、FAB 之下） */
.m-fab-mask {
  position: fixed;
  inset: 0;
  z-index: 95;
}

.m-mask {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 80;
}
</style>
