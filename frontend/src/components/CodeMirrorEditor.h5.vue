<template>
  <div class="cm-wrap" ref="wrapRef"></div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Taro from '@tarojs/taro'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { useAccountStore } from '@/stores/account'
import { uploadImage } from '@/services/upload'

/**
 * CodeMirror 6 Markdown 源码编辑器（H5 端，§4.2.1）
 * 左侧源码编辑；GFM 语法高亮；深色模式切换 one-dark + 墨绿定制主题
 * 支持粘贴图片：自动直传图库（Supabase Storage）并在光标处插入 Markdown 图片语法
 */

// 墨绿定制覆盖：oneDark 提供语法高亮，此主题覆盖底色/光标/行号等与全局墨绿主题协调
const myoGreen = EditorView.theme(
  {
    '&': { backgroundColor: '#14231b', color: '#e3ede7' },
    '.cm-content': { caretColor: '#4ec48d' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: '#2c483a'
    },
    '.cm-gutters': {
      backgroundColor: '#182a21',
      color: '#7d998b',
      border: 'none'
    },
    '.cm-activeLine': { backgroundColor: '#1b2f24' },
    '.cm-activeLineGutter': { backgroundColor: '#20352b', color: '#e3ede7' },
    '.cm-cursor': { borderLeftColor: '#4ec48d' },
    '.cm-matchingBracket': { backgroundColor: '#2c483a', outline: '1px solid #3f6a55' },
    '.cm-selectionMatch': { backgroundColor: '#20352b' }
  },
  { dark: true }
)

const props = defineProps<{ modelValue: string; dark: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const wrapRef = ref<HTMLElement | null>(null)
let view: EditorView | null = null

const accountStore = useAccountStore()
const themeExtensions = computed(() => (props.dark ? [oneDark, myoGreen] : []))

/** 在光标处插入 Markdown 图片语法 */
function insertMarkdownImage(v: EditorView, name: string, url: string) {
  const { from, to } = v.state.selection.main
  const alt = (name.replace(/\.[^.]+$/, '').replace(/[!"#$%&'()*+,./:;<=>?@[\]^`{|}~]/g, '') || 'image').slice(0, 40)
  const snippet = `![${alt}](${url})`
  v.dispatch({
    changes: { from, to, insert: snippet },
    selection: { anchor: from + snippet.length }
  })
  v.focus()
}

/** 粘贴图片：直传图库，上传成功后插入 Markdown 图片语法 */
function handlePaste(e: ClipboardEvent, v: EditorView): boolean {
  const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'))
  if (!files.length) return false
  e.preventDefault()
  void (async () => {
    const token = accountStore.account?.token ?? null
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        Taro.showLoading({ title: files.length > 1 ? `上传图片 ${i + 1}/${files.length}…` : '上传图片…' })
        const url = await uploadImage(file, file.name || `paste-${Date.now()}.png`, token)
        Taro.hideLoading()
        insertMarkdownImage(v, file.name || 'image', url)
      } catch (err) {
        Taro.hideLoading()
        Taro.showToast({ title: err instanceof Error ? err.message : '上传失败', icon: 'none', duration: 2000 })
      }
    }
  })()
  return true
}

function buildState(doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      basicSetup,
      markdown(),
      EditorView.domEventHandlers({ paste: handlePaste }),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) emit('update:modelValue', u.state.doc.toString())
      }),
      ...themeExtensions.value
    ]
  })
}

function rebuild() {
  if (!wrapRef.value) return
  const current = view ? view.state.doc.toString() : props.modelValue
  view?.destroy()
  view = new EditorView({ state: buildState(current), parent: wrapRef.value })
}

onMounted(() => {
  if (wrapRef.value) {
    view = new EditorView({ state: buildState(props.modelValue), parent: wrapRef.value })
  }
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})

// 外部内容变化（如切换笔记）同步进编辑器，避免覆盖用户输入
watch(
  () => props.modelValue,
  (v) => {
    if (view && v !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } })
    }
  }
)

// 主题切换时重建（保留文档内容）
watch(() => props.dark, () => rebuild())
</script>

<style scoped lang="scss">
.cm-wrap {
  height: 100%;
  overflow: hidden;

  :deep(.cm-editor) {
    height: 100%;
    font-size: 13px;
  }
  :deep(.cm-scroller) {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
    line-height: 1.6;
    overflow: auto;
  }
}
</style>
