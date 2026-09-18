<template>
  <view class="annotation-section">
    <!-- 收起态：极简细条 + 箭头（无文字提示），点击展开 -->
    <view v-if="collapsed" class="as-collapsed" @click="collapsed = false" title="展开作者补充附注">
      <view class="as-line"></view>
      <view class="as-collapse-btn">
        <text class="as-arrow">▸</text>
        <text v-if="annotations.length" class="as-count">{{ annotations.length }}</text>
      </view>
      <view class="as-line"></view>
    </view>

    <!-- 展开态：标题行 + 内容 -->
    <template v-else>
      <view class="as-divider" @click="collapsed = true">
        <view class="as-line"></view>
        <view class="as-toggle">
          <text class="as-arrow">▾</text>
          <text class="as-label">作者补充附注</text>
          <text v-if="annotations.length" class="as-count">{{ annotations.length }}</text>
        </view>
        <view class="as-line"></view>
      </view>
      <view v-for="item in annotations" :key="item.id" class="as-item">
      <view class="as-item-side">
        <view class="as-avatar">{{ authorInitial }}</view>
      </view>
      <view class="as-item-body">
        <view class="as-item-header">
          <text class="as-author">作者补充</text>
          <text class="as-time">{{ formatTime(item.updatedAt) }}</text>
          <view v-if="editable" class="as-item-actions">
            <text class="gh-link as-action" @click="onMove(item, -1)">↑</text>
            <text class="gh-link as-action" @click="onMove(item, 1)">↓</text>
            <text class="gh-link as-action" @click="onEdit(item)">编辑</text>
            <text class="gh-link as-action danger" @click="onDelete(item)">删除</text>
          </view>
        </view>
        <view v-if="editingId !== item.id" class="as-content">
          <MarkdownPreview :source="item.content" />
        </view>
        <view v-else class="as-editor">
          <textarea
            class="gh-textarea as-textarea"
            v-model="editingContent"
            rows="4"
            placeholder="补充说明、勘误、参考链接…"
          ></textarea>
          <view class="as-editor-actions">
            <view class="gh-btn sm primary" @click="onSaveEdit(item)">保存</view>
            <view class="gh-btn sm" @click="onCancelEdit">取消</view>
          </view>
        </view>
      </view>
    </view>

    <!-- 新增补充条目（仅作者） -->
    <view v-if="editable" class="as-item">
      <view class="as-item-side">
        <view class="as-avatar">{{ authorInitial }}</view>
      </view>
      <view class="as-item-body">
        <textarea
          class="gh-textarea as-textarea"
          v-model="newContent"
          rows="3"
          placeholder="撰写一条补充记录（Markdown 语法可用）…"
        ></textarea>
        <view class="as-editor-actions">
          <view class="gh-btn sm primary" :class="{ disabled: !newContent.trim() }" @click="onAdd">添加补充</view>
        </view>
      </view>
    </view>
    <view v-else class="as-note">访客可浏览作者补充，不支持评论（§4.3.1 / §4.5.4）。</view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '@/stores/editor'
import type { Annotation } from '@/types/models'
import { formatTime } from '@/utils/time'
import MarkdownPreview from './MarkdownPreview'

/**
 * 作者补充附注区（§4.3 核心特色）
 * 仅作者可编辑；每条独立 GFM；独立快照；GitHub Issue 追加评论样式
 */
const props = defineProps<{ noteId: string; editable: boolean }>()

const editor = useEditorStore()
const annotations = computed(() => editor.annotations)

const newContent = ref('')
const editingId = ref('')
const editingContent = ref('')
const authorInitial = 'M'
/** 默认收起作者补充区（不是每篇笔记都需要补充，需要时再展开） */
const collapsed = ref(true)

async function onAdd() {
  const content = newContent.value.trim()
  if (!content) return
  await editor.addAnnotationEntry(content)
  newContent.value = ''
}

function onEdit(item: Annotation) {
  editingId.value = item.id
  editingContent.value = item.content
}

function onCancelEdit() {
  editingId.value = ''
  editingContent.value = ''
}

async function onSaveEdit(item: Annotation) {
  const content = editingContent.value.trim()
  if (!content) return
  await editor.editAnnotationEntry(item.id, content)
  editingId.value = ''
  editingContent.value = ''
}

async function onDelete(item: Annotation) {
  await editor.removeAnnotationEntry(item.id)
}

async function onMove(item: Annotation, dir: -1 | 1) {
  const list = [...annotations.value]
  const idx = list.findIndex((a) => a.id === item.id)
  const target = idx + dir
  if (idx < 0 || target < 0 || target >= list.length) return
  const tmp = list[idx]
  list[idx] = list[target]
  list[target] = tmp
  await editor.reorderAnnotationsByIds(list.map((a) => a.id))
}
</script>

<style scoped lang="scss">
.annotation-section {
  padding: 0 16px 20px;
}
/* 收起态：细线 + 箭头小按钮，无文字，贴底不留空 */
.as-collapsed {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 0 0;
  cursor: pointer;
  user-select: none;
}
.as-collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 26px;
  height: 22px;
  padding: 0 8px;
  border-radius: 11px;
  color: var(--text-muted);
  transition: background 0.15s, color 0.15s;
}
.as-collapsed:hover .as-collapse-btn {
  background: var(--hover);
  color: var(--accent);
}
.as-collapsed:hover .as-arrow {
  color: var(--accent);
}
.as-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0 10px;
  cursor: pointer;
  user-select: none;
}
.as-divider:hover .as-label {
  color: var(--accent);
}
.as-line {
  flex: 1;
  height: 1px;
  background: var(--border);
}
.as-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.as-arrow {
  font-size: 12px;
  color: var(--text-secondary);
  transition: transform 0.15s;
}
.as-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
  transition: color 0.15s;
}
.as-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-muted);
}
.as-item {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}
.as-item-side {
  flex-shrink: 0;
}
.as-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
}
.as-item-body {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.as-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border-muted);
  flex-wrap: wrap;
}
.as-author {
  font-weight: 600;
  font-size: 13px;
}
.as-time {
  font-size: 12px;
  color: var(--text-secondary);
}
.as-item-actions {
  margin-left: auto;
  display: flex;
  gap: 10px;
}
.as-action {
  font-size: 12px;
}
.as-action.danger {
  color: var(--danger);
}
.as-content {
  padding: 4px 4px;
}
.as-editor {
  padding: 12px;
}
.as-textarea {
  min-height: 80px;
  resize: vertical;
}
.as-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.as-note {
  color: var(--text-secondary);
  font-size: 12px;
  padding: 8px 0;
}
.gh-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
