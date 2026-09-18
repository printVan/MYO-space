import { db } from '@/db'
import { genId } from '@/utils/id'
import type { Annotation } from '@/types/models'

/** 笔记的作者补充条目（按手动排序） */
export async function listAnnotations(noteId: string): Promise<Annotation[]> {
  return db.annotations.where('noteId').equals(noteId).sortBy('order')
}

/** 新增补充条目（完整 GFM 编辑框，§4.3.1） */
export async function addAnnotation(noteId: string, content: string): Promise<Annotation> {
  const annotations = await db.annotations.where('noteId').equals(noteId).sortBy('order')
  const lastOrder = annotations.length ? annotations[annotations.length - 1].order : 0
  const now = Date.now()
  const annotation: Annotation = {
    id: genId('a_'),
    noteId,
    content,
    createdAt: now,
    updatedAt: now,
    order: lastOrder + 1
  }
  await db.annotations.add(annotation)
  return annotation
}

/** 编辑补充条目 */
export async function updateAnnotation(id: string, content: string): Promise<void> {
  await db.annotations.update(id, { content, updatedAt: Date.now() })
}

/** 删除补充条目 */
export async function deleteAnnotation(id: string): Promise<void> {
  await db.annotations.delete(id)
}

/** 补充条目手动排序（§4.3.3） */
export async function reorderAnnotations(noteId: string, orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.annotations, async () => {
    let order = 1
    for (const id of orderedIds) {
      await db.annotations.update(id, { order })
      order++
    }
  })
}
