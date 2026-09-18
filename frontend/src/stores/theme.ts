import { defineStore } from 'pinia'
import { db } from '@/db'

type Theme = 'light' | 'dark'

/**
 * 深浅双主题（§5.1）
 * 参考 GitHub UI，主色 #0969da
 */
export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: 'light' as Theme
  }),
  getters: {
    isDark: (state) => state.theme === 'dark'
  },
  actions: {
    async init() {
      const pref = await db.preferences.get('theme')
      if (pref) this.theme = (pref.value as Theme) ?? 'light'
      this.apply()
    },
    async toggle() {
      this.theme = this.theme === 'light' ? 'dark' : 'light'
      await db.preferences.put({ key: 'theme', value: this.theme, updatedAt: Date.now() })
      this.apply()
    },
    apply() {
      const root = typeof document !== 'undefined' ? document.documentElement : null
      if (root) {
        root.setAttribute('data-theme', this.theme)
      }
    }
  }
})
