import { db } from '@/db'
import { genId } from '@/utils/id'
import type { Snapshot } from '@/types/models'

/** 单篇笔记快照保留上限（配置化，§4.4.2） */
export const SNAPSHOT_LIMIT = 50

/** 自动生成快照备注 */
export function autoSnapshotMessage(content: string): string {
  const titleMatch = content.match(/^#\s+(.+)$/m)
  const lineCount = content.split('\n').length
  const charCount = content.length
  return titleMatch
    ? `自动快照：${titleMatch[1].trim()}（${lineCount} 行 / ${charCount} 字符）`
    : `自动快照（${lineCount} 行 / ${charCount} 字符）`
}

/**
 * 生成快照（正文或补充区独立生成，§4.3.4）
 * 超出保留上限时自动淘汰最早快照（§4.4.2）
 */
export async function createSnapshot(
  noteId: string,
  kind: 'content' | 'annotation',
  content: string,
  message?: string
): Promise<Snapshot> {
  const snapshot: Snapshot = {
    id: genId('s_'),
    noteId,
    kind,
    content,
    message: message?.trim() ? message.trim() : autoSnapshotMessage(content),
    createdAt: Date.now()
  }
  await db.transaction('rw', [db.snapshots], async () => {
    await db.snapshots.add(snapshot)
    // 淘汰最早快照
    const count = await db.snapshots.where('[noteId+kind]').equals([noteId, kind]).count()
    if (count > SNAPSHOT_LIMIT) {
      const oldest = await db.snapshots.where('[noteId+kind]').equals([noteId, kind]).sortBy('createdAt')
      const toRemove = oldest.slice(0, count - SNAPSHOT_LIMIT)
      if (toRemove.length) await db.snapshots.bulkDelete(toRemove.map((s) => s.id))
    }
  })
  return snapshot
}

/** 快照列表（倒序） */
export async function listSnapshots(noteId: string, kind: 'content' | 'annotation'): Promise<Snapshot[]> {
  const list = await db.snapshots.where('[noteId+kind]').equals([noteId, kind]).sortBy('createdAt')
  return list.reverse()
}

/**
 * 回滚至某份历史快照（§4.4.3）
 * 回滚操作生成一条新快照，旧快照不删除
 */
export async function rollbackToSnapshot(noteId: string, snapshot: Snapshot, kind: 'content' | 'annotation'): Promise<Snapshot> {
  // 回滚前先将当前内容留档为新快照
  if (kind === 'content') {
    const note = await db.notes.get(noteId)
    if (note && note.content !== snapshot.content) {
      await createSnapshot(noteId, 'content', note.content, `回滚前备份（${new Date().toLocaleString('zh-CN')}）`)
    }
    await db.notes.update(noteId, { content: snapshot.content, updatedAt: Date.now() })
    return createSnapshot(noteId, 'content', snapshot.content, `回滚至 ${new Date(snapshot.createdAt).toLocaleString('zh-CN')} 的快照`)
  }
  // 补充区回滚：将快照内容作为补充区最新条目
  const annotations = await db.annotations.where('noteId').equals(noteId).sortBy('order')
  const lastOrder = annotations.length ? annotations[annotations.length - 1].order : 0
  await db.annotations.add({
    id: genId('a_'),
    noteId,
    content: snapshot.content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    order: lastOrder + 1
  })
  return createSnapshot(noteId, 'annotation', snapshot.content, `补充区回滚至 ${new Date(snapshot.createdAt).toLocaleString('zh-CN')}`)
}
