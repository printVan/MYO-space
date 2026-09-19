<template>
  <view class="blog-page" :class="{ 'mobile-mode': mobileMode }">
    <!-- 顶栏 -->
    <view class="gh-header">
      <view class="brand" @click="goHome">
        <BrandIcon :size="28" />
        <text class="brand-name">MYO Space</text>
      </view>
      <view class="header-search">
        <input
          class="gh-input search-input"
          :value="keyword"
          placeholder="搜索项目 / 公开笔记…"
          @input="onSearchInput"
        />
      </view>
      <view class="gh-link workspace-link" @click="goWorkspace" title="工作台"><GhIcon name="penSquare" :size="18" /></view>
      <AppHeaderActions :show-blog-link="false" />
    </view>

    <!-- 搜索模式 -->
    <view v-if="keyword.trim()" class="blog-container">
      <view class="section-title">搜索结果（{{ searchResults.length }}）</view>
      <view v-if="!searchResults.length" class="empty-state">未找到匹配的笔记</view>
      <view v-for="r in searchResults" :key="r.id" class="search-item" @click="goNote(r.projectId, r.id)">
        <view class="search-item-title">
          <text class="gh-link">{{ r.title }}</text>
          <text class="search-project">{{ r.projectName }}</text>
        </view>
        <view class="search-snippet">{{ r.snippet }}</view>
      </view>
    </view>

    <!-- v1.1 新首页：快速写笔记 + 近期文件 -->
    <view v-else class="home-page">
      <view class="quick-btn" @click="quickWrite">✏️ 快速写笔记</view>

      <view class="section-title">近期文件</view>

      <view v-if="!pagedNotes.length" class="empty-state">
        还没有笔记，点上方按钮快速写一篇。
      </view>

      <view v-else>
        <view
          v-for="n in pagedNotes"
          :key="n.id"
          class="recent-item"
          @click="goNote(n.projectId, n.id)"
        >
          <view class="recent-name-row">
            <view class="recent-name">{{ n.title || '未命名' }}</view>
            <text v-if="n.pinned" class="pinned-badge">置顶</text>
          </view>
          <view class="recent-excerpt">{{ excerpt(n.content) }}</view>
          <view class="recent-meta">{{ relativeTimeStr(n.updatedAt) }} · {{ projectName(n.projectId) }}</view>
        </view>
      </view>

      <!-- 分页 -->
      <view v-if="totalPages > 1" class="pager">
        <text class="pager-btn" :class="{ disabled: page === 1 }" @click="prevPage">← 上一页</text>
        <text class="pager-info">第 {{ page }} / {{ totalPages }} 页</text>
        <text v-if="page < totalPages" class="pager-btn" @click="nextPage">下一页 →</text>
        <text v-else class="pager-end">已显示最近 50 条 · <text class="gh-link" @click="goProjects">进入项目查看全部</text></text>
      </view>

      <view class="view-all" @click="goProjects">查看全部项目 →</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Taro, { useLoad } from '@tarojs/taro'
import { listProjects } from '@/services/projects'
import { listRecentNotes } from '@/services/notes'
import { globalSearch } from '@/services/search'
import type { Project, Note } from '@/types/models'
import { relativeTimeStr } from '@/utils/time'
import AppHeaderActions from '@/components/AppHeaderActions'
import BrandIcon from '@/components/BrandIcon'
import GhIcon from '@/components/GhIcon'
import { isMobileMode, onMobileChange, bindAutoMobile } from '@/utils/mobile'
import { useAccountStore } from '@/stores/account'
import { DEFAULT_PRIVATE_PROJECT_ID as DEFAULT_PROJECT_ID } from '@/services/projects'

const PAGE_SIZE = 10
const MAX_NOTES = 50

const allNotes = ref<Note[]>([])
const projectsMap = ref<Record<string, Project>>({})
const keyword = ref('')
const searchResults = ref<Awaited<ReturnType<typeof globalSearch>>>([])
const page = ref(1)
const mobileMode = ref(isMobileMode())
const accountStore = useAccountStore()

const totalPages = computed(() => Math.min(5, Math.ceil(allNotes.value.length / PAGE_SIZE)))
const pagedNotes = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return allNotes.value.slice(start, start + PAGE_SIZE)
})

function projectName(pid: string): string {
  return projectsMap.value[pid]?.name ?? '未分类'
}

function excerpt(content: string): string {
  const text = (content || '').replace(/[#*`>\-\[\]()!]/g, '').replace(/\s+/g, ' ').trim()
  return text.slice(0, 80) || '（空）'
}

async function load() {
  const [projects, notes] = await Promise.all([listProjects(), listRecentNotes(MAX_NOTES)])
  projectsMap.value = Object.fromEntries(projects.map((p) => [p.id, p]))
  allNotes.value = notes
}

function quickWrite() {
  // 快速写笔记：跳到工作区，默认项目
  Taro.reLaunch({ url: '/pages/workspace/index?quick=1' })
}

function prevPage() { if (page.value > 1) page.value-- }
function nextPage() { if (page.value < totalPages.value) page.value++ }

function goProjects() {
  Taro.navigateTo({ url: '/pages/blog/projects' })
}

const debounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)
function onSearchInput(e: { detail: { value: string } }) {
  keyword.value = e.detail.value
  if (debounceTimer.value) clearTimeout(debounceTimer.value)
  debounceTimer.value = setTimeout(async () => {
    const kw = keyword.value.trim()
    if (!kw) { searchResults.value = []; return }
    searchResults.value = await globalSearch(kw)
  }, 300)
}

function goNote(projectId: string, noteId: string) {
  Taro.navigateTo({ url: `/pages/blog/note?id=${noteId}` })
}

function goWorkspace() {
  Taro.reLaunch({ url: '/pages/workspace/index' })
}

function goHome() {
  Taro.reLaunch({ url: '/pages/blog/index' })
}

useLoad((options) => {
  if (options?.kw) {
    keyword.value = decodeURIComponent(options.kw)
    onSearchInput({ detail: { value: keyword.value } } as any)
  }
})

onMounted(() => {
  load()
  mobileOff = onMobileChange((m) => { mobileMode.value = m })
  autoMobileOff = bindAutoMobile(() => document.querySelector('.blog-page'))
})

let mobileOff: (() => void) | null = null
let autoMobileOff: (() => void) | null = null
</script>

<style scoped lang="scss">
.blog-page {
  min-height: 100vh;
  background: var(--bg);
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.brand-name {
  font-weight: 700;
  font-size: 16px;
  color: var(--header-text);
}
.header-search {
  flex: 1;
  max-width: 420px;
}
.search-input { height: 30px; }
.blog-container {
  max-width: 880px;
  margin: 0 auto;
  padding: 24px 20px 64px;
}
.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}
.empty-state {
  padding: 48px 0;
  text-align: center;
  color: var(--text-secondary);
}

/* ===== v1.1 新首页 ===== */
.home-page {
  max-width: 760px;
  margin: 0 auto;
  padding: 32px 20px 64px;
}
.quick-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #0969da;
  color: #fff;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  margin-bottom: 28px;
}
.quick-btn:hover { background: #0860c5; }

.recent-item {
  display: block;
  padding: 16px 20px;
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 10px;
  cursor: pointer;
  background: var(--bg-card);
}
.recent-item:hover { border-color: var(--accent); }
.recent-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
}
.recent-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.pinned-badge {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: #2d6a4f;
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}
.recent-excerpt {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}
.recent-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
}

.pager {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
  font-size: 13px;
}
.pager-btn {
  color: var(--accent);
  cursor: pointer;
}
.pager-btn.disabled { color: var(--text-muted); cursor: default; }
.pager-info { color: var(--text-secondary); }
.pager-end { color: var(--text-secondary); }

.view-all {
  margin-top: 16px;
  color: var(--accent);
  cursor: pointer;
  font-size: 14px;
  display: inline-block;
}

.search-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--border-muted);
}
.search-item-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.search-project { font-size: 12px; color: var(--text-muted); }
.search-snippet {
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}

/* ============ 移动端 ============ */
@media (max-width: 767px) {
  .blog-page:not(.no-auto-mobile) .home-page { padding: 20px 12px 64px; }
  .header-search { max-width: 320px; }
}
</style>
