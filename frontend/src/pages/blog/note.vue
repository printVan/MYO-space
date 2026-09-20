<template>
  <view class="blog-page">
    <view class="gh-header">
      <GhIcon name="arrowLeftCircle" :size="22" color="var(--header-text)" class="back-icon" @click="goBack" />
      <GhIcon name="home" :size="18" color="var(--header-text)" class="home-icon" @click="goHome" />
    </view>

    <view v-if="note" class="note-container">
      <view class="note-head">
        <view class="note-title">{{ note.title }}</view>
        <view class="note-meta">
          <text v-for="t in note.topics" :key="t" class="gh-tag">{{ t }}</text>
          <text class="meta-item">更新于 {{ relativeTimeStr(note.updatedAt) }}</text>
          <GhIcon v-if="note" name="edit" :size="16" color="var(--header-text)" class="edit-icon" @click="editNote" />
        </view>
      </view>
      <view class="note-body">
        <MarkdownPreview :source="note.content" />
      </view>
      <!-- 作者补充附注区（公开页面只读，§4.3.5） -->
      <AnnotationSection :note-id="note.id" :editable="false" />
    </view>
    <view v-else class="empty-state">笔记不存在或为私密笔记</view>
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
import GhIcon from '@/components/GhIcon'
import { useAccountStore } from '@/stores/account'

/**
 * 公开笔记页（§4.6.3）
 * GFM 渲染展示 + 作者补充附注区；私密笔记对外隐藏（§4.5.2）
 */
const router = useRouter()
const noteId = String(router.params.id ?? '')
const note = ref<Note | null>(null)

async function load() {
  const n = await getNote(noteId)
  if (!n) { note.value = null; return }
  // 公开文件直接看
  if (n.visibility === 'public') { note.value = n; return }
  // 私密文件：已登录可看，未登录但未同步（纯本地）也可看
  const account = useAccountStore().account
  if (account || !n.synced) { note.value = n; return }
  note.value = null
}

function goBack() {
  Taro.navigateBack()
}

function goHome() {
  Taro.reLaunch({ url: '/pages/blog/index' })
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
  background: var(--bg);
}
.header-title {
  font-weight: 600;
  font-size: 15px;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}
.back-icon, .home-icon {
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  &:hover { background: var(--bg-hover, rgba(0,0,0,0.06)); }
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
  color: var(--text);
}
.note-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.edit-icon {
  margin-left: auto;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  &:hover { background: var(--bg-hover, rgba(0,0,0,0.06)); }
}
.meta-item {
  font-size: 12px;
  color: var(--text-secondary);
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
