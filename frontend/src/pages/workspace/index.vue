<template>
  <view class="fallback">
    <text>当前平台不支持完整工作区，请使用 Web / H5 / 微信小程序端。</text>
  </view>
</template>

<script setup lang="ts">
/**
 * 兜底页面：仅 h5 / weapp 提供实现（index.h5.vue / index.weapp.vue）
 */
</script>

<style scoped>
.fallback {
  padding: 80px 24px;
  text-align: center;
  color: var(--text-secondary);
}
</style>
