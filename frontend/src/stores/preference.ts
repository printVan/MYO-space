import { defineStore } from 'pinia'
import { db } from '@/db'

/**
 * 本地偏好配置（§3.2）
 * 记录上次打开项目、编辑器分栏宽度等
 */
export const usePreferenceStore = defineStore('preference', {
  state: () => ({
    lastProjectId: '' as string,
    /** 三栏分割宽度（拖拽调整，§5.5） */
    panelWidths: { sidebar: 260, files: 280 } as { sidebar: number; files: number }
  }),
  actions: {
    async init() {
      const last = await db.preferences.get('lastProjectId')
      if (last) this.lastProjectId = last.value as string
      const widths = await db.preferences.get('panelWidths')
      if (widths) this.panelWidths = { ...this.panelWidths, ...(widths.value as object) }
    },

    async setLastProject(projectId: string) {
      this.lastProjectId = projectId
      await db.preferences.put({ key: 'lastProjectId', value: projectId, updatedAt: Date.now() })
    },

    async setPanelWidths(widths: { sidebar: number; files: number }) {
      this.panelWidths = widths
      await db.preferences.put({ key: 'panelWidths', value: widths, updatedAt: Date.now() })
    }
  }
})
