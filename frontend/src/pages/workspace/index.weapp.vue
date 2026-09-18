<template>
  <view class="mini-workspace">
    <!-- 项目选择 -->
    <view class="mini-header">
      <text class="mini-title">工作区</text>
      <view class="gh-btn sm" @click="onCreateProject">新建项目</view>
    </view>
    <scroll-view scroll-x class="project-scroll">
      <view class="project-scroll-inner">
        <view
          v-for="p in projectStore.projects"
          :key="p.id"
          class="mini-project-card"
          :class="{ active: p.id === projectStore.currentProjectId }"
          @click="switchProject(p.id)"
        >
          <text class="mini-project-name">{{ p.name }}</text>
          <text class="mini-project-vis">{{ p.visibility === 'public' ? '公开' : '私密' }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 文件列表 -->
    <view v-if="projectStore.currentProjectId" class="mini-body">
      <view class="mini-section-title">
        <text>{{ currentFolderName }}</text>
        <view class="mini-actions">
          <view class="gh-btn sm" @click="onNewNote">新建笔记</view>
          <view class="gh-btn sm" @click="onNewFolder">新建文件夹</view>
        </view>
      </view>
      <view class="mini-file-list">
        <view v-if="projectStore.currentFolderId" class="mini-file-row" @click="projectStore.enterFolder(null)">
          <text class="mini-file-icon">↑</text>
          <text>返回根目录</text>
        </view>
        <view
          v-for="e in projectStore.entries"
          :key="e.id"
          class="mini-file-row"
          @click="onEntryClick(e)"
        >
          <text class="mini-file-icon">{{ e.kind === 'folder' ? '▸' : '·' }}</text>
          <text class="mini-file-name">{{ e.name }}</text>
        </view>
      </view>

      <!-- 笔记编辑（精简模式：简单文本编辑 + 预览切换，§6） -->
      <view v-if="editorStore.currentNote" class="mini-editor-box">
        <view class="mini-editor-toolbar">
          <text class="mini-note-title">{{ editorStore.currentNote.title }}</text>
          <view class="gh-btn sm" @click="togglePreview">{{ previewMode ? '编辑' : '预览' }}</view>
        </view>
        <view v-if="!previewMode" class="mini-editor-area">
          <CodeMirrorEditor v-model="editorStore.content" :dark="false" />
        </view>
        <view v-else class="mini-preview-area">
          <MarkdownPreview :source="editorStore.content" />
        </view>
        <!-- 补充区查看 -->
        <AnnotationSection :note-id="editorStore.currentNote.id" :editable="false" />
      </view>
    </view>
    <view v-else class="mini-empty">请选择或新建一个项目</view>

    <!-- 新建项目弹窗 -->
    <view v-if="modal === 'newProject'" class="modal-mask" @click.self="closeModal">
      <view class="modal">
        <view class="modal-title">新建项目</view>
        <input class="gh-input" :value="newProjectName" placeholder="项目名称" @input="onNameInput" />
        <view class="modal-actions">
          <view class="gh-btn" @click="closeModal">取消</view>
          <view class="gh-btn primary" @click="confirmNewProject">创建</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Taro from '@tarojs/taro'
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'
import type { FileEntry } from '@/services/folders'
import CodeMirrorEditor from '@/components/CodeMirrorEditor'
import MarkdownPreview from '@/components/MarkdownPreview'
import AnnotationSection from '@/components/AnnotationSection'

/**
 * 微信小程序精简版工作区（§6 微信小程序）
 * 支持：浏览项目目录、阅读笔记、作者补充区查看、简单文本编辑、权限校验
 * 不实现：版本快照、各类导出功能（触发时引导跳转网页端）
 */
const projectStore = useProjectStore()
const editorStore = useEditorStore()
const modal = ref('')
const newProjectName = ref('')
const previewMode = ref(false)

const currentFolderName = computed(() => {
  const p = projectStore.currentProject
  return p ? p.name : ''
})

async function switchProject(id: string) {
  await editorStore.closeNote()
  await projectStore.openProject(id)
}

async function onEntryClick(e: FileEntry) {
  if (e.kind === 'folder') {
    await projectStore.enterFolder(e.id)
  } else {
    await editorStore.openNote(e.id)
  }
}

function togglePreview() {
  previewMode.value = !previewMode.value
}

function onCreateProject() {
  modal.value = 'newProject'
}

function closeModal() {
  modal.value = ''
}

function onNameInput(e: any) {
  newProjectName.value = e?.detail?.value ?? e?.target?.value ?? ''
}

async function confirmNewProject() {
  const name = newProjectName.value.trim()
  if (!name) {
    Taro.showToast({ title: '请输入项目名称', icon: 'none' })
    return
  }
  await projectStore.addProject({ name, visibility: 'private' })
  newProjectName.value = ''
  closeModal()
}

function onNewNote() {
  Taro.showModal({
    title: '新建笔记',
    editable: true,
    placeholderText: '笔记名称',
    success: async (res) => {
      if (res.confirm && res.content) {
        const note = await projectStore.addNote(res.content)
        if (note) await editorStore.openNote(note.id)
      }
    }
  })
}

function onNewFolder() {
  Taro.showModal({
    title: '新建文件夹',
    editable: true,
    placeholderText: '文件夹名称',
    success: async (res) => {
      if (res.confirm && res.content) {
        await projectStore.addFolder(res.content)
      }
    }
  })
}
</script>

<style scoped lang="scss">
.mini-workspace {
  min-height: 100vh;
  padding: 24rpx;
  box-sizing: border-box;
}
.mini-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}
.mini-title {
  font-size: 34rpx;
  font-weight: 700;
}
.project-scroll {
  white-space: nowrap;
  margin-bottom: 24rpx;
}
.project-scroll-inner {
  display: inline-flex;
  gap: 16rpx;
  padding: 4rpx;
}
.mini-project-card {
  display: inline-flex;
  flex-direction: column;
  gap: 4rpx;
  padding: 16rpx 24rpx;
  border: 1px solid var(--border);
  border-radius: 12rpx;
  background: var(--bg);
}
.mini-project-card.active {
  border-color: var(--accent);
  background: var(--accent-muted);
}
.mini-project-name {
  font-size: 26rpx;
  font-weight: 600;
  max-width: 200rpx;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mini-project-vis {
  font-size: 20rpx;
  color: var(--text-muted);
}
.mini-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  margin-bottom: 12rpx;
}
.mini-actions {
  display: flex;
  gap: 8rpx;
}
.mini-file-list {
  border: 1px solid var(--border);
  border-radius: 12rpx;
  margin-bottom: 24rpx;
}
.mini-file-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 20rpx 24rpx;
  border-bottom: 1px solid var(--border-muted);
}
.mini-file-row:last-child {
  border-bottom: none;
}
.mini-file-icon {
  color: var(--text-muted);
  width: 24rpx;
}
.mini-file-name {
  flex: 1;
  font-size: 26rpx;
}
.mini-empty {
  text-align: center;
  padding: 120rpx 0;
  color: var(--text-secondary);
}
.mini-editor-box {
  border: 1px solid var(--border);
  border-radius: 12rpx;
  overflow: hidden;
}
.mini-editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 20rpx;
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border);
}
.mini-note-title {
  font-weight: 600;
  font-size: 28rpx;
  max-width: 400rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mini-editor-area {
  height: 600rpx;
}
.mini-preview-area {
  min-height: 400rpx;
}
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(31, 35, 40, 0.5);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal {
  width: 560rpx;
  background: var(--bg);
  border-radius: 16rpx;
  padding: 32rpx;
}
.modal-title {
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 20rpx;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12rpx;
  margin-top: 24rpx;
}
</style>
