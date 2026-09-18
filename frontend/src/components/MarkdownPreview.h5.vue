<template>
  <div class="markdown-body md-preview" v-html="html"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '@/services/markdown'
import 'github-markdown-css/github-markdown.css'
import 'prismjs/themes/prism.css'

/**
 * GFM 实时预览（H5 端）
 * 渲染 + prism 高亮，样式 github-markdown-css
 */
const props = defineProps<{ source: string }>()

const html = computed(() => renderMarkdown(props.source))
</script>

<style scoped lang="scss">
.md-preview {
  padding: 16px 24px;
  min-height: 100%;
  overflow-wrap: break-word;
}
</style>
