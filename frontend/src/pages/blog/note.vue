<template>
  <view class="blog-page">
    <view class="gh-header">
      <view class="gh-link" @click="goBack">← 返回</view>
      <text class="header-title">{{ note?.title ?? '笔记' }}</text>
      <view class="header-right">
        <view v-if="note" class="gh-btn sm" @click="editNote">编辑</view>
      </view>
    </view>

    <view v-if="note" class="note-container">
      <view class="note-head">
        <view class="note-title">{{ note.title }}</view>
        <view class="note-meta">
          <text v-for="t in note.topics" :key="t" class="gh-tag">{{ t }}</text>
          <text class="meta-item">更新于 {{ relativeTimeStr(note.updatedAt) }}</text>
        </view>
      </view>
      <view class="note-body">
        <MarkdownPreview :source="note.content" />
      </view>
      <!-- 作者补充附注区（公开页面只读，§4.3.5） -->
      <AnnotationSection :note-id="note.id" :editable="false" />
    </view>
    <view v-else class="empty-state">笔记不存在或为私密笔记</view>
    <MobileLayoutToggle />
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Taro, { useRouter } from '@tarojs/taro'
import { getNote } from '@/services/notes'
import type { Note } from '@/types/models'
import { relativeTimeStr } from '@/utils/time'
import MarkdownPreview from '@/components/MarkdownPreview'
import AnnotationSection from '@/components/AnnotationSection'
import MobileLayoutToggle from '@/components/MobileLayoutToggle'

/**
 * 公开笔记页（§4.6.3）
 * GFM 渲染展示 + 作者补充附注区；私密笔记对外隐藏（§4.5.2）
 */
const router = useRouter()
const noteId = String(router.params.id ?? '')
const note = ref<Note | null>(null)

async function load() {
  const n = await getNote(noteId)
  if (n && n.visibility === 'public') {
    note.value = n
  } else {
    note.value = null
  }
}

function goBack() {
  Taro.navigateBack()
}

/** 跳转工作区编辑该笔记（本地优先：公开页数据即本地数据） */
function editNote() {
  if (!note.value) return
  Taro.navigateTo({ url: `/pages/workspace/index?projectId=${note.value.projectId}&noteId=${note.value.id}` })
}

onMounted(load)
</script>

<style scoped lang="scss">
.blog-page {
  min-height: 100vh;
}
.header-title {
  font-weight: 600;
  font-size: 15px;
}
.header-right {
  margin-left: auto;
}
.note-container {
  max-width: 880px;
  margin: 0 auto;
  padding: 24px 20px 64px;
}
.note-head {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 20px;
}
.note-title {
  font-size: 26px;
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 8px;
}
.note-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.meta-item {
  font-size: 12px;
  color: var(--text-muted);
}
.note-body {
  min-height: 200px;
}
.empty-state {
  padding: 80px 0;
  text-align: center;
  color: var(--text-secondary);
}
</style>
