/** 生成唯一 ID（时间戳 + 随机数） */
export function genId(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}${Date.now().toString(36)}${rand}`
}
