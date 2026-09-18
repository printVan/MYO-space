<template>
  <textarea
    class="mini-editor"
    :value="modelValue"
    placeholder="输入 Markdown 内容…"
    :maxlength="maxlength"
    @input="onInput"
  ></textarea>
</template>

<script setup lang="ts">
/**
 * Markdown 简单编辑（微信小程序精简版）
 * 小程序端不提供 CodeMirror，使用原生多行输入框（§6 微信小程序精简模式）
 */
defineProps<{ modelValue: string; maxlength?: number }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

function onInput(e: { detail: { value: string } }) {
  emit('update:modelValue', e.detail.value)
}
</script>

<style scoped lang="scss">
.mini-editor {
  width: 100%;
  height: 100%;
  min-height: 400rpx;
  padding: 24rpx;
  box-sizing: border-box;
  background: var(--bg);
  color: var(--text);
  border: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 28rpx;
  line-height: 1.7;
}
</style>
