import { defineStore } from 'pinia'
import {
  createProject,
  updateProject,
  deleteProject,
  listProjects
} from '@/services/projects'
import {
  createFolder,
  renameFolder,
  deleteFolder,
  moveFolder,
  listFolderEntries,
  buildProjectTree,
  type FileEntry,
  type TreeItem
} from '@/services/folders'
import {
  createNote,
  renameNote,
  moveNote,
  deleteNote,
  updateNoteMeta
} from '@/services/notes'
import type { Project } from '@/types/models'
import { usePreferenceStore } from './preference'

/**
 * 项目工作区状态（§4.1）
 * 项目切换、目录树、文件列表
 */
export const useProjectStore = defineStore('project', {
  state: () => ({
    projects: [] as Project[],
    currentProjectId: '' as string,
    /** 当前打开文件夹 id，null 为项目根 */
    currentFolderId: null as string | null,
    /** 当前选中笔记 id */
    currentNoteId: '' as string,
    entries: [] as FileEntry[],
    tree: [] as TreeItem[],
    /** 抽屉折叠状态 */
    sidebarCollapsed: false,
    filePanelCollapsed: false
  }),
  getters: {
    currentProject(state): Project | undefined {
      return state.projects.find((p) => p.id === state.currentProjectId)
    }
  },
  actions: {
    async init() {
      await this.refreshProjects()
      // 恢复上次打开的项目
      const pref = usePreferenceStore()
      const last = pref.lastProjectId
      if (last && this.projects.some((p) => p.id === last)) {
        await this.openProject(last)
      }
    },

    async refreshProjects() {
      this.projects = await listProjects()
    },

    async openProject(projectId: string) {
      this.currentProjectId = projectId
      this.currentFolderId = null
      this.currentNoteId = ''
      this.entries = []
      this.tree = []
      usePreferenceStore().setLastProject(projectId)
      await this.loadTree()
      await this.loadEntries()
    },

    async loadTree() {
      if (!this.currentProjectId) return
      this.tree = await buildProjectTree(this.currentProjectId)
    },

    async loadEntries() {
      if (!this.currentProjectId) return
      this.entries = await listFolderEntries(this.currentProjectId, this.currentFolderId)
    },

    async enterFolder(folderId: string | null) {
      this.currentFolderId = folderId
      this.currentNoteId = ''
      await this.loadEntries()
    },

    async openNote(noteId: string) {
      this.currentNoteId = noteId
    },

    // ---- 项目操作 ----
    async addProject(data: { name: string; description?: string; visibility?: 'public' | 'private'; password?: string | null; topics?: string[] }) {
      const project = await createProject(data)
      await this.refreshProjects()
      await this.openProject(project.id)
      return project
    },

    async editProject(id: string, patch: Partial<Project>) {
      await updateProject(id, patch)
      await this.refreshProjects()
    },

    async removeProject(id: string) {
      await deleteProject(id)
      if (this.currentProjectId === id) {
        this.currentProjectId = ''
        this.currentFolderId = null
        this.currentNoteId = ''
        this.entries = []
        this.tree = []
      }
      await this.refreshProjects()
    },

    // ---- 文件夹操作 ----
    async addFolder(name: string) {
      if (!this.currentProjectId) return
      const folder = await createFolder(this.currentProjectId, this.currentFolderId, name)
      await this.loadTree()
      await this.loadEntries()
      return folder
    },

    async renameFolderById(id: string, name: string) {
      await renameFolder(id, name)
      await this.loadTree()
      await this.loadEntries()
    },

    async removeFolder(id: string) {
      await deleteFolder(id)
      if (this.currentFolderId === id) this.currentFolderId = null
      await this.loadTree()
      await this.loadEntries()
    },

    async dragFolder(id: string, targetFolderId: string | null) {
      await moveFolder(id, targetFolderId)
      await this.loadTree()
      await this.loadEntries()
    },

    // ---- 笔记操作 ----
    async addNote(title: string, content = '') {
      if (!this.currentProjectId) return
      const note = await createNote({
        projectId: this.currentProjectId,
        folderId: this.currentFolderId,
        title,
        content
      })
      await this.loadTree()
      await this.loadEntries()
      this.currentNoteId = note.id
      return note
    },

    async renameNoteById(id: string, title: string) {
      await renameNote(id, title)
      await this.loadTree()
      await this.loadEntries()
    },

    async togglePin(id: string, pinned: boolean) {
      await updateNoteMeta(id, { pinned })
      await this.loadEntries()
    },

    async setNoteVisibility(id: string, visibility: 'public' | 'private') {
      await updateNoteMeta(id, { visibility })
      await this.loadEntries()
    },

    async removeNote(id: string) {
      await deleteNote(id)
      if (this.currentNoteId === id) this.currentNoteId = ''
      await this.loadTree()
      await this.loadEntries()
    },

    async dragNote(id: string, targetFolderId: string | null) {
      await moveNote(id, targetFolderId)
      await this.loadTree()
      await this.loadEntries()
    },

    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
    },

    toggleFilePanel() {
      this.filePanelCollapsed = !this.filePanelCollapsed
    }
  }
})
