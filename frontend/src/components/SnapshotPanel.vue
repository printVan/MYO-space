<template>
  <view class="snapshot-panel">
    <view class="sp-header">
      <text class="sp-title">版本快照</text>
      <view class="sp-actions">
        <view class="gh-input sp-message" placeholder="快照备注（可选）" v-model="snapshotMessage"></view>
        <view class="gh-btn sm primary" @click="onManualSnapshot">生成快照</view>
        <view class="gh-btn sm" @click="onRefresh">刷新</view>
      </view>
    </view>

    <view v-if="!editor.snapshots.length" class="sp-empty">
      暂无快照。编辑正文后会自动生成版本快照（最多保留 {{ editor.getSnapshotLimit() }} 份）。
    </view>

    <scroll-view v-else class="sp-list" scroll-y>
      <view
        v-for="snap in editor.snapshots"
        :key="snap.id"
        class="sp-item"
        :class="{ selected: isSelected(snap) }"
        @click="onToggleSelect(snap)"
      >
        <view class="sp-item-top">
          <text class="sp-time">{{ formatTime(snap.createdAt) }}</text>
          <text class="sp-kind">{{ snap.kind === 'content' ? '正文' : '补充区' }}</text>
        </view>
        <view class="sp-msg">{{ snap.message }}</view>
      </view>
    </scroll-view>

    <view v-if="editor.diffOpen && editor.diffResult" class="sp-diff">
      <view class="sp-diff-header">
        <text>差异对比（{{ editor.diffBase ? formatTime(editor.diffBase.createdAt) : '' }} → {{ editor.diffTarget ? formatTime(editor.diffTarget.createdAt) : '' }}）</text>
        <text class="sp-diff-stats">+{{ editor.diffResult.stats.added }} / -{{ editor.diffResult.stats.removed }}</text>
        <view class="gh-btn sm" @click="editor.closeDiff()">关闭</view>
        <view v-if="editor.diffTarget" class="gh-btn sm danger" @click="onRollback(editor.diffTarget)">回滚至此版本</view>
      </view>
      <view class="sp-diff-body">
        <view
          v-for="(line, i) in editor.diffResult.lines"
          :key="i"
          class="diff-line"
          :class="`diff-${line.op}`"
        >
          <text class="diff-marker">{{ line.op === 'insert' ? '+' : line.op === 'delete' ? '-' : ' ' }}</text>
          <text class="diff-text">{{ line.text }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useEditorStore } from '@/stores/editor'
import type { Snapshot } from '@/types/models'
import { formatTime } from '@/utils/time'

/**
 * 版本快照面板（§4.4，Web/H5 端）
 * 快照列表、任意两份 diff、回滚；UI 命名统一为「版本快照」，不暴露 Git 术语（§5.7）
 */
const editor = useEditorStore()
const snapshotMessage = ref('')

const selected = ref<Snapshot[]>([])

function isSelected(snap: Snapshot): boolean {
  return selected.value.some((s) => s.id === snap.id)
}

function onToggleSelect(snap: Snapshot) {
  const idx = selected.value.findIndex((s) => s.id === snap.id)
  if (idx >= 0) {
    selected.value.splice(idx, 1)
  } else {
    selected.value.push(snap)
  }
  if (selected.value.length === 2) {
    const [a, b] = selected.value
    // 时间早的作为基准
    const base = a.createdAt <= b.createdAt ? a : b
    const target = a.createdAt > b.createdAt ? a : b
    void editor.openDiff(base, target)
  }
}

async function onManualSnapshot() {
  const msg = snapshotMessage.value
  snapshotMessage.value = ''
  await editor.manualSnapshot(msg)
}

function onRefresh() {
  void editor.reloadSnapshots()
}

function onRollback(snap: Snapshot) {
  void editor.doRollback(snap)
  selected.value = []
}
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
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}
.sp-title {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
}
.sp-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}
.sp-message {
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 8px;
  font-size: 12px;
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
.sp-item.selected {
  background: var(--accent-muted);
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
.sp-kind {
  font-size: 11px;
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 6px;
}
.sp-msg {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sp-diff {
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  max-height: 40%;
}
.sp-diff-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 12px;
  border-bottom: 1px solid var(--border);
}
.sp-diff-stats {
  color: var(--text-secondary);
}
.sp-diff-body {
  overflow-y: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
.diff-line {
  display: flex;
  padding: 0 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
}
.diff-marker {
  width: 16px;
  flex-shrink: 0;
  color: var(--text-muted);
}
.diff-insert {
  background: rgba(46, 160, 67, 0.15);
}
.diff-insert .diff-marker {
  color: var(--success);
}
.diff-delete {
  background: rgba(248, 81, 73, 0.15);
}
.diff-delete .diff-marker {
  color: var(--danger);
}
</style>
