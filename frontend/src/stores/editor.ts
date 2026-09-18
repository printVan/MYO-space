import { defineStore } from 'pinia'
import { getNote, saveNoteContent, updateNoteMeta } from '@/services/notes'
import { listAnnotations, addAnnotation, updateAnnotation, deleteAnnotation, reorderAnnotations } from '@/services/annotations'
import { listSnapshots, createSnapshot, rollbackToSnapshot, SNAPSHOT_LIMIT } from '@/services/snapshots'
import { computeLineDiff, type DiffResult } from '@/services/diff'
import type { Note, Snapshot, Annotation } from '@/types/models'

/** 自动保存间隔（毫秒）：3 秒草稿自动保存（§4.2.4） */
export const AUTOSAVE_INTERVAL = 3000
/** 快照生成冷却（毫秒）：连续编辑暂停该时长且内容变化时生成快照 */
export const SNAPSHOT_COOLDOWN = 10000

/**
 * 编辑器状态（§4.2 / §4.3 / §4.4）
 * 自动保存、快照、作者补充区
 */
export const useEditorStore = defineStore('editor', {
  state: () => ({
    currentNote: null as Note | null,
    /** 编辑器当前内容（内存中实时） */
    content: '',
    /** 自动保存定时器 */
    autosaveTimer: null as ReturnType<typeof setInterval> | null,
    /** 上次快照时保存的内容 */
    lastSnapshotContent: '',
    lastSnapshotAt: 0,
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
      this.lastSnapshotContent = note.content
      this.lastSnapshotAt = Date.now()
      this.snapshots = await listSnapshots(noteId, 'content')
      this.annotations = await listAnnotations(noteId)
      this.diffOpen = false
      this.ensureAutosave()
    },

    /** 内容变更回调（编辑器输入时调用） */
    async onContentChange(content: string) {
      this.content = content
    },

    /** 确保自动保存定时器运行 */
    ensureAutosave() {
      if (this.autosaveTimer) return
      this.autosaveTimer = setInterval(() => {
        void this.flushAutosave()
      }, AUTOSAVE_INTERVAL)
    },

    /** 立即保存正文（3 秒自动草稿保存） */
    async flushAutosave(): Promise<void> {
      if (!this.currentNote || !this.isDirty || this.saving) return
      this.saving = true
      try {
        await saveNoteContent(this.currentNote.id, this.content)
        this.currentNote = { ...this.currentNote, content: this.content, updatedAt: Date.now() }
        // 内容实质变更 + 冷却期满 → 生成版本快照
        const now = Date.now()
        if (this.content !== this.lastSnapshotContent && now - this.lastSnapshotAt >= SNAPSHOT_COOLDOWN) {
          const snap = await createSnapshot(this.currentNote.id, 'content', this.content)
          this.snapshots = await listSnapshots(this.currentNote.id, 'content')
          this.lastSnapshotContent = this.content
          this.lastSnapshotAt = now
          void snap // 快照仅记录，不返回给调用方
        }
      } finally {
        this.saving = false
      }
    },

    /** 手动生成快照（可填备注） */
    async manualSnapshot(message?: string) {
      if (!this.currentNote) return
      await this.flushAutosave()
      const snap = await createSnapshot(this.currentNote.id, 'content', this.content, message)
      this.lastSnapshotContent = this.content
      this.lastSnapshotAt = Date.now()
      this.snapshots = await listSnapshots(this.currentNote.id, 'content')
      return snap
    },

    /** 重新加载快照列表 */
    async reloadSnapshots() {
      if (!this.currentNote) return
      this.snapshots = await listSnapshots(this.currentNote.id, 'content')
    },

    /** 关闭笔记时清理 */
    async closeNote() {
      await this.flushAutosave()
      if (this.autosaveTimer) {
        clearInterval(this.autosaveTimer)
        this.autosaveTimer = null
      }
      this.currentNote = null
      this.content = ''
      this.snapshots = []
      this.annotations = []
      this.diffOpen = false
      this.diffResult = null
    },

    // ---- 快照面板 ----
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

    async doRollback(snapshot: Snapshot) {
      if (!this.currentNote) return
      await rollbackToSnapshot(this.currentNote.id, snapshot, snapshot.kind)
      if (snapshot.kind === 'content') {
        this.content = snapshot.content
        this.currentNote = { ...this.currentNote, content: snapshot.content, updatedAt: Date.now() }
        this.lastSnapshotContent = snapshot.content
        this.snapshots = await listSnapshots(this.currentNote.id, 'content')
      } else {
        this.annotations = await listAnnotations(this.currentNote.id)
      }
      this.diffOpen = false
    },

    // ---- 作者补充附注区（§4.3） ----
    async addAnnotationEntry(content: string) {
      if (!this.currentNote) return
      const entry = await addAnnotation(this.currentNote.id, content)
      this.annotations = await listAnnotations(this.currentNote.id)
      // 补充区变更独立生成快照（§4.3.4）
      await createSnapshot(this.currentNote.id, 'annotation', entry.content, `补充区：${entry.content.slice(0, 40)}`)
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

    async loadAnnotationSnapshots(): Promise<Snapshot[]> {
      if (!this.currentNote) return []
      return listSnapshots(this.currentNote.id, 'annotation')
    },

    getSnapshotLimit(): number {
      return SNAPSHOT_LIMIT
    },

    async setNoteVisibility(id: string, visibility: 'public' | 'private') {
      await updateNoteMeta(id, { visibility })
      if (this.currentNote) this.currentNote = { ...this.currentNote, visibility }
    }
  }
})
