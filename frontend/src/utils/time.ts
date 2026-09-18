import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

/** 格式化时间戳：2026-09-08 14:30 */
export function formatTime(ts: number): string {
  return dayjs(ts).format('YYYY-MM-DD HH:mm')
}

/** GitHub 风格相对时间：3 小时前 */
export function relativeTimeStr(ts: number): string {
  return dayjs(ts).fromNow()
}
