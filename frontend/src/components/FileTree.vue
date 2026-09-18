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
      </view>
      <view
        v-if="item.kind === 'folder' && props.expandedIds.includes(item.id) && item.children.length"
        class="node-children"
      >
        <FileTree
          :items="item.children"
          :active-id="props.activeId"
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
  activeId?: string
  expandedIds: string[]
}>()

const emit = defineEmits<{
  (e: 'select', item: TreeItem): void
  (e: 'toggle', id: string): void
}>()

function iconOf(item: TreeItem): string {
  if (item.kind === 'folder') {
    return props.expandedIds.includes(item.id) ? 'chevronDown' : 'chevronRight'
  }
  return 'fileText'
}

function isActive(item: TreeItem): boolean {
  return item.kind === 'note' && item.id === props.activeId
}

function onClick(item: TreeItem) {
  if (item.kind === 'folder') {
    emit('toggle', item.id)
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
.node-children {
  padding-left: 16px;
}
</style>
