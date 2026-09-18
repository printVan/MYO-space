<template>
  <view v-if="showToggle" class="mobile-toggle" :class="{ active: forced }" @click.stop="toggle">
    <GhIcon :name="forced ? 'monitor' : 'smartphone'" :size="16" />
    <text class="mobile-toggle-text">{{ forced ? '桌面视图' : '移动视图' }}</text>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import GhIcon from './GhIcon.vue'
import { isMobileMode, setMobileMode, onMobileChange, isAutoMobileEnabled, onAutoMobileChange } from '@/utils/mobile'

const isNarrow = ref(false)
const forced = ref(isMobileMode())
const autoEnabled = ref(isAutoMobileEnabled())
let off: (() => void) | null = null
let offResize: (() => void) | null = null
let offAuto: (() => void) | null = null

function updateNarrow() {
  isNarrow.value = window.innerWidth < 768
}

/** 宽屏始终可切换；窄屏仅在自动切换关闭时显示（此时需要手动入口） */
const showToggle = computed(() => !isNarrow.value || !autoEnabled.value)

function toggle() {
  setMobileMode(!forced.value)
}

onMounted(() => {
  updateNarrow()
  window.addEventListener('resize', updateNarrow)
  offResize = () => window.removeEventListener('resize', updateNarrow)
  off = onMobileChange((m) => {
    forced.value = m
  })
  offAuto = onAutoMobileChange((enabled) => {
    autoEnabled.value = enabled
  })
})

onUnmounted(() => {
  off?.()
  offResize?.()
  offAuto?.()
})
</script>

<style scoped lang="scss">
.mobile-toggle {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 999;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  border-radius: 999px;
  background: var(--gh-bg, #f6f8fa);
  border: 1px solid var(--gh-border, #d0d7de);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  color: var(--gh-fg, #24292f);
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
  user-select: none;

  &:hover {
    background: var(--gh-border, #d0d7de);
  }

  &.active {
    background: var(--gh-accent, #0969da);
    border-color: var(--gh-accent, #0969da);
    color: #fff;

    &:hover {
      background: #0a7be0;
    }
  }
}
</style>
