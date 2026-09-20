<template>
  <view class="file-tree">
    <view v-for="item in items" :key="item.id" class="tree-node">
      <view
        class="node-row"
        :class="{ active: isActive(item) }"
        @click.stop="onClick(item)"
      >
        <text class="node-icon">
          <GhIcon :name="iconOf(item)" :size="13" />
        </text>
        <text class="node-name">{{ item.name }}</text>
        <text v-if="!item.synced" class="unsynced-dot" title="未同步"></text>
      </view>
      <view
        v-if="item.kind === 'folder' && props.expandedIds.includes(item.id) && item.children.length"
        class="node-children"
      >
        <FileTree
          :items="item.children"
          :active-note-id="props.activeNoteId"
          :active-folder-id="props.activeFolderId"
          :expanded-ids="props.expandedIds"
          @select="(it) => emit('select', it)"
          @toggle="(id) => emit('toggle', id)"
        />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { defineOptions } from 'vue'
import type { TreeItem } from '@/services/folders'
import GhIcon from './GhIcon.vue'

defineOptions({ name: 'FileTree' })

/**
 * 无限层级目录树（§4.1.2）
 * 文件夹展开/折叠，笔记选中高亮
 */
const props = defineProps<{
  items: TreeItem[]
  activeNoteId?: string
  activeFolderId?: string
  expandedIds: string[]
}>()

const emit = defineEmits<{
  (e: 'select', item: TreeItem): void
  (e: 'toggle', id: string): void
}>()

function iconOf(item: TreeItem): string {
  if (item.kind === 'folder') return 'folder'
  return 'fileText'
}

function isActive(item: TreeItem): boolean {
  if (item.kind === 'note') return item.id === props.activeNoteId
  return item.id === props.activeFolderId
}

function onClick(item: TreeItem) {
  if (item.kind === 'folder') {
    // 点击文件夹：展开/折叠 + 选中（后续新建文件创建在此文件夹下）
    emit('toggle', item.id)
    emit('select', item)
  } else {
    emit('select', item)
  }
}
</script>

<style scoped lang="scss">
.file-tree {
  font-size: 13px;
  user-select: none;
}
.tree-node {
  line-height: 1.9;
}
.node-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
}
.node-row:hover {
  background: var(--hover);
}
.node-row.active {
  background: var(--accent-muted);
  color: var(--accent);
}
.node-icon {
  width: 16px;
  text-align: center;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.node-name {
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text);
}
.unsynced-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #d29922;
  display: inline-block;
  margin-left: 6px;
  flex-shrink: 0;
}
.node-children {
  padding-left: 16px;
}
</style>
