/**
 * 数据模型定义
 * 对应开发文档 §3.2 本地存储层：
 * 项目元数据、笔记原文、目录树、版本快照、标签、作者补充区、本地偏好配置
 */

/** 项目（等价 GitHub Repository） */
export interface Project {
  id: string
  name: string
  description: string
  /** 项目级权限：私密 / 公开 */
  visibility: 'public' | 'private'
  /** 公开项目可开启密码访问 */
  password: string | null
  /** Topic 标签（参考 GitHub Topics 样式） */
  topics: string[]
  createdAt: number
  updatedAt: number
  /** v1.1: 是否已同步到云端（false=纯本地新建，可自由操作；true=云端已存在，操作需登录） */
  synced?: boolean
}

/** 目录树节点（无限层级文件夹） */
export interface FolderNode {
  id: string
  projectId: string
  parentId: string | null
  name: string
  createdAt: number
  updatedAt: number
}

/** 笔记文件（Markdown） */
export interface Note {
  id: string
  projectId: string
  /** 所在文件夹 id，null 表示项目根目录 */
  folderId: string | null
  /** 文件名（不含 .md 后缀） */
  title: string
  content: string
  /** 笔记级权限：公开项目内部可单篇设为私密 */
  visibility: 'public' | 'private'
  /** 项目内置顶，置顶条目在文件列表顶部优先展示 */
  pinned: boolean
  topics: string[]
  /** v1.1: 公开副本关联的原私密笔记 id（私密→公开复制时写入副本） */
  publicSourceNoteId?: string
  createdAt: number
  updatedAt: number
  /** v1.1: 是否已同步到云端（false=纯本地新建，可自由操作；true=云端已存在，操作需登录+密码） */
  synced?: boolean
}
export interface Snapshot {
  id: string
  noteId: string
  /** 快照类型：正文快照 / 作者补充区快照，二者独立保存 */
  kind: 'content' | 'annotation'
  content: string
  /** 快照备注：自动生成或用户手动填写 */
  message: string
  createdAt: number
}

/** 作者补充附注区条目（核心特色，无访客评论） */
export interface Annotation {
  id: string
  noteId: string
  content: string
  createdAt: number
  updatedAt: number
  /** 手动排序序号 */
  order: number
}

/** 本地偏好配置 */
export interface Preference {
  key: string
  value: unknown
  updatedAt: number
}

/** 已登录账号信息（本地保留，用于同步） */
export interface Account {
  id: string
  username: string
  token: string
  syncEnabled: boolean
  updatedAt: number
}
