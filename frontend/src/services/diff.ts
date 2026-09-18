import { diff_match_patch, type Diff } from 'diff-match-patch'

/**
 * 快照 diff 计算（§4.4.3）
 * 任意两份快照之间查看文本 diff 差异；在前端执行，后端不做 diff（§2.3）
 */
const dmp = new diff_match_patch()

export type DiffOp = 'equal' | 'insert' | 'delete'

export interface DiffLine {
  op: DiffOp
  text: string
}

export interface DiffResult {
  /** 按行拆分的差异片段，用于可视化 */
  lines: DiffLine[]
  /** 统计信息 */
  stats: { added: number; removed: number }
}

/** 计算两份文本的行级 diff */
export function computeLineDiff(oldText: string, newText: string): DiffResult {
  const diffs: Diff[] = dmp.diff_main(oldText, newText)
  dmp.diff_cleanupSemantic(diffs)

  const lines: DiffLine[] = []
  let added = 0
  let removed = 0

  // 把 diff 块按行拆开，逐行输出
  for (const [op, text] of diffs) {
    const linesOfBlock = text.split('\n')
    linesOfBlock.forEach((line, i) => {
      // 避免最后一项空行（split 尾部空串）导致多算
      if (i === linesOfBlock.length - 1 && line === '' && op !== 1) return
      const kind: DiffOp = op === 1 ? 'insert' : op === -1 ? 'delete' : 'equal'
      if (kind === 'insert') added++
      if (kind === 'delete') removed++
      lines.push({ op: kind, text: line })
    })
  }
  return { lines, stats: { added, removed } }
}
