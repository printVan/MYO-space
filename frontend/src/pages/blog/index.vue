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
        <view class="search-tags">
          <text v-for="m in r.matchedBy" :key="m" class="gh-tag">{{ tagName(m) }}</text>
        </view>
      </view>
    </view>

    <!-- 个人主页（§4.6） -->
    <view v-else class="profile-page">
      <!-- 顶部资料区：已登录显示用户名首字母，未登录显示品牌图标 -->
      <view class="profile-head">
        <view class="profile-avatar">
          <template v-if="accountStore.isLoggedIn">{{ accountStore.initial }}</template>
          <BrandIcon v-else :size="40" variant="flat" />
        </view>
        <view class="profile-info">
          <view class="profile-name">{{ profileName }}</view>
          <view class="profile-bio">{{ profileBio }}</view>
          <view class="profile-stats">
            <view class="stat">
              <text class="stat-num">{{ visibleProjects.length }}</text>
              <text class="stat-label">项目</text>
            </view>
            <view class="stat">
              <text class="stat-num">{{ totalNotes }}</text>
              <text class="stat-label">笔记</text>
            </view>
            <view class="stat">
              <text class="stat-num">{{ totalTopics }}</text>
              <text class="stat-label">主题</text>
            </view>
          </view>
        </view>
      </view>

      <view class="profile-body">
        <!-- 左侧导航（仅 Projects） -->
        <view class="profile-nav">
          <view class="nav-item" :class="{ active: nav === 'projects' }" @click="nav = 'projects'">Projects</view>
        </view>

        <!-- 主内容：项目卡片网格（本人已登录：公开+私密全部展示；游客：仅公开） -->
        <view class="profile-main">
          <view class="section-title">
            <text>项目</text>
            <text class="count">{{ visibleProjects.length }}</text>
          </view>
          <view v-if="!visibleProjects.length" class="empty-state">
            暂无项目。在工作区中可创建项目。
          </view>
          <view v-else class="repo-grid">
            <view v-for="p in visibleProjects" :key="p.id" class="repo-card" @click="goProject(p)">
              <view class="repo-name-row">
                <text class="gh-link repo-name-text">{{ p.name }}</text>
                <text v-if="p.visibility === 'private'" class="repo-lock">私密</text>
                <text v-else-if="p.password" class="repo-lock">密码</text>
              </view>
              <view class="repo-desc">{{ p.description || '暂无描述' }}</view>
              <view class="repo-topics">
                <text v-for="t in (p.topics || []).slice(0, 3)" :key="t" class="gh-tag repo-topic">{{ t }}</text>
              </view>
              <view class="repo-foot">
                <view class="repo-lang">
                  <view class="lang-dot"></view>
                  <text>Markdown</text>
                </view>
                <view class="repo-star">
                  <text class="star-icon">★</text>
                  <text>{{ noteCounts[p.id] ?? 0 }}</text>
                </view>
                <text class="repo-updated">Updated {{ relativeTimeStr(p.updatedAt) }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
    <MobileLayoutToggle />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Taro from '@tarojs/taro'
import { listProjects } from '@/services/projects'
import { countProjectNotes } from '@/services/notes'
import { globalSearch } from '@/services/search'
import type { Project } from '@/types/models'
import { relativeTimeStr } from '@/utils/time'
import AppHeaderActions from '@/components/AppHeaderActions'
import BrandIcon from '@/components/BrandIcon'
import GhIcon from '@/components/GhIcon'
import MobileLayoutToggle from '@/components/MobileLayoutToggle'
import { isMobileMode, onMobileChange, bindAutoMobile } from '@/utils/mobile'
import { useAccountStore } from '@/stores/account'

/**
 * 公开博客主页（§4.6）
 * Profile 样式：顶部资料区 + 统计 + 左侧导航 + 项目卡片网格
 */
const publicProjects = ref<Project[]>([])
const noteCounts = ref<Record<string, number>>({})
const keyword = ref('')
const searchResults = ref<Awaited<ReturnType<typeof globalSearch>>>([])
const nav = ref('projects')
/** 移动端自适应视图 */
const mobileMode = ref(isMobileMode())

const accountStore = useAccountStore()
/** 主页名称：已登录展示账号用户名，未登录展示品牌名 */
const profileName = computed(() => (accountStore.isLoggedIn ? accountStore.username : 'MYO Space'))
const profileBio = '记录与分享'

/** 主页展示的项目列表：本地全部项目（公开+私密都展示） */
const visibleProjects = computed(() => publicProjects.value)

const totalNotes = computed(() =>
  Object.values(noteCounts.value).reduce((a, b) => a + b, 0)
)
const totalTopics = computed(() => {
  const set = new Set<string>()
  for (const p of publicProjects.value) for (const t of p.topics || []) set.add(t)
  return set.size
})

async function load() {
  // 主页展示本地全部项目（公开+私密都展示；游客公网分享场景后续版本实现）
  publicProjects.value = await listProjects()
  for (const p of publicProjects.value) {
    noteCounts.value[p.id] = await countProjectNotes(p.id)
  }
}

const debounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)
function onSearchInput(e: { detail: { value: string } }) {
  keyword.value = e.detail.value
  if (debounceTimer.value) clearTimeout(debounceTimer.value)
  debounceTimer.value = setTimeout(async () => {
    const kw = keyword.value.trim()
    if (!kw) {
      searchResults.value = []
      return
    }
    // 只搜公开项目内的公开笔记
    const all = await globalSearch(kw)
    const pubIds = new Set(publicProjects.value.map((p) => p.id))
    searchResults.value = all.filter((r) => pubIds.has(r.projectId))
  }, 300)
}

function tagName(m: string): string {
  return m === 'title' ? '标题' : m === 'topic' ? '标签' : '正文'
}

function goProject(p: Project) {
  Taro.navigateTo({ url: `/pages/blog/project?id=${p.id}` })
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

onMounted(() => {
  load()
  mobileOff = onMobileChange((m) => {
    mobileMode.value = m
  })
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
.search-input {
  height: 30px;
}
.blog-container {
  max-width: 880px;
  margin: 0 auto;
  padding: 24px 20px 64px;
}
.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.count {
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0 8px;
}
.empty-state {
  padding: 48px 0;
  text-align: center;
  color: var(--text-secondary);
}

/* ===== 个人主页（GitHub Profile 样式） ===== */
.profile-page {
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px 20px 64px;
}
.profile-head {
  display: flex;
  gap: 20px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border-muted);
}
.profile-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  /* 品牌蓝紫渐变头像底 */
  background: linear-gradient(135deg, #7c5cff 0%, #4f46e5 55%, #0ea5e9 100%);
  color: #fff;
  font-size: 28px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.25);
}
.profile-info {
  flex: 1;
  min-width: 0;
}
.profile-name {
  font-size: 20px;
  font-weight: 700;
}
.profile-bio {
  margin-top: 2px;
  font-size: 13px;
  color: var(--text-secondary);
}
.profile-stats {
  display: flex;
  gap: 20px;
  margin-top: 10px;
}
.stat {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.stat-num {
  font-size: 16px;
  font-weight: 600;
}
.stat-label {
  font-size: 12px;
  color: var(--text-muted);
}

.profile-body {
  display: flex;
  gap: 24px;
  margin-top: 20px;
}
.profile-nav {
  width: 140px;
  flex-shrink: 0;
}
.nav-item {
  padding: 8px 12px;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 6px;
  margin-bottom: 2px;
}
.nav-item:hover {
  color: var(--text);
  background: var(--bg-subtle);
}
.nav-item.active {
  color: var(--text);
  font-weight: 600;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
}
.profile-main {
  flex: 1;
  min-width: 0;
}

/* 项目卡片网格（GitHub Profile 风格） */
.repo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.repo-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.repo-card:hover {
  border-color: var(--accent);
}
.repo-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.repo-name-text {
  font-size: 15px;
  font-weight: 600;
}
.repo-lock {
  font-size: 12px;
  color: var(--text-secondary);
}
.repo-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  min-height: 38px;
}
.repo-topics {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.repo-topic {
  font-size: 11px;
}
.repo-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: auto;
  padding-top: 8px;
}
.repo-lang {
  display: flex;
  align-items: center;
  gap: 5px;
}
.lang-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #3572a5; /* Markdown 语言色 */
}
.repo-star {
  display: flex;
  align-items: center;
  gap: 3px;
}
.star-icon {
  color: var(--text-muted);
  font-size: 13px;
}
.repo-updated {
  margin-left: auto;
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
.search-project {
  font-size: 12px;
  color: var(--text-muted);
}
.search-snippet {
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}
.search-tags {
  margin-top: 6px;
  display: flex;
  gap: 6px;
}

/* ============ 移动端自适应视图 ============
   手机宽度自动单栏；底部按钮可手动强制（.mobile-mode 覆盖）
*/
@mixin mobile-blog-layout {
  .profile-body {
    flex-direction: column;
    gap: 16px;
  }

  .profile-nav {
    width: 100%;
    display: flex;
    gap: 4px;
    overflow-x: auto;
  }

  .nav-item {
    flex-shrink: 0;
    margin-bottom: 0;
  }

  .repo-grid {
    grid-template-columns: 1fr;
  }

  .gh-header {
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 12px;
  }

  .header-search {
    order: 10;
    width: 100%;
    max-width: none;
    margin-left: 0;
  }

  .workspace-link {
    flex-shrink: 0;
    font-size: 13px;
    display: flex;
    align-items: center;
    padding: 4px;
    border-radius: 6px;
  }
  .workspace-link:hover {
    background: rgba(255, 255, 255, 0.08);
  }
}

.blog-page.mobile-mode {
  @include mobile-blog-layout;
}

@media (max-width: 767px) {
  .blog-page:not(.no-auto-mobile) {
    @include mobile-blog-layout;
  }
}
</style>
