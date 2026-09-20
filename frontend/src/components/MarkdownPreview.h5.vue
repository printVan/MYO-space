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

<style lang="scss">
[data-theme="dark"] .markdown-body.md-preview,
[data-theme="dark"] .markdown-body.md-preview *,
[data-theme="dark"] .markdown-body.md-preview p,
[data-theme="dark"] .markdown-body.md-preview li,
[data-theme="dark"] .markdown-body.md-preview h1,
[data-theme="dark"] .markdown-body.md-preview h2,
[data-theme="dark"] .markdown-body.md-preview h3,
[data-theme="dark"] .markdown-body.md-preview h4,
[data-theme="dark"] .markdown-body.md-preview h5,
[data-theme="dark"] .markdown-body.md-preview h6 {
  color: #e3ede7 !important;
  background: var(--bg) !important;
}
.markdown-body.md-preview {
  --fgColor-default: var(--text) !important;
  --fgColor-muted: var(--text-secondary) !important;
  --fgColor-accent: var(--accent) !important;
  --bgColor-default: var(--bg) !important;
  background: var(--bg) !important;
}
.markdown-body.md-preview a {
  color: var(--accent) !important;
}
.markdown-body.md-preview code {
  background: var(--code-bg) !important;
  color: var(--text) !important;
}
.markdown-body.md-preview pre {
  background: var(--code-bg) !important;
}
.markdown-body.md-preview blockquote {
  color: var(--text-secondary) !important;
}
</style>
