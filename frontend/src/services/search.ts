import { db } from '@/db'
import type { Project, Note, Annotation } from '@/types/models'

export interface SearchResult {
  kind: 'note'
  id: string
  projectId: string
  projectName: string
  title: string
  /** 命中片段（带高亮位置） */
  snippet: string
  /** 命中原因：标题 / 正文 / 标签 */
  matchedBy: ('title' | 'content' | 'topic')[]
}

/**
 * 全局搜索（§4.9）
 * 搜索范围：标题、笔记正文、标签；支持项目内筛选
 */
export async function globalSearch(keyword: string, projectId?: string): Promise<SearchResult[]> {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return []

  const projects = await db.projects.toArray()
  const projectMap = new Map(projects.map((p) => [p.id, p]))
  const notes = await db.notes.toArray()
  const results: SearchResult[] = []

  for (const note of notes) {
    if (projectId && note.projectId !== projectId) continue
    const project = projectMap.get(note.projectId)
    if (!project) continue

    const matchedBy: SearchResult['matchedBy'] = []
    const titleHit = note.title.toLowerCase().includes(kw)
    const topicHit = note.topics.some((t) => t.toLowerCase().includes(kw))
    const contentIdx = note.content.toLowerCase().indexOf(kw)

    if (titleHit) matchedBy.push('title')
    if (topicHit) matchedBy.push('topic')
    if (contentIdx >= 0) matchedBy.push('content')

    if (matchedBy.length) {
      results.push({
        kind: 'note',
        id: note.id,
        projectId: note.projectId,
        projectName: project.name,
        title: note.title.endsWith('.md') ? note.title : `${note.title}.md`,
        snippet: makeSnippet(note.content, contentIdx, kw),
        matchedBy
      })
    }
  }

  // 标题命中优先
  results.sort((a, b) => {
    const rank = (r: SearchResult) => (r.matchedBy.includes('title') ? 0 : r.matchedBy.includes('topic') ? 1 : 2)
    return rank(a) - rank(b)
  })
  return results
}

function makeSnippet(content: string, idx: number, kw: string): string {
  if (idx < 0) return content.slice(0, 80)
  const start = Math.max(0, idx - 30)
  const end = Math.min(content.length, idx + kw.length + 60)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < content.length ? '…' : ''
  return prefix + content.slice(start, end).replace(/\s+/g, ' ').trim() + suffix
}

/** 按项目导出全部笔记（md 导出用） */
export async function exportProjectNotes(projectId: string): Promise<{ note: Note; path: string }[]> {
  const folders = await db.folders.where('projectId').equals(projectId).toArray()
  const folderMap = new Map(folders.map((f) => [f.id, f]))
  const notes = await db.notes.where('projectId').equals(projectId).toArray()
  return notes.map((note) => {
    const pathParts: string[] = []
    let cursor: string | null = note.folderId
    while (cursor && folderMap.has(cursor)) {
      pathParts.unshift(folderMap.get(cursor)!.name)
      cursor = folderMap.get(cursor)!.parentId
    }
    pathParts.push(note.title.endsWith('.md') ? note.title : `${note.title}.md`)
    return { note, path: pathParts.join('/') }
  })
}

export type { Project, Note, Annotation }
