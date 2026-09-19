<template>
  <view class="snapshot-panel">
    <view class="sp-header">
      <text class="sp-title">历史版本</text>
      <view v-if="!loggedIn" class="gh-btn sm" @click="promptLogin">登录后查看</view>
      <view v-else class="gh-btn sm" @click="onRefresh">刷新</view>
    </view>

    <view v-if="!loggedIn" class="sp-empty">
      登录后可查看历史版本并回退。
    </view>

    <scroll-view v-else-if="editor.snapshots.length" class="sp-list" scroll-y>
      <view
        v-for="(snap, idx) in editor.snapshots"
        :key="snap.id"
        class="sp-item"
        @click="onRollback(snap, idx)"
      >
        <view class="sp-item-top">
          <text class="sp-time">{{ formatTime(snap.createdAt) }}</text>
          <text v-if="idx === 0" class="sp-badge">当前</text>
        </view>
        <view class="sp-msg">{{ snap.message || '自动保存' }}</view>
      </view>
    </scroll-view>
    <view v-else-if="loggedIn" class="sp-empty">暂无历史版本</view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useAccountStore } from '@/stores/account'
import type { Snapshot } from '@/types/models'
import { formatTime } from '@/utils/time'
import Taro from '@tarojs/taro'
import * as apiNS from '@/services/api'
const api = apiNS.api
import { saveNoteContent } from '@/services/notes'
import { message } from '@/utils/feedback'

/**
 * 历史版本面板（v1.1）
 * - 未登录：提示登录
 * - 登录后：从云端拉历史版本列表，点某版本回退
 * - 回退会覆盖当前文件，当前文件成为新的历史版本（云端 push 时自动存快照）
 */
const editor = useEditorStore()
const account = useAccountStore()
const loggedIn = ref(!!account.account)

function promptLogin() {
  Taro.showToast({ title: '请先登录', icon: 'none' })
}

async function fetchSnapshots() {
  if (!account.account || !editor.currentNote) return
  try {
    const list = await api.listCloudSnapshots(account.account.token, editor.currentNote.id)
    // 云端字段映射到本地 Snapshot 类型
    const mapped: Snapshot[] = list.map((s: any) => ({
      id: s.id,
      noteId: editor.currentNote!.id,
      kind: 'content' as const,
      content: s.content,
      message: s.message || '自动保存',
      createdAt: s.createdAt,
    }))
    editor.setSnapshots(mapped)
  } catch (e: any) {
    message.error('拉取历史版本失败')
  }
}

function onRefresh() {
  fetchSnapshots()
}

async function onRollback(snap: Snapshot, idx: number) {
  // 第一个是当前版本，不用回退
  if (idx === 0) return
  const confirmed = await Taro.showModal({
    title: '回退到此版本？',
    content: `将覆盖当前内容为 ${formatTime(snap.createdAt)} 的版本，当前版本会保留为新的历史记录。`,
    confirmText: '回退',
    cancelText: '取消',
  })
  if (!confirmed.confirm) return
  if (!editor.currentNote) return
  // 用快照内容覆盖当前文件
  editor.content = snap.content
  await saveNoteContent(editor.currentNote.id, snap.content)
  editor.currentNote = { ...editor.currentNote, content: snap.content, updatedAt: Date.now() }
  message.success('已回退')
  // 重新拉快照（回退后云端会自动存一份当前版本的快照）
  setTimeout(fetchSnapshots, 500)
}

// 切换笔记时重新拉
watch(() => editor.currentNote?.id, () => {
  if (loggedIn.value) fetchSnapshots()
})

onMounted(() => {
  if (loggedIn.value) fetchSnapshots()
})
</script>

<style scoped lang="scss">
.snapshot-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-left: 1px solid var(--border);
  background: var(--bg);
}
.sp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}
.sp-title {
  font-weight: 600;
  font-size: 13px;
}
.sp-empty {
  padding: 24px 16px;
  color: var(--text-secondary);
  font-size: 12px;
}
.sp-list {
  flex: 1;
  overflow-y: auto;
}
.sp-item {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-muted);
  cursor: pointer;
}
.sp-item:hover {
  background: var(--hover);
}
.sp-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sp-time {
  font-size: 12px;
  font-weight: 600;
}
.sp-badge {
  font-size: 10px;
  color: #2d6a4f;
  background: rgba(45, 106, 79, 0.1);
  padding: 1px 6px;
  border-radius: 8px;
}
.sp-msg {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
