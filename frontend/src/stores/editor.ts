import { defineStore } from 'pinia'
import { getNote, saveNoteContent, updateNoteMeta } from '@/services/notes'
import { listAnnotations, addAnnotation, updateAnnotation, deleteAnnotation, reorderAnnotations } from '@/services/annotations'
import { computeLineDiff, type DiffResult } from '@/services/diff'
import type { Note, Snapshot, Annotation } from '@/types/models'

/** 自动保存防抖（毫秒）：停止输入 30 秒后才保存 */
export const AUTOSAVE_DEBOUNCE = 30000

/**
 * 编辑器状态
 * v1.1 改动：
 * - 自动保存改为 30 秒防抖（不再每 3 秒轮询）
 * - 自动保存不产生快照（快照改为云端功能，登录后从云端拉）
 * - 手动保存按钮只保存内容，不打快照
 */
export const useEditorStore = defineStore('editor', {
  state: () => ({
    currentNote: null as Note | null,
    /** 编辑器当前内容（内存中实时） */
    content: '',
    /** 防抖定时器 */
    autosaveTimer: null as ReturnType<typeof setTimeout> | null,
    snapshots: [] as Snapshot[],
    annotations: [] as Annotation[],
    /** diff 面板状态 */
    diffOpen: false,
    diffBase: null as Snapshot | null,
    diffTarget: null as Snapshot | null,
    diffResult: null as DiffResult | null,
    saving: false
  }),
  getters: {
    isDirty(state): boolean {
      return state.currentNote ? state.currentNote.content !== state.content : false
    }
  },
  actions: {
    /** 打开笔记（加载正文 + 快照 + 补充区） */
    async openNote(noteId: string) {
      await this.flushAutosave()
      const note = await getNote(noteId)
      if (!note) return
      this.currentNote = note
      this.content = note.content
      this.snapshots = [] // v1.1: 未登录不显示历史，登录后从云端拉
      this.annotations = await listAnnotations(noteId)
      this.diffOpen = false
    },

    /** 内容变更回调（编辑器输入时调用） */
    onContentChange(content: string) {
      this.content = content
      this.scheduleAutosave()
    },

    /** 防抖：停止输入 30 秒后自动保存 */
    scheduleAutosave() {
      if (this.autosaveTimer) clearTimeout(this.autosaveTimer)
      this.autosaveTimer = setTimeout(() => {
        void this.flushAutosave()
      }, AUTOSAVE_DEBOUNCE)
    },

    /** 立即保存正文（手动按钮 / 关闭笔记时调用） */
    async flushAutosave(): Promise<void> {
      if (this.autosaveTimer) {
        clearTimeout(this.autosaveTimer)
        this.autosaveTimer = null
      }
      if (!this.currentNote || !this.isDirty || this.saving) return
      this.saving = true
      try {
        await saveNoteContent(this.currentNote.id, this.content)
        this.currentNote = { ...this.currentNote, content: this.content, updatedAt: Date.now() }
        // v1.1: 自动保存不产生快照
      } finally {
        this.saving = false
      }
    },

    /** 手动保存按钮：立即保存当前内容 */
    async manualSave(): Promise<void> {
      await this.flushAutosave()
    },

    /** 关闭笔记时清理 */
    async closeNote() {
      await this.flushAutosave()
      if (this.autosaveTimer) {
        clearTimeout(this.autosaveTimer)
        this.autosaveTimer = null
      }
      this.currentNote = null
      this.content = ''
      this.snapshots = []
      this.annotations = []
      this.diffOpen = false
      this.diffResult = null
    },

    // ---- 快照面板（v1.1: 数据从云端拉，不在本地存） ----
    async openDiff(base: Snapshot, target: Snapshot) {
      this.diffBase = base
      this.diffTarget = target
      this.diffResult = computeLineDiff(base.content, target.content)
      this.diffOpen = true
    },

    async closeDiff() {
      this.diffOpen = false
      this.diffResult = null
    },

    /** 设置当前笔记的快照列表（登录后从云端拉回来时调用） */
    setSnapshots(list: Snapshot[]) {
      this.snapshots = list
    },

    // ---- 作者补充附注区 ----
    async addAnnotationEntry(content: string) {
      if (!this.currentNote) return
      const entry = await addAnnotation(this.currentNote.id, content)
      this.annotations = await listAnnotations(this.currentNote.id)
      return entry
    },

    async editAnnotationEntry(id: string, content: string) {
      if (!this.currentNote) return
      await updateAnnotation(id, content)
      this.annotations = await listAnnotations(this.currentNote.id)
    },

    async removeAnnotationEntry(id: string) {
      if (!this.currentNote) return
      await deleteAnnotation(id)
      this.annotations = await listAnnotations(this.currentNote.id)
    },

    async reorderAnnotationsByIds(ids: string[]) {
      if (!this.currentNote) return
      await reorderAnnotations(this.currentNote.id, ids)
      this.annotations = await listAnnotations(this.currentNote.id)
    },

    async setNoteVisibility(id: string, visibility: 'public' | 'private') {
      await updateNoteMeta(id, { visibility })
      if (this.currentNote) this.currentNote = { ...this.currentNote, visibility }
    }
  }
})
