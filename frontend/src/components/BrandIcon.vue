<template>
  <view class="brand-icon" :style="{ width: size + 'px', height: size + 'px' }" v-html="svg"></view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * MYO Space 品牌图标（A 字母几何标）
 * 圆角方框 + 抽象 M + 右上圆点，蓝紫渐变；颜色可随主题/场景个性化
 * 用于：顶栏品牌、未登录头像、博客主页默认头像、欢迎页等
 */
const props = withDefaults(
  defineProps<{
    size?: number
    /** gradient：蓝紫渐变（默认）；flat：继承当前文字颜色 */
    variant?: 'gradient' | 'flat'
    /** 显式描边/填充颜色（优先于 variant 的 currentColor），深色顶栏等 currentColor 失效场景使用 */
    color?: string
  }>(),
  { size: 26, variant: 'gradient' }
)

// 随机渐变 id，避免多实例 defs 冲突
const uid = `myo-${Math.random().toString(36).slice(2, 8)}`

const svg = computed(() => {
  const defs =
    props.variant === 'gradient'
      ? `<defs><linearGradient id="${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="0.55" stop-color="#4f46e5"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient></defs>`
      : ''
  const stroke = props.color || (props.variant === 'gradient' ? `url(#${uid})` : 'currentColor')
  const dotFill = props.color || (props.variant === 'gradient' ? `url(#${uid})` : 'currentColor')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%">${defs}<rect x="2.8" y="2.8" width="18.4" height="18.4" rx="5.2"/><path d="M8.4 16.2V8.4L12 12.4L15.6 8.4V16.2"/><circle cx="16.4" cy="7.6" r="1.6" fill="${dotFill}" stroke="none"/></svg>`
})
</script>

<style scoped lang="scss">
.brand-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 0;
}
.brand-icon :deep(svg) {
  display: block;
}
</style>
