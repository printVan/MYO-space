<template>
  <rich-text :nodes="html" class="markdown-body md-preview"></rich-text>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '@/services/markdown'

/**
 * GFM 预览（微信小程序端）
 * rich-text 渲染；prism 高亮类名会保留在 HTML 中，样式受小程序支持范围限制
 */
const props = defineProps<{ source: string }>()

const html = computed(() => renderMarkdown(props.source))
</script>

<style scoped lang="scss">
.md-preview {
  padding: 24rpx 32rpx;
  min-height: 100%;
  word-break: break-all;
}
</style>
